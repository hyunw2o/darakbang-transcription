import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import NmPressable from "./components/NmPressable";
import FadeInView from "./components/FadeInView";
import Banner from "./components/Banner";
import SegmentButton from "./components/SegmentButton";
import SocialAuthButton from "./components/SocialAuthButton";
import AppleIapSubscriptionCard from "./components/AppleIapSubscriptionCard";
import {
  APP_TABS,
  BUSINESS_ADDRESS,
  BUSINESS_ADDRESS_EN,
  BUSINESS_NAME,
  BUSINESS_REG_NUMBER,
  ECOMMERCE_REG_NUMBER,
  FREE_MONTHLY_LIMIT_SECONDS,
  GUEST_MAX_AUDIO_SECONDS,
  GUEST_MONTHLY_LIMIT_SECONDS,
  GUEST_SESSION_KEY,
  LANDLINE_PHONE,
  MAX_UPLOAD_BYTES,
  MOBILE_THEME_OPTIONS,
  MOBILE_THEMES,
  NM,
  PRIVACY_CONSENT_KEY,
  PRIVACY_POLICY_VERSION,
  RECORD_CATEGORIES,
  REPRESENTATIVE_NAME,
  REPRESENTATIVE_NAME_EN,
  STATUS_POLL_INTERVAL_MS,
  SUPPORT_EMAIL,
  TRANSCRIBE_POLL_TIMEOUT_MS,
  UI_THEME_KEY,
  UI_THEME_MODE_KEY,
} from "./config";
import { getExtension, inferMimeFromAsset } from "./utils/file";
import { formatDate, formatSecondsToHourMinute, sanitizeFileName } from "./utils/format";
import { buildDocxBase64 } from "./utils/docx";
import { requestApi } from "./utils/network";
import useMobileAuth from "./hooks/useMobileAuth";

import { I18N, LEGAL_DOCUMENTS } from "./content";

const CREATE_GLOSSARY_ACTION_ID = "__create_glossary__";
const EMPTY_GLOSSARY_FORM = {
  term: "",
  meaning: "",
  aliases: "",
  contexts: "",
};
const TRANSCRIPTION_TYPE_CARD_ORDER = ["sermon", "conversation", "phonecall"];
const TRANSCRIPTION_TYPE_CARD_META = {
  sermon: { icon: "S" },
  conversation: { icon: "M" },
  phonecall: { icon: "C" },
};
const PROCESSING_STEP_KEYS = ["uploaded", "recognized", "structured", "saved"];
const TASK_PHASE_STEP_INDEX = {
  uploading: 0,
  queued: 1,
  waiting: 1,
  processing: 2,
  historyLoading: 3,
  done: PROCESSING_STEP_KEYS.length,
};

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateDisplayText(value, maxLength = 160) {
  const compact = compactTranscriptText(value);
  if (!compact) return "";
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function firstMeaningfulLine(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function findLabeledValue(text, labels) {
  const lines = String(text || "").split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const label of labels) {
      const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:：\\-]\\s*(.+)$`, "i");
      const match = trimmed.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "";
}

function buildResultSections({ text, summary, typeLabel, copy }) {
  const sourceText = String(text || "");
  const summaryText = String(summary || "");
  const fallback = copy.resultEmptyValue || "-";
  const body =
    findLabeledValue(sourceText, ["본문", "성경본문", "Scripture", "Passage", "Body"]) ||
    truncateDisplayText(sourceText, 220) ||
    fallback;
  const topic =
    findLabeledValue(`${summaryText}\n${sourceText}`, ["주제", "제목", "Topic", "Title"]) ||
    truncateDisplayText(firstMeaningfulLine(summaryText), 120) ||
    typeLabel ||
    fallback;
  const keyPoint =
    findLabeledValue(`${summaryText}\n${sourceText}`, ["핵심", "핵심 메시지", "Key", "Key Point", "Main Point"]) ||
    truncateDisplayText(summaryText || sourceText, 160) ||
    fallback;
  const summaryValue =
    findLabeledValue(summaryText, ["요약", "Summary"]) ||
    truncateDisplayText(summaryText || sourceText, 220) ||
    fallback;

  return [
    { key: "body", label: copy.resultSections?.body || "Body", value: body },
    { key: "topic", label: copy.resultSections?.topic || "Topic", value: topic },
    { key: "keyPoint", label: copy.resultSections?.keyPoint || "Key", value: keyPoint },
    { key: "summary", label: copy.resultSections?.summary || "Summary", value: summaryValue },
  ];
}

function parseGlossaryListInput(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactTranscriptText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getMobileLegalDocuments(baseDocs, language) {
  const businessSection = baseDocs?.terms?.sections?.find((section) =>
    String(section?.title || "").includes(language === "en" ? "Business" : "사업자")
  );
  const businessBody = Array.isArray(businessSection?.body)
    ? businessSection.body
    : [language === "en" ? "See the service website for business disclosure and support contact." : "사업자 정보와 문의처는 서비스 웹사이트에서 확인할 수 있습니다."];
  const privacy = baseDocs?.privacy;
  const notice = baseDocs?.notice;
  const faq = baseDocs?.faq;

  if (language === "en") {
    return {
      privacy,
      terms: {
        ...baseDocs.terms,
        sections: [
          {
            title: "1. Service Scope",
            body: [
              "The app provides speech transcription, text correction, summarization, and structured record features.",
              "Usage is available within the monthly quota shown in the app.",
            ],
          },
          {
            title: "2. Usage Quota",
            body: [
              "Each account can check remaining monthly time in Settings.",
              "Guest mode results are shown only on the current device session.",
            ],
          },
          {
            title: "3. Data and AI Processing",
            body: [
              "Uploaded audio and generated text may be processed by Supabase, OpenAI, and Google (Gemini) only to provide app functionality.",
              "Users must review and agree to the privacy and AI processing notice before using login and transcription features.",
            ],
          },
          {
            title: "4. User Responsibility",
            body: [
              "Users must have lawful rights to uploaded content and must review generated outputs before relying on them.",
            ],
          },
          {
            title: "5. Business Information",
            body: businessBody,
          },
        ],
      },
      companyPolicy: {
        ...baseDocs.companyPolicy,
        sections: [
          {
            title: "1. Operating Principles",
            body: [
              "We prioritize transcript quality, security, and reliability while keeping workflows simple and practical.",
            ],
          },
          {
            title: "2. Data and Security Standards",
            body: [
              "We apply data minimization, HTTPS, token validation, and request throttling as baseline controls.",
            ],
          },
          {
            title: "3. Responsible AI Use",
            body: [
              "Uploaded data is used only for service functionality.",
              "Machine-generated outputs should be reviewed by users before final use.",
            ],
          },
          {
            title: "4. Notice and Support",
            body: [
              "Major policy, feature, and incident updates are announced via web or in-app notices.",
            ],
          },
        ],
      },
      notice,
      faq,
    };
  }

  return {
    privacy,
    terms: {
      ...baseDocs.terms,
      sections: [
        {
          title: "1. 서비스 범위",
          body: [
            "앱은 음성 전사, 텍스트 교정, 요약, 구조화 기록 기능을 제공합니다.",
            "사용량은 앱에 표시되는 월간 한도 내에서 제공됩니다.",
          ],
        },
        {
          title: "2. 사용량 안내",
          body: [
            "계정별 남은 월간 사용 시간은 설정 화면에서 확인할 수 있습니다.",
            "비로그인 체험 결과는 현재 기기 화면에서만 확인할 수 있습니다.",
          ],
        },
        {
          title: "3. 데이터 및 AI 처리",
          body: [
            "업로드 음성과 생성 텍스트는 앱 기능 제공을 위해 Supabase, OpenAI, Google(Gemini)에서 처리될 수 있습니다.",
            "로그인과 음성 변환 기능을 사용하기 전에 개인정보 및 AI 처리 안내에 동의해야 합니다.",
          ],
        },
        {
          title: "4. 이용자 책임",
          body: [
            "업로드 자료에 대한 적법한 권리를 보유해야 하며, 자동 생성 결과는 최종 사용 전 직접 검토해야 합니다.",
          ],
        },
        {
          title: "5. 사업자 정보",
          body: businessBody,
        },
      ],
    },
    companyPolicy: {
      ...baseDocs.companyPolicy,
      sections: [
        {
          title: "1. 운영 원칙",
          body: [
            "정확도, 보안, 안정성을 우선으로 제품을 개선합니다.",
            "사용자가 빠르게 기록을 재활용할 수 있는 단순한 흐름을 유지합니다.",
          ],
        },
        {
          title: "2. 데이터/보안 정책",
          body: [
            "최소 데이터 처리, HTTPS, 토큰 검증, 요청 제한을 기본 통제로 적용합니다.",
          ],
        },
        {
          title: "3. 책임 있는 AI",
          body: [
            "업로드 데이터는 서비스 기능 제공 목적 내에서만 처리합니다.",
            "자동 생성 결과는 최종 사용 전 이용자의 검토가 필요합니다.",
          ],
        },
        {
          title: "4. 공지 및 지원",
          body: [
            "주요 정책, 기능, 장애 관련 변경은 웹 또는 앱 내 문서로 안내합니다.",
          ],
        },
      ],
    },
    notice,
    faq,
  };
}

function App() {
  const pollRef = useRef(null);
  const pollStartedAtRef = useRef(0);
  const pollTokenRef = useRef(0);
  const activeTaskIdRef = useRef("");
  const resultEpochRef = useRef(0);
  const scrollUnlockTimerRef = useRef(null);
  const historyDeleteConfirmTimerRef = useRef(null);
  const historyDeleteAllConfirmTimerRef = useRef(null);
  const colorScheme = useColorScheme();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();

  const [uiBootLoading, setUiBootLoading] = useState(true);
  const [themeMode, setThemeMode] = useState("auto");
  const [themeKey, setThemeKey] = useState("aurora");
  const [openSettingsMenu, setOpenSettingsMenu] = useState("");

  const [activeTab, setActiveTab] = useState("transcribe");
  const [uiLanguage, setUiLanguage] = useState("ko");
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("ko");
  const [transcriptionType, setTranscriptionType] = useState("conversation");
  const [pickedFile, setPickedFile] = useState(null);
  const [guestModeStarted, setGuestModeStarted] = useState(false);
  const [guestSessionId, setGuestSessionId] = useState("");
  const [guestUsage, setGuestUsage] = useState({
    plan_tier: "guest",
    used_audio_seconds: 0,
    monthly_limit_seconds: GUEST_MONTHLY_LIMIT_SECONDS,
    remaining_seconds: GUEST_MONTHLY_LIMIT_SECONDS,
    usage_percent: 0,
    max_audio_seconds: GUEST_MAX_AUDIO_SECONDS,
  });

  const [submitting, setSubmitting] = useState(false);
  const [taskPhase, setTaskPhase] = useState("idle");
  const [taskStateText, setTaskStateText] = useState("");
  const [result, setResult] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyDeletingTaskId, setHistoryDeletingTaskId] = useState("");
  const [historyBulkDeleting, setHistoryBulkDeleting] = useState(false);
  const [pendingHistoryDeleteTaskId, setPendingHistoryDeleteTaskId] = useState("");
  const [pendingHistoryBulkDelete, setPendingHistoryBulkDelete] = useState(false);

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [recordEditDrafts, setRecordEditDrafts] = useState({});
  const [recordSavingId, setRecordSavingId] = useState("");
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [glossaryLoaded, setGlossaryLoaded] = useState(false);
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [glossaryActionId, setGlossaryActionId] = useState("");
  const [glossaryForm, setGlossaryForm] = useState(EMPTY_GLOSSARY_FORM);

  const [recordDrafts, setRecordDrafts] = useState({});
  const [recordDraftSources, setRecordDraftSources] = useState({});
  const [draftLoadingCategory, setDraftLoadingCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState("");
  const [transcriptEditText, setTranscriptEditText] = useState("");
  const [transcriptEditSaving, setTranscriptEditSaving] = useState(false);
  const [workspaceScrollEnabled, setWorkspaceScrollEnabled] = useState(true);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [privacyConsentSaving, setPrivacyConsentSaving] = useState(false);
  const [legalModalDocType, setLegalModalDocType] = useState("");

  const isIosAppStoreReviewMode = Platform.OS === "ios";
  // Apple Review requires paid digital subscriptions to be purchasable in-app on iOS.
  // Do not allow an environment toggle or review-mode flag to hide the IAP entry point.
  const copy = I18N[uiLanguage] || I18N.ko;
  const baseLegalDocs = LEGAL_DOCUMENTS[uiLanguage] || LEGAL_DOCUMENTS.ko;
  const legalDocs = useMemo(
    () => (
      isIosAppStoreReviewMode
        ? getMobileLegalDocuments(baseLegalDocs, uiLanguage)
        : baseLegalDocs
    ),
    [baseLegalDocs, isIosAppStoreReviewMode, uiLanguage]
  );
  const activeLegalDoc = legalModalDocType ? legalDocs[legalModalDocType] || null : null;
  const settingsBusinessRows = useMemo(() => {
    if (uiLanguage === "en") {
      return [
        [`Company: ${BUSINESS_NAME}`, `Representative: ${REPRESENTATIVE_NAME_EN}`, `Business Reg. No.: ${BUSINESS_REG_NUMBER}`],
        [`E-commerce Reg. No.: ${ECOMMERCE_REG_NUMBER}`, `Phone: ${LANDLINE_PHONE}`],
        [`Address: ${BUSINESS_ADDRESS_EN}`],
        [`Contact: ${SUPPORT_EMAIL}`],
      ];
    }

    return [
      [`상호: ${BUSINESS_NAME}`, `대표: ${REPRESENTATIVE_NAME}`, `사업자등록번호: ${BUSINESS_REG_NUMBER}`],
      [`통신판매신고번호: ${ECOMMERCE_REG_NUMBER}`, `대표자 전화번호: ${LANDLINE_PHONE}`],
      [`사업장주소: ${BUSINESS_ADDRESS}`],
      [`문의 이메일: ${SUPPORT_EMAIL}`],
    ];
  }, [uiLanguage]);
  const clearMessages = useCallback(() => {
    setNotice("");
    setError("");
  }, []);
  const ensureGuestSessionId = useCallback(async () => {
    if (guestSessionId) return guestSessionId;
    const existing = await AsyncStorage.getItem(GUEST_SESSION_KEY);
    if (existing) {
      setGuestSessionId(existing);
      return existing;
    }
    const generated = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(GUEST_SESSION_KEY, generated);
    setGuestSessionId(generated);
    return generated;
  }, [guestSessionId]);
  const getGuestHeaders = useCallback(async () => {
    const resolvedGuestId = await ensureGuestSessionId();
    return { "X-Guest-Session-Id": resolvedGuestId };
  }, [ensureGuestSessionId]);
  const fetchGuestUsage = useCallback(async ({ showNotice = false } = {}) => {
    try {
      const data = await requestApi("/api/guest/usage", {
        headers: await getGuestHeaders(),
      });
      setGuestUsage(data);
      if (showNotice) {
        setNotice(copy.notices.guestUsageLoaded || copy.notices.usageLoaded);
      }
      return data;
    } catch (e) {
      setError(e.message || copy.errors.usageReadFailed);
      return null;
    }
  }, [copy.errors.usageReadFailed, copy.notices.guestUsageLoaded, copy.notices.usageLoaded, getGuestHeaders]);
  const clearScrollUnlockTimer = useCallback(() => {
    if (scrollUnlockTimerRef.current) {
      clearTimeout(scrollUnlockTimerRef.current);
      scrollUnlockTimerRef.current = null;
    }
  }, []);
  const clearHistoryDeleteConfirmTimer = useCallback(() => {
    if (historyDeleteConfirmTimerRef.current) {
      clearTimeout(historyDeleteConfirmTimerRef.current);
      historyDeleteConfirmTimerRef.current = null;
    }
    setPendingHistoryDeleteTaskId("");
  }, []);
  const clearHistoryDeleteAllConfirmTimer = useCallback(() => {
    if (historyDeleteAllConfirmTimerRef.current) {
      clearTimeout(historyDeleteAllConfirmTimerRef.current);
      historyDeleteAllConfirmTimerRef.current = null;
    }
    setPendingHistoryBulkDelete(false);
  }, []);
  const armHistoryDeleteConfirm = useCallback((taskId) => {
    clearHistoryDeleteAllConfirmTimer();
    clearHistoryDeleteConfirmTimer();
    setPendingHistoryDeleteTaskId(taskId);
    historyDeleteConfirmTimerRef.current = setTimeout(() => {
      setPendingHistoryDeleteTaskId("");
      historyDeleteConfirmTimerRef.current = null;
    }, 5000);
  }, [clearHistoryDeleteAllConfirmTimer, clearHistoryDeleteConfirmTimer]);
  const armHistoryDeleteAllConfirm = useCallback(() => {
    clearHistoryDeleteConfirmTimer();
    clearHistoryDeleteAllConfirmTimer();
    setPendingHistoryBulkDelete(true);
    historyDeleteAllConfirmTimerRef.current = setTimeout(() => {
      setPendingHistoryBulkDelete(false);
      historyDeleteAllConfirmTimerRef.current = null;
    }, 5000);
  }, [clearHistoryDeleteAllConfirmTimer, clearHistoryDeleteConfirmTimer]);
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  const unlockWorkspaceScroll = useCallback(() => {
    clearScrollUnlockTimer();
    setWorkspaceScrollEnabled(true);
  }, [clearScrollUnlockTimer]);
  const lockWorkspaceScroll = useCallback(() => {
    clearScrollUnlockTimer();
    setWorkspaceScrollEnabled(false);
    scrollUnlockTimerRef.current = setTimeout(() => {
      setWorkspaceScrollEnabled(true);
      scrollUnlockTimerRef.current = null;
    }, 500);
  }, [clearScrollUnlockTimer]);
  const invalidatePollingSession = useCallback(() => {
    stopPolling();
    pollTokenRef.current += 1;
    pollStartedAtRef.current = 0;
    activeTaskIdRef.current = "";
  }, [stopPolling]);
  const resetResultWorkspace = useCallback((restoreScroll = false) => {
    resultEpochRef.current += 1;
    setResult(null);
    setSummaryLoading(false);
    setRecordDrafts({});
    setRecordDraftSources({});
    setDraftLoadingCategory("");
    setSavingCategory("");
    setTranscriptEditText("");
    setTranscriptEditSaving(false);
    setTaskPhase("idle");
    setTaskStateText("");
    setSubmitting(false);
    if (restoreScroll) {
      unlockWorkspaceScroll();
    }
    return resultEpochRef.current;
  }, [unlockWorkspaceScroll]);
  const shortestEdge = Math.min(screenWidth, screenHeight);
  const compactLayout = screenHeight < 760 || shortestEdge < 390 || fontScale >= 1.1;
  const tinyLayout = screenHeight < 680 || shortestEdge < 360 || fontScale >= 1.25;
  const modalHorizontalPadding = shortestEdge < 360 ? 10 : 16;
  const modalVerticalPadding = tinyLayout ? 8 : compactLayout ? 10 : 12;
  const modalAvailableWidth = Math.max(260, screenWidth - modalHorizontalPadding * 2);
  const modalAvailableHeight = Math.max(260, screenHeight - modalVerticalPadding * 2);
  const privacyModalWidth = Math.min(modalAvailableWidth, tinyLayout ? 420 : 520);
  const privacyModalMaxHeight = Math.min(
    modalAvailableHeight,
    Math.max(
      240,
      Math.round(
        modalAvailableHeight * (tinyLayout ? 0.95 : compactLayout ? 0.9 : 0.86)
      )
    )
  );
  const modalFontShrinkFactor = useMemo(() => {
    let factor = 1;
    if (shortestEdge < 390) factor *= 0.96;
    if (shortestEdge < 360) factor *= 0.9;
    if (fontScale >= 1.15) factor *= 0.95;
    if (fontScale >= 1.3) factor *= 0.9;
    return Math.max(0.82, Math.min(1, factor));
  }, [shortestEdge, fontScale]);
  const modalTextStyles = useMemo(() => {
    const scaled = (value, min) =>
      Math.max(min, Math.round(value * modalFontShrinkFactor * 10) / 10);
    return {
      title: {
        fontSize: scaled(tinyLayout ? 14 : compactLayout ? 16 : 18, 13),
        lineHeight: scaled(tinyLayout ? 19 : compactLayout ? 22 : 24, 16),
      },
      meta: {
        fontSize: scaled(tinyLayout ? 10 : 11, 9),
        lineHeight: scaled(tinyLayout ? 14 : 16, 12),
      },
      body: {
        fontSize: scaled(tinyLayout ? 10 : compactLayout ? 11 : 12, 9.5),
        lineHeight: scaled(tinyLayout ? 15 : compactLayout ? 16 : 18, 14),
      },
      sectionTitle: {
        fontSize: scaled(tinyLayout ? 12 : 13, 11),
        lineHeight: scaled(tinyLayout ? 16 : 18, 14),
      },
      sectionBody: {
        fontSize: scaled(tinyLayout ? 10 : 11, 9),
        lineHeight: scaled(tinyLayout ? 15 : 17, 13),
      },
      summaryItem: {
        fontSize: scaled(tinyLayout ? 9.5 : compactLayout ? 10 : 11, 9),
        lineHeight: scaled(tinyLayout ? 14 : compactLayout ? 15 : 17, 13),
      },
      linkText: {
        fontSize: scaled(tinyLayout ? 11 : 12, 10),
      },
      checkText: {
        fontSize: scaled(tinyLayout ? 10.5 : 12, 10),
        lineHeight: scaled(tinyLayout ? 15 : 17, 14),
      },
      actionText: {
        fontSize: scaled(tinyLayout ? 12 : 13, 11),
      },
    };
  }, [compactLayout, tinyLayout, modalFontShrinkFactor]);
  const resultEditorHeight = tinyLayout ? 132 : compactLayout ? 150 : 172;
  const recordEditorHeight = tinyLayout ? 118 : compactLayout ? 132 : 150;
  const resolvedThemeKey =
    themeMode === "auto" ? (colorScheme === "dark" ? "noir" : "aurora") : themeKey;
  const activeTheme = MOBILE_THEMES[resolvedThemeKey] || MOBILE_THEMES.aurora;
  const isPrivacyGateVisible = !privacyAccepted && !activeLegalDoc;
  const authLandingBadges = useMemo(
    () => [
      copy.authLanding.badges.free,
      ...(isIosAppStoreReviewMode ? [] : [copy.authLanding.badges.pro]),
      copy.authLanding.badges.beta,
    ],
    [copy.authLanding.badges.beta, copy.authLanding.badges.free, copy.authLanding.badges.pro, isIosAppStoreReviewMode]
  );
  const transcriptionTypeOptions = useMemo(
    () => TRANSCRIPTION_TYPE_CARD_ORDER.map((key) => ({ key, label: copy.transcriptionTypes[key] || key })),
    [copy]
  );
  const recordCategoryOptions = useMemo(
    () => RECORD_CATEGORIES.map((key) => ({ key, label: copy.recordCategories[key] || key })),
    [copy]
  );
  const fetchHistory = useCallback(async (token) => {
    if (!token) {
      setHistory([]);
      setHistoryLoaded(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const data = await requestApi("/api/history", { token });
      setHistory(Array.isArray(data) ? data : []);
      setHistoryLoaded(true);
    } catch (e) {
      setError(e.message || copy.errors.historyReadFailed);
    } finally {
      setHistoryLoading(false);
    }
  }, [copy.errors.historyReadFailed]);

  const fetchRecords = useCallback(async (token) => {
    if (!token) {
      setRecords([]);
      setRecordsLoaded(false);
      return;
    }
    setRecordsLoading(true);
    try {
      const data = await requestApi("/api/records", { token });
      setRecords(Array.isArray(data) ? data : []);
      setRecordsLoaded(true);
    } catch (e) {
      setError(e.message || copy.errors.recordsReadFailed);
    } finally {
      setRecordsLoading(false);
    }
  }, [copy.errors.recordsReadFailed]);

  const fetchGlossary = useCallback(async (token, { quiet = true } = {}) => {
    if (!token) {
      setGlossaryTerms([]);
      setGlossaryLoaded(false);
      return [];
    }
    setGlossaryLoading(true);
    try {
      const data = await requestApi("/api/glossary", { token });
      const terms = Array.isArray(data?.terms) ? data.terms : Array.isArray(data) ? data : [];
      setGlossaryTerms(terms);
      setGlossaryLoaded(true);
      return terms;
    } catch (e) {
      setGlossaryLoaded(true);
      if (!quiet) {
        setError(e.message || copy.errors.glossaryReadFailed);
      }
      return [];
    } finally {
      setGlossaryLoading(false);
    }
  }, [copy.errors.glossaryReadFailed]);

  const resetAppWorkspace = useCallback(() => {
    invalidatePollingSession();
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryDeletingTaskId("");
    setHistoryBulkDeleting(false);
    setRecords([]);
    setRecordsLoaded(false);
    setRecordEditDrafts({});
    setRecordSavingId("");
    setGlossaryTerms([]);
    setGlossaryLoaded(false);
    setGlossaryLoading(false);
    setGlossaryActionId("");
    setGlossaryForm(EMPTY_GLOSSARY_FORM);
    resetResultWorkspace(true);
    setPickedFile(null);
    setTaskPhase("idle");
    setTaskStateText("");
    setGuestModeStarted(false);
  }, []);

  const {
    bootLoading: authBootLoading,
    authMode,
    setAuthMode,
    authName,
    setAuthName,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authLoading,
    socialLoading,
    authToken,
    authUser,
    isLoggedIn,
    sessionRemainingLabel,
    usage,
    usageLoading,
    fetchUsage,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    handleOpenOurs,
    handleDeleteAccount,
  } = useMobileAuth({
    copy,
    language: uiLanguage,
    clearMessages,
    setNotice,
    setError,
    onSessionReady: (token) => {
      setGuestModeStarted(false);
      fetchHistory(token);
      fetchRecords(token);
      fetchGlossary(token, { quiet: true });
    },
    onSessionCleared: resetAppWorkspace,
  });

  const bootLoading = uiBootLoading || authBootLoading;
  const isGuestMode = !isLoggedIn && guestModeStarted;
  const tabOptions = useMemo(
    () => {
      const visibleTabs = isLoggedIn ? APP_TABS : ["transcribe", "settings"];
      return visibleTabs.map((key) => ({ key, label: copy.tabs[key] || key }));
    },
    [copy, isLoggedIn]
  );
  const effectiveUsage = isGuestMode ? guestUsage : usage;
  const usagePlan = String(effectiveUsage?.plan_tier || (isGuestMode ? "guest" : "free"));
  const displayUsagePlan = usagePlan;
  const isFreeUsagePlan = displayUsagePlan === "free" || displayUsagePlan === "guest";
  const usedAudioSeconds = Math.max(0, Number(effectiveUsage?.used_audio_seconds) || 0);
  const monthlyLimitSeconds = Math.max(
    1,
    Number(effectiveUsage?.monthly_limit_seconds) || (isGuestMode ? GUEST_MONTHLY_LIMIT_SECONDS : FREE_MONTHLY_LIMIT_SECONDS)
  );
  const remainingAudioSeconds = isFreeUsagePlan
    ? Math.max(0, Number(effectiveUsage?.remaining_seconds ?? monthlyLimitSeconds - usedAudioSeconds))
    : null;
  const usagePercent = isFreeUsagePlan
    ? Math.max(0, Math.min(100, Number(effectiveUsage?.usage_percent) || 0))
    : 0;
  const planLabel = copy.planLabels?.[displayUsagePlan] || displayUsagePlan;
  const usageSettingsTitle = copy.settingsUsageTitle;
  const usageSettingsHint = copy.settingsUsageHint;

  const handleCreateGlossaryTerm = useCallback(async () => {
    if (!isLoggedIn || !authToken) {
      setError(copy.errors.authRequired);
      return;
    }
    const payload = {
      term: glossaryForm.term.trim(),
      meaning: glossaryForm.meaning.trim(),
      aliases: parseGlossaryListInput(glossaryForm.aliases),
      contexts: parseGlossaryListInput(glossaryForm.contexts),
    };
    if (!payload.term) {
      setError(copy.errors.glossaryTermRequired);
      return;
    }
    setGlossaryActionId(CREATE_GLOSSARY_ACTION_ID);
    try {
      const data = await requestApi("/api/glossary", {
        method: "POST",
        token: authToken,
        body: JSON.stringify(payload),
      });
      const savedTerm = data?.term || payload;
      setGlossaryTerms((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        const savedId = savedTerm?.id == null ? "" : String(savedTerm.id);
        const savedKey = String(savedTerm?.term || "").trim().toLowerCase();
        const filtered = existing.filter((item) => {
          const itemId = item?.id == null ? "" : String(item.id);
          const itemKey = String(item?.term || "").trim().toLowerCase();
          return itemId !== savedId && itemKey !== savedKey;
        });
        return [savedTerm, ...filtered];
      });
      setGlossaryLoaded(true);
      setGlossaryForm(EMPTY_GLOSSARY_FORM);
      setNotice(copy.notices.glossarySaved);
    } catch (e) {
      setError(e.message || copy.errors.glossarySaveFailed);
    } finally {
      setGlossaryActionId("");
    }
  }, [
    authToken,
    copy.errors.authRequired,
    copy.errors.glossarySaveFailed,
    copy.errors.glossaryTermRequired,
    copy.notices.glossarySaved,
    glossaryForm.aliases,
    glossaryForm.contexts,
    glossaryForm.meaning,
    glossaryForm.term,
    isLoggedIn,
  ]);

  const handleToggleGlossaryTerm = useCallback(async (item) => {
    if (!isLoggedIn || !authToken || !item?.id) {
      setError(copy.errors.authRequired);
      return;
    }
    const termId = String(item.id);
    setGlossaryActionId(termId);
    try {
      const data = await requestApi(`/api/glossary/${encodeURIComponent(termId)}`, {
        method: "PUT",
        token: authToken,
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const updatedTerm = data?.term || { ...item, is_active: !item.is_active };
      setGlossaryTerms((prev) =>
        (Array.isArray(prev) ? prev : []).map((term) =>
          String(term?.id) === termId ? updatedTerm : term
        )
      );
      setNotice(copy.notices.glossaryUpdated);
    } catch (e) {
      setError(e.message || copy.errors.glossaryUpdateFailed);
    } finally {
      setGlossaryActionId("");
    }
  }, [
    authToken,
    copy.errors.authRequired,
    copy.errors.glossaryUpdateFailed,
    copy.notices.glossaryUpdated,
    isLoggedIn,
  ]);

  const handleDeleteGlossaryTerm = useCallback(async (item) => {
    if (!isLoggedIn || !authToken || !item?.id) {
      setError(copy.errors.authRequired);
      return;
    }
    const termId = String(item.id);
    setGlossaryActionId(termId);
    try {
      await requestApi(`/api/glossary/${encodeURIComponent(termId)}`, {
        method: "DELETE",
        token: authToken,
      });
      setGlossaryTerms((prev) =>
        (Array.isArray(prev) ? prev : []).filter((term) => String(term?.id) !== termId)
      );
      setNotice(copy.notices.glossaryDeleted);
    } catch (e) {
      setError(e.message || copy.errors.glossaryDeleteFailed);
    } finally {
      setGlossaryActionId("");
    }
  }, [
    authToken,
    copy.errors.authRequired,
    copy.errors.glossaryDeleteFailed,
    copy.notices.glossaryDeleted,
    isLoggedIn,
  ]);

  const handleRequestDeleteAccount = useCallback(() => {
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }
    Alert.alert(
      copy.accountDeleteTitle,
      copy.accountDeleteMessage,
      [
        { text: copy.accountDeleteCancel, style: "cancel" },
        {
          text: copy.accountDeleteConfirm,
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ],
    );
  }, [
    copy.accountDeleteCancel,
    copy.accountDeleteConfirm,
    copy.accountDeleteMessage,
    copy.accountDeleteTitle,
    copy.errors.authRequired,
    handleDeleteAccount,
    isLoggedIn,
  ]);

  useEffect(() => {
    setOpenSettingsMenu("");
    clearHistoryDeleteConfirmTimer();
    clearHistoryDeleteAllConfirmTimer();
  }, [clearHistoryDeleteAllConfirmTimer, clearHistoryDeleteConfirmTimer, isLoggedIn]);

  useEffect(() => {
    ensureGuestSessionId().catch(() => {});
  }, [ensureGuestSessionId]);

  useEffect(() => {
    if (isLoggedIn || !guestModeStarted) return;
    fetchGuestUsage().catch(() => {});
  }, [fetchGuestUsage, guestModeStarted, isLoggedIn]);

  useEffect(() => () => {
    clearHistoryDeleteConfirmTimer();
    clearHistoryDeleteAllConfirmTimer();
  }, [clearHistoryDeleteAllConfirmTimer, clearHistoryDeleteConfirmTimer]);

  useEffect(() => {
    if (!isLoggedIn && (activeTab === "history" || activeTab === "records")) {
      setActiveTab("transcribe");
    }
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    if (activeTab !== "transcribe") {
      setWorkspaceScrollEnabled(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (result) {
      unlockWorkspaceScroll();
    }
  }, [result]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === "history" && !historyLoaded && !historyLoading) {
      fetchHistory(authToken);
      return;
    }
    if (activeTab === "records" && !recordsLoaded && !recordsLoading) {
      fetchRecords(authToken);
    }
  }, [
    activeTab,
    isLoggedIn,
    historyLoaded,
    historyLoading,
    recordsLoaded,
    recordsLoading,
    authToken,
  ]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== "settings" || glossaryLoaded || glossaryLoading) return;
    fetchGlossary(authToken, { quiet: true });
  }, [activeTab, authToken, fetchGlossary, glossaryLoaded, glossaryLoading, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!usage && !usageLoading) {
      fetchUsage(authToken).catch(() => {});
    }
  }, [isLoggedIn, authToken, usage, usageLoading, fetchUsage]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(UI_THEME_KEY);
        const savedThemeMode = await AsyncStorage.getItem(UI_THEME_MODE_KEY);
        const savedPrivacyConsent = await AsyncStorage.getItem(PRIVACY_CONSENT_KEY);
        if (savedThemeMode === "manual" || savedThemeMode === "auto") {
          setThemeMode(savedThemeMode);
        }
        if (savedTheme && MOBILE_THEMES[savedTheme]) {
          setThemeKey(savedTheme);
        }
        const hasPrivacyConsent = savedPrivacyConsent === PRIVACY_POLICY_VERSION;
        setPrivacyAccepted(hasPrivacyConsent);
        setPrivacyConsentChecked(hasPrivacyConsent);
      } finally {
        if (active) setUiBootLoading(false);
      }
    })();

    return () => {
      active = false;
      clearScrollUnlockTimer();
      invalidatePollingSession();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(UI_THEME_KEY, themeKey).catch(() => {});
    AsyncStorage.setItem(UI_THEME_MODE_KEY, themeMode).catch(() => {});
  }, [themeKey, themeMode]);

  const pickAudioFile = async () => {
    clearMessages();
    resetResultWorkspace(true);

    try {
      const resultDoc = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "video/*"],
        multiple: false,
      });

      if (resultDoc.canceled || !resultDoc.assets?.length) return;

      const asset = resultDoc.assets[0];
      if ((asset.size || 0) > MAX_UPLOAD_BYTES) {
        setError(copy.errors.fileTooLarge);
        return;
      }

      const mimeType = inferMimeFromAsset(asset);
      const ext = getExtension(asset.name || "") || "mp3";

      setPickedFile({
        uri: asset.uri,
        name: asset.name || `upload.${ext}`,
        size: asset.size || 0,
        mimeType,
      });
      setNotice(copy.notices.fileSelected);
    } catch (e) {
      setError(e.message || copy.errors.filePickFailed);
    }
  };

  const startPollingTask = (taskId, expectedResultEpoch) => {
    stopPolling();
    const pollToken = pollTokenRef.current;
    activeTaskIdRef.current = taskId;
    pollStartedAtRef.current = Date.now();
    setTaskPhase("queued");
    setTaskStateText(copy.taskState.waiting);

    pollRef.current = setInterval(async () => {
      try {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return;

        const elapsed = Date.now() - (pollStartedAtRef.current || Date.now());
        if (elapsed > TRANSCRIBE_POLL_TIMEOUT_MS) {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskPhase("idle");
          setTaskStateText("");
          setError(copy.errors.transcribeLongRunning);
          setNotice(`${copy.taskId}: ${taskId}`);
          return;
        }

        const data = await requestApi(
          `/api/status/${taskId}`,
          isLoggedIn ? { token: authToken } : { headers: await getGuestHeaders() }
        );
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return;

        if (data.status === "queued") {
          setTaskPhase("queued");
          setTaskStateText(copy.taskState.queued);
          return;
        }

        if (data.status === "processing") {
          setTaskPhase("processing");
          setTaskStateText(copy.taskState.processing);
          return;
        }

        if (data.status === "completed") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskPhase("done");
          setTaskStateText(copy.taskState.done);
          if (expectedResultEpoch !== resultEpochRef.current) return;
          setResult(data);
          setNotice(copy.notices.transcribeDone);
          if (isLoggedIn) {
            fetchHistory(authToken);
            fetchUsage(authToken, { quiet: true }).catch(() => {});
          } else {
            fetchGuestUsage().catch(() => {});
          }
          return;
        }

        if (data.status === "error") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskPhase("idle");
          setTaskStateText("");
          setError(data.error || copy.errors.transcribeError);
          return;
        }

        if (data.status === "not_found") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskPhase("idle");
          setTaskStateText("");
          setError(copy.errors.taskNotFound);
        }
      } catch (e) {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return;
        stopPolling();
        activeTaskIdRef.current = "";
        setSubmitting(false);
        setTaskPhase("idle");
        setTaskStateText("");
        setError(e.message || copy.errors.statusFailed);
      }
    }, STATUS_POLL_INTERVAL_MS);
  };

  const handleTranscribe = async () => {
    clearMessages();

    if (!pickedFile) {
      setError(copy.errors.fileNotSelected);
      return;
    }

    invalidatePollingSession();
    const submitEpoch = resetResultWorkspace(true);
    setSubmitting(true);
    setTaskPhase("uploading");
    setTaskStateText(copy.taskState.uploading);

    try {
      const body = new FormData();
      body.append("file", {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType,
      });
      body.append("language", transcriptionLanguage);
      body.append("correct", "true");
      body.append("transcription_type", transcriptionType);
      body.append("correction_mode", "normal");

      const requestOptions = isLoggedIn
        ? { token: authToken }
        : { headers: await getGuestHeaders() };

      const data = await requestApi("/api/transcribe", {
        method: "POST",
        ...requestOptions,
        body,
      });
      if (!isLoggedIn && data?.quota) {
        setGuestUsage(data.quota);
      }

      if (data.status === "queued" && data.task_id) {
        startPollingTask(data.task_id, submitEpoch);
      } else if (data.status === "completed") {
        if (submitEpoch !== resultEpochRef.current) return;
        setSubmitting(false);
        setTaskPhase("done");
        setTaskStateText(copy.taskState.done);
        if (data.language) {
          setTranscriptionLanguage(String(data.language).toLowerCase());
        }
        setResult(data);
        if (isLoggedIn) {
          fetchHistory(authToken);
          fetchUsage(authToken, { quiet: true }).catch(() => {});
        } else {
          fetchGuestUsage().catch(() => {});
        }
      } else {
        setSubmitting(false);
        setTaskPhase("idle");
        setTaskStateText("");
        setNotice(data.message || copy.notices.requestAccepted);
      }
    } catch (e) {
      setSubmitting(false);
      setTaskPhase("idle");
      setTaskStateText("");
      setError(e.message || copy.errors.transcribeFailed);
    }
  };

  const handleLoadHistoryItem = async (taskId) => {
    clearMessages();
    unlockWorkspaceScroll();
    invalidatePollingSession();
    const loadEpoch = resetResultWorkspace(true);
    setSubmitting(true);
    setTaskPhase("historyLoading");
    setTaskStateText(copy.taskState.historyLoading);

    try {
      const data = await requestApi(`/api/status/${taskId}`, { token: authToken });
      if (data.status !== "completed") {
        throw new Error(copy.errors.historyLoadOnlyCompleted);
      }
      if (loadEpoch !== resultEpochRef.current) return;
      if (data.language) {
        setTranscriptionLanguage(String(data.language).toLowerCase());
      }
      setResult(data);
      setActiveTab("transcribe");
      setNotice(copy.notices.historyLoaded);
    } catch (e) {
      setError(e.message || copy.errors.historyLoadFailed);
    } finally {
      setSubmitting(false);
      setTaskPhase("idle");
      setTaskStateText("");
      unlockWorkspaceScroll();
    }
  };

  const handleDeleteHistoryItem = useCallback((taskId) => {
    if (!authToken) {
      setError(copy.errors.authRequired);
      return;
    }
    if (pendingHistoryDeleteTaskId !== taskId) {
      clearMessages();
      unlockWorkspaceScroll();
      armHistoryDeleteConfirm(taskId);
      return;
    }

    clearMessages();
    unlockWorkspaceScroll();
    clearHistoryDeleteConfirmTimer();
    setHistoryDeletingTaskId(taskId);
    (async () => {
      try {
        await requestApi(`/api/history/${taskId}`, {
          method: "DELETE",
          token: authToken,
        });

        setHistory((prev) => prev.filter((item) => item.task_id !== taskId));
        setHistoryLoaded(true);

        if ((result?.task_id || "") === taskId) {
          resetResultWorkspace(true);
        }

        setNotice(copy.notices.historyDeleted);
      } catch (e) {
        setError(e.message || copy.errors.historyDeleteFailed);
      } finally {
        setHistoryDeletingTaskId("");
        unlockWorkspaceScroll();
      }
    })();
  }, [armHistoryDeleteConfirm, authToken, clearHistoryDeleteConfirmTimer, clearMessages, copy.errors.authRequired, copy.errors.historyDeleteFailed, copy.notices.historyDeleteConfirmPrompt, copy.notices.historyDeleted, pendingHistoryDeleteTaskId, resetResultWorkspace, result?.task_id, setError, unlockWorkspaceScroll]);

  const handleDeleteAllHistory = useCallback(() => {
    if (!authToken) {
      setError(copy.errors.authRequired);
      return;
    }
    if (!pendingHistoryBulkDelete) {
      clearMessages();
      unlockWorkspaceScroll();
      armHistoryDeleteAllConfirm();
      return;
    }

    clearMessages();
    unlockWorkspaceScroll();
    clearHistoryDeleteAllConfirmTimer();
    setHistoryBulkDeleting(true);
    (async () => {
      try {
        const data = await requestApi("/api/history", {
          method: "DELETE",
          token: authToken,
        });

        const deletedTaskIds = Array.isArray(data?.deleted_task_ids) ? data.deleted_task_ids : [];
        const skippedActiveCount = Number(data?.skipped_active_count) || 0;
        const deletedCount = Number(data?.deleted_count) || deletedTaskIds.length;

        setHistory((prev) => prev.filter((item) => !deletedTaskIds.includes(item.task_id)));
        setHistoryLoaded(true);

        if (deletedTaskIds.includes(result?.task_id || "")) {
          resetResultWorkspace(true);
        }

        const successMessage = skippedActiveCount > 0
          ? copy.notices.historyClearedPartial
              .replace("{deletedCount}", String(deletedCount))
              .replace("{skippedCount}", String(skippedActiveCount))
          : copy.notices.historyCleared;

        setNotice(successMessage);
      } catch (e) {
        setError(e.message || copy.errors.historyDeleteAllFailed);
      } finally {
        setHistoryBulkDeleting(false);
        unlockWorkspaceScroll();
      }
    })();
  }, [armHistoryDeleteAllConfirm, authToken, clearHistoryDeleteAllConfirmTimer, clearMessages, copy.errors.authRequired, copy.errors.historyDeleteAllFailed, copy.notices.historyCleared, copy.notices.historyClearedPartial, copy.notices.historyDeleteAllConfirmPrompt, pendingHistoryBulkDelete, resetResultWorkspace, result?.task_id, setError, unlockWorkspaceScroll]);

  const resolveContentStyleKey = (payload) => {
    const explicit = String(payload?.content_style || "").trim().toLowerCase();
    if (explicit) return explicit === "conversation" ? "meeting" : explicit;
    const fallbackType = String(payload?.transcription_type || transcriptionType || "conversation").trim().toLowerCase();
    if (fallbackType === "conversation") return "meeting";
    return fallbackType;
  };

  const resolveTypeLabel = (payload) => {
    const styleKey = resolveContentStyleKey(payload);
    return (
      copy.contentStyles?.[styleKey] ||
      copy.transcriptionTypes?.[payload?.transcription_type] ||
      styleKey
    );
  };

  const transcriptSourceText = useMemo(
    () => String(result?.corrected_text || result?.raw_text || ""),
    [result?.corrected_text, result?.raw_text]
  );
  const transcriptHasUnsavedEdit = useMemo(
    () => Boolean(result) && compactTranscriptText(transcriptSourceText) !== compactTranscriptText(transcriptEditText),
    [result, transcriptEditText, transcriptSourceText]
  );
  const activeTranscriptText = result ? (transcriptEditText || transcriptSourceText) : "";
  const resultSectionValues = useMemo(() => {
    if (!result) return [];
    return buildResultSections({
      text: activeTranscriptText,
      summary: result.summary || "",
      typeLabel: resolveTypeLabel(result),
      copy,
    });
  }, [activeTranscriptText, copy, result, transcriptionType]);
  const processingStepIndex = Math.max(
    0,
    Math.min(PROCESSING_STEP_KEYS.length, TASK_PHASE_STEP_INDEX[taskPhase] ?? 0)
  );
  const showProcessingSteps = submitting && activeTab === "transcribe";

  useEffect(() => {
    setTranscriptEditText(transcriptSourceText);
  }, [result?.task_id, transcriptSourceText]);

  const resolveHistoryStatusLabel = useCallback((statusValue) => {
    const normalizedStatus = String(statusValue || "").trim().toLowerCase();
    return copy.historyStatusLabels?.[normalizedStatus] || normalizedStatus || "-";
  }, [copy.historyStatusLabels]);

  const handleSummarize = async () => {
    clearMessages();
    unlockWorkspaceScroll();

    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    const sourceText = activeTranscriptText;
    if (!sourceText.trim()) {
      setError(copy.errors.summaryNoText);
      return;
    }

    const summarizeEpoch = resultEpochRef.current;
    const sourceTaskId = result?.task_id || "";
    setSummaryLoading(true);

    try {
      const normalizedType = result?.transcription_type || transcriptionType || "conversation";
      const normalizedStyle = resolveContentStyleKey(result);
      const body = new FormData();
      body.append("text", sourceText);
      body.append("summary_type", "short");
      body.append("transcription_type", normalizedType);
      body.append("content_style", normalizedStyle);
      body.append("language", result?.language || transcriptionLanguage || "ko");

      const data = await requestApi("/api/summarize", {
        method: "POST",
        token: authToken,
        body,
      });

      if (summarizeEpoch !== resultEpochRef.current) return;
      setResult((prev) => {
        if (!prev) return prev;
        if (sourceTaskId && prev.task_id && prev.task_id !== sourceTaskId) return prev;
        return {
          ...prev,
          summary: data.summary || "",
          content_style: data.content_style || normalizedStyle,
        };
      });
      setNotice(copy.notices.summaryDone);
    } catch (e) {
      setError(e.message || copy.errors.summaryFailed);
    } finally {
      setSummaryLoading(false);
      unlockWorkspaceScroll();
    }
  };

  const handleGenerateRecordDraft = async (category) => {
    clearMessages();

    if (!isLoggedIn) {
      setError(copy.errors.draftNeedLogin);
      return;
    }

    const sourceText = activeTranscriptText;
    if (!sourceText.trim()) {
      setError(copy.errors.draftNoSource);
      return;
    }

    const draftEpoch = resultEpochRef.current;
    setDraftLoadingCategory(category);

    try {
      const body = new FormData();
      body.append("text", sourceText);
      body.append("category", category);
      body.append("language", result?.language || transcriptionLanguage || "ko");

      const data = await requestApi("/api/records/draft", {
        method: "POST",
        token: authToken,
        body,
      });

      if (draftEpoch !== resultEpochRef.current) return;
      const draftContent = data?.content || "";
      setRecordDrafts((prev) => ({ ...prev, [category]: draftContent }));
      setRecordDraftSources((prev) => ({
        ...prev,
        [category]: {
          originalText: draftContent,
          sourceText,
          taskId: result?.task_id || "",
          language: result?.language || transcriptionLanguage || "ko",
          transcriptionType: result?.transcription_type || transcriptionType,
        },
      }));
      const label = data?.category_label || copy.recordCategories[category] || category;
      setNotice(copy.notices.draftDone.replace("{label}", label));
    } catch (e) {
      setError(e.message || copy.errors.draftFailed);
    } finally {
      setDraftLoadingCategory("");
    }
  };

  const handleSaveRecord = async (category) => {
    clearMessages();

    if (!isLoggedIn) {
      setError(copy.errors.saveNeedLogin);
      return;
    }

    const content = (recordDrafts[category] || "").trim();
    if (!content) {
      setError(copy.errors.saveNoContent);
      return;
    }

    setSavingCategory(category);

    try {
      const draftSource = recordDraftSources[category] || {};
      const originalDraftText = String(draftSource.originalText || "").trim();
      const shouldCaptureCorrection = Boolean(originalDraftText && originalDraftText !== content);
      const body = new FormData();
      body.append("category", category);
      body.append("title", copy.recordCategories[category] || category);
      body.append("content", content);
      body.append("task_id", result?.task_id || "");
      body.append("source_type", result?.transcription_type || transcriptionType);
      if (shouldCaptureCorrection) {
        body.append("correction_original_text", originalDraftText);
        body.append("correction_language", draftSource.language || result?.language || transcriptionLanguage || "ko");
        body.append("correction_metadata_json", JSON.stringify({
          transcription_type: draftSource.transcriptionType || result?.transcription_type || transcriptionType,
          source_text_preview: String(draftSource.sourceText || "").slice(0, 1000),
        }));
      }

      const data = await requestApi("/api/records", {
        method: "POST",
        token: authToken,
        body,
      });

      await fetchRecords(authToken);
      const correctionSample = data?.correction_sample;
      if (shouldCaptureCorrection && (!correctionSample || correctionSample.success === false)) {
        try {
          await requestApi("/api/corrections", {
            method: "POST",
            token: authToken,
            body: JSON.stringify({
              source_type: "record_draft",
              category,
              language: draftSource.language || result?.language || transcriptionLanguage || "ko",
              task_id: draftSource.taskId || result?.task_id || "",
              original_text: originalDraftText,
              edited_text: content,
              metadata: {
                transcription_type: draftSource.transcriptionType || result?.transcription_type || transcriptionType,
                source_text_preview: String(draftSource.sourceText || "").slice(0, 1000),
              },
            }),
          });
        } catch (correctionError) {
          console.warn("Correction sample save failed:", correctionError?.message || correctionError);
        }
      }
      setNotice(copy.notices.recordSaved);
      setActiveTab("records");
    } catch (e) {
      setError(e.message || copy.errors.saveFailed);
    } finally {
      setSavingCategory("");
    }
  };

  const handleStartRecordEdit = useCallback((record) => {
    const recordId = String(record?.id || "");
    if (!recordId) return;
    setRecordEditDrafts((prev) => ({
      ...prev,
      [recordId]: String(record?.content || ""),
    }));
  }, []);

  const handleRecordEditChange = useCallback((recordId, value) => {
    const normalizedRecordId = String(recordId || "");
    if (!normalizedRecordId) return;
    setRecordEditDrafts((prev) => ({
      ...prev,
      [normalizedRecordId]: value,
    }));
  }, []);

  const handleCancelRecordEdit = useCallback((recordId) => {
    const normalizedRecordId = String(recordId || "");
    if (!normalizedRecordId) return;
    setRecordEditDrafts((prev) => {
      const next = { ...prev };
      delete next[normalizedRecordId];
      return next;
    });
  }, []);

  const handleUpdateRecord = useCallback(async (record) => {
    clearMessages();

    if (!isLoggedIn) {
      setError(copy.errors.saveNeedLogin);
      return;
    }

    const recordId = String(record?.id || "");
    if (!recordId) {
      setError(copy.errors.recordUpdateFailed);
      return;
    }

    const editedText = String(recordEditDrafts[recordId] || "").trim();
    if (!editedText) {
      setError(copy.errors.saveNoContent);
      return;
    }

    const originalText = String(record?.content || "").trim();
    if (compactTranscriptText(originalText) === compactTranscriptText(editedText)) {
      handleCancelRecordEdit(recordId);
      setNotice(copy.notices.correctionNoChange);
      return;
    }

    setRecordSavingId(recordId);
    try {
      const data = await requestApi(`/api/records/${encodeURIComponent(recordId)}`, {
        method: "PUT",
        token: authToken,
        body: JSON.stringify({
          title: record?.title || record?.category || copy.recordsTitle,
          content: editedText,
          language: result?.language || transcriptionLanguage || "ko",
        }),
      });
      const updatedRecord = data?.record || { ...record, content: editedText };
      setRecords((prev) => prev.map((item) => (String(item.id || "") === recordId ? updatedRecord : item)));
      handleCancelRecordEdit(recordId);

      setNotice(copy.notices.recordUpdated);
    } catch (e) {
      setError(e.message || copy.errors.recordUpdateFailed);
    } finally {
      setRecordSavingId("");
    }
  }, [authToken, clearMessages, copy.errors.recordUpdateFailed, copy.errors.saveNeedLogin, copy.errors.saveNoContent, copy.notices.correctionNoChange, copy.notices.recordUpdated, copy.recordsTitle, handleCancelRecordEdit, isLoggedIn, recordEditDrafts, result?.language, transcriptionLanguage]);

  const handleResetTranscriptEdit = () => {
    setTranscriptEditText(transcriptSourceText);
  };

  const handleSaveTranscriptCorrection = async () => {
    clearMessages();

    if (!isLoggedIn) {
      setError(copy.errors.correctionNeedLogin);
      return;
    }

    const originalText = transcriptSourceText.trim();
    const editedText = String(transcriptEditText || "").trim();
    if (!originalText || !editedText) {
      setError(copy.errors.correctionNoText);
      return;
    }
    if (compactTranscriptText(originalText) === compactTranscriptText(editedText)) {
      setNotice(copy.notices.correctionNoChange);
      return;
    }

    setTranscriptEditSaving(true);

    try {
      await requestApi("/api/corrections", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({
          source_type: "transcript_edit",
          category: result?.transcription_type || transcriptionType,
          language: result?.language || transcriptionLanguage || "ko",
          task_id: result?.task_id || "",
          original_text: originalText,
          edited_text: editedText,
          metadata: {
            content_style: resolveContentStyleKey(result),
            source: "mobile_transcript_editor",
          },
        }),
      });

      setResult((prev) => {
        if (!prev) return prev;
        if (result?.task_id && prev.task_id && prev.task_id !== result.task_id) return prev;
        return {
          ...prev,
          corrected_text: editedText,
          characters: editedText.length,
        };
      });
      setTranscriptEditText(editedText);
      setNotice(copy.notices.correctionSaved);
    } catch (e) {
      setError(e.message || copy.errors.correctionSaveFailed);
    } finally {
      setTranscriptEditSaving(false);
    }
  };

  const resolveExportContent = (text) => (text || "").trim();

  const handleCopyToClipboard = (label, text) => {
    clearMessages();
    const content = resolveExportContent(text);
    if (!content) {
      setError(copy.errors.noExportContent);
      return;
    }

    try {
      if (!Clipboard || typeof Clipboard.setString !== "function") {
        throw new Error(copy.errors.clipboardFailed);
      }
      Clipboard.setString(content);
      setNotice(copy.notices.copiedToClipboard.replace("{label}", label));
    } catch (e) {
      setError(e.message || copy.errors.clipboardFailed);
    }
  };

  const handleShareExport = async (label, text, format = "txt") => {
    clearMessages();
    const content = resolveExportContent(text);
    if (!content) {
      setError(copy.errors.noExportContent);
      return;
    }

    try {
      const FileSystem = require("expo-file-system/legacy");
      const Sharing = require("expo-sharing");
      if (!FileSystem?.cacheDirectory || typeof FileSystem.writeAsStringAsync !== "function") {
        throw new Error(copy.errors.exportModuleMissing);
      }
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(copy.errors.shareUnavailable);
      }

      const ext = format === "docx" ? "docx" : "txt";
      const exportFileName = `${sanitizeFileName(label)}_${Date.now()}.${ext}`;
      const fileUri = `${FileSystem.cacheDirectory}${exportFileName}`;

      if (format === "docx") {
        const base64Docx = buildDocxBase64(label, content);
        await FileSystem.writeAsStringAsync(fileUri, base64Docx, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:
          format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "text/plain",
        dialogTitle: exportFileName,
        UTI: format === "docx" ? "org.openxmlformats.wordprocessingml.document" : "public.plain-text",
      });
      setNotice(format === "docx" ? copy.notices.openedShareDocx : copy.notices.openedShareTxt);
    } catch (e) {
      setError(e.message || copy.errors.shareFailed);
    }
  };

  const selectedTypeHint = useMemo(() => {
    return copy.selectedTypeHints[transcriptionType] || "";
  }, [copy, transcriptionType]);
  const summaryButtonLabel = useMemo(() => {
    const key = resolveContentStyleKey(result);
    return copy.generateSummaryByType?.[key] || copy.generateSummary;
  }, [copy, result, transcriptionType]);

  const applyThemeOption = (optionKey) => {
    if (optionKey === "auto") {
      setThemeMode("auto");
    } else if (optionKey === "light") {
      setThemeMode("manual");
      setThemeKey("aurora");
    } else {
      setThemeMode("manual");
      setThemeKey("noir");
    }
    setOpenSettingsMenu("");
  };

  const openLegalDocument = (documentType) => {
    const normalizedType = documentType === "company-policy" ? "companyPolicy" : documentType;
    if (!legalDocs[normalizedType]) return;
    setOpenSettingsMenu("");
    setLegalModalDocType(normalizedType);
  };

  const closeLegalDocument = () => {
    setLegalModalDocType("");
  };

  const handleAcceptPrivacyPolicy = async () => {
    if (privacyConsentSaving || !privacyConsentChecked) return;

    setPrivacyConsentSaving(true);
    try {
      await AsyncStorage.setItem(PRIVACY_CONSENT_KEY, PRIVACY_POLICY_VERSION);
      setPrivacyAccepted(true);
      setNotice(copy.notices.privacyAccepted);
      setError("");
    } catch {
      setError(copy.errors.privacySaveFailed);
    } finally {
      setPrivacyConsentSaving(false);
    }
  };

  const renderQuickControls = () => (
    <View style={styles.quickControlsWrap}>
      <View style={[styles.quickControlsRow, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
        <NmPressable
          style={[styles.quickIconButton, { borderColor: activeTheme.inputBorder }]}
          onPress={() => setOpenSettingsMenu((prev) => (prev === "language" ? "" : "language"))}
          accessibilityLabel={copy.languageOptionEn}
        >
          <Text style={[styles.quickIconText, { color: activeTheme.textPrimary }]}>🌐</Text>
        </NmPressable>
        <NmPressable
          style={[styles.quickIconButton, { borderColor: activeTheme.inputBorder }]}
          onPress={() => setOpenSettingsMenu((prev) => (prev === "theme" ? "" : "theme"))}
          accessibilityLabel="Theme menu"
        >
          <Text style={[styles.quickIconText, { color: activeTheme.textPrimary }]}>◐</Text>
        </NmPressable>
      </View>

      {openSettingsMenu === "language" ? (
        <View style={[styles.quickMenu, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
          <NmPressable
            style={[styles.quickMenuItem, uiLanguage === "ko" ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              setUiLanguage("ko");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: uiLanguage === "ko" ? activeTheme.accent : activeTheme.textPrimary }]}>
              {copy.languageOptionKo}
            </Text>
          </NmPressable>
          <NmPressable
            style={[styles.quickMenuItem, uiLanguage === "en" ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              setUiLanguage("en");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: uiLanguage === "en" ? activeTheme.accent : activeTheme.textPrimary }]}>
              {copy.languageOptionEn}
            </Text>
          </NmPressable>
        </View>
      ) : null}

      {openSettingsMenu === "theme" ? (
        <View style={[styles.quickMenu, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
          {MOBILE_THEME_OPTIONS.map((themeOption) => {
            const active =
              themeOption.key === "auto"
                ? themeMode === "auto"
                : themeMode === "manual" && themeOption.targetTheme === themeKey;
            return (
              <NmPressable
                key={themeOption.key}
                style={[styles.quickMenuItem, active ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
                onPress={() => applyThemeOption(themeOption.key)}
              >
                <Text style={[styles.quickMenuText, { color: active ? activeTheme.accent : activeTheme.textPrimary }]}>
                  {themeOption.label}
                </Text>
              </NmPressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const renderUsageSummaryBar = () => {
    const hasUsage = Boolean(effectiveUsage);
    const usedLabel = isFreeUsagePlan
      ? `${formatSecondsToHourMinute(usedAudioSeconds)} / ${formatSecondsToHourMinute(monthlyLimitSeconds)}`
      : `${formatSecondsToHourMinute(usedAudioSeconds)} / ${copy.usageUnlimited}`;
    const remainingLabel = isFreeUsagePlan
      ? `${copy.usageRemaining}: ${formatSecondsToHourMinute(remainingAudioSeconds)}`
      : copy.usageUnlimited;
    const progressWidth = isFreeUsagePlan ? `${usagePercent}%` : "100%";
    const ctaLabel = isFreeUsagePlan ? (copy.planLabels?.pro || "Pro") : planLabel;

    return (
      <FadeInView delay={40} duration={260}>
        <NmPressable
          style={[styles.topUsageCard, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
          onPress={() => setActiveTab("settings")}
        >
          <View style={styles.topUsageHeader}>
            <View style={styles.topUsageTextBlock}>
              <Text style={[styles.topUsageLabel, { color: activeTheme.textSecondary }]}>{copy.usageThisMonth}</Text>
              <Text style={[styles.topUsageValue, { color: activeTheme.textPrimary }]}>
                {hasUsage ? usedLabel : copy.usageLoading}
              </Text>
            </View>
            <View style={[styles.topUsagePill, { backgroundColor: activeTheme.noticeBg, borderColor: activeTheme.accent }]}>
              <Text style={[styles.topUsagePillText, { color: activeTheme.accent }]}>{ctaLabel}</Text>
            </View>
          </View>
          <View style={[styles.topUsageProgressTrack, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
            <View style={[styles.topUsageProgressFill, { backgroundColor: activeTheme.accent, width: hasUsage ? progressWidth : "12%" }]} />
          </View>
          <Text style={[styles.topUsageRemaining, { color: activeTheme.textSecondary }]}>
            {hasUsage ? remainingLabel : copy.usageUnavailable}
          </Text>
        </NmPressable>
      </FadeInView>
    );
  };

  const renderProcessingSteps = () => {
    if (!showProcessingSteps) return null;
    const progressWidth = taskPhase === "done"
      ? "100%"
      : `${Math.min(100, Math.max(12, ((processingStepIndex + 0.45) / PROCESSING_STEP_KEYS.length) * 100))}%`;
    const activeTypeLabel = copy.transcriptionTypes?.[transcriptionType] || transcriptionType;

    return (
      <View style={[styles.processingPanel, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
        <View style={styles.processingHeader}>
          <View style={[styles.processingMark, { backgroundColor: activeTheme.noticeBg, borderColor: activeTheme.accent }]}>
            <Text style={[styles.processingMarkText, { color: activeTheme.accent }]}>AI</Text>
          </View>
          <View style={styles.processingHeaderText}>
            <Text style={[styles.processingTitle, { color: activeTheme.textPrimary }]}>{copy.processingTitle}</Text>
            <Text style={[styles.processingSubcopy, { color: activeTheme.textSecondary }]}>
              {activeTypeLabel} · {taskStateText || copy.processingSubcopy}
            </Text>
          </View>
        </View>

        <View style={styles.processingStepList}>
          {PROCESSING_STEP_KEYS.map((stepKey, index) => {
            const done = taskPhase === "done" || index < processingStepIndex;
            const active = taskPhase !== "done" && index === processingStepIndex;
            return (
              <View key={stepKey} style={styles.processingStepRow}>
                <View
                  style={[
                    styles.processingStepDot,
                    done ? styles.processingStepDotDone : active ? styles.processingStepDotActive : styles.processingStepDotWait,
                    { borderColor: done ? "#4ADE80" : active ? activeTheme.accent : activeTheme.inputBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.processingStepDotText,
                      { color: done ? "#16A34A" : active ? activeTheme.accent : activeTheme.textSecondary },
                    ]}
                  >
                    {done ? "✓" : active ? "•" : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.processingStepText,
                    { color: active ? activeTheme.textPrimary : activeTheme.textSecondary },
                    active ? styles.processingStepTextActive : null,
                  ]}
                >
                  {copy.processingSteps?.[stepKey] || stepKey}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.processingProgressTrack, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
          <View style={[styles.processingProgressFill, { backgroundColor: activeTheme.accent, width: progressWidth }]} />
        </View>
      </View>
    );
  };

  if (bootLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={["top", "right", "bottom", "left"]} style={[styles.centerScreen, { backgroundColor: activeTheme.bg }]}>
          <StatusBar style={resolvedThemeKey === "noir" ? "light" : "dark"} />
          <View pointerEvents="none" style={styles.softBackground}>
            <View style={[styles.softGlowOrbA, { backgroundColor: activeTheme.glowA }]} />
            <View style={[styles.softGlowOrbB, { backgroundColor: activeTheme.glowB }]} />
          </View>
          <ActivityIndicator size="large" color={activeTheme.accent} />
          <Text style={[styles.loadingText, { color: activeTheme.textPrimary }]}>{copy.loadingApp}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top", "right", "bottom", "left"]} style={[styles.root, { backgroundColor: activeTheme.bg }]}>
        <StatusBar style={resolvedThemeKey === "noir" ? "light" : "dark"} />

      <View
        style={[styles.appShell, isPrivacyGateVisible ? styles.appShellBlocked : null]}
        pointerEvents={isPrivacyGateVisible ? "none" : "auto"}
        importantForAccessibility={isPrivacyGateVisible ? "no-hide-descendants" : "auto"}
      >
      <View pointerEvents="none" style={styles.softBackground}>
        <View style={[styles.softGlowOrbA, { backgroundColor: activeTheme.glowA }]} />
        <View style={[styles.softGlowOrbB, { backgroundColor: activeTheme.glowB }]} />
        <View style={[styles.softGlowOrbC, { backgroundColor: activeTheme.glowC }]} />
      </View>

      <Banner type="error" text={error} />
      <Banner type="notice" text={notice} />
      {!activeLegalDoc ? renderQuickControls() : null}

      {activeLegalDoc ? (
        <View style={styles.legalPageContainer}>
          <FadeInView duration={220}>
            <View style={[styles.legalPageHeader, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <Text
                style={[
                  styles.privacyTitle,
                  compactLayout ? styles.privacyTitleCompact : null,
                  tinyLayout ? styles.privacyTitleTiny : null,
                  modalTextStyles.title,
                  { color: activeTheme.textPrimary },
                ]}
              >
                {activeLegalDoc.title}
              </Text>
              <NmPressable
                style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                onPress={closeLegalDocument}
              >
                <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.close}</Text>
              </NmPressable>
            </View>
          </FadeInView>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <FadeInView delay={80} duration={240}>
              <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                <Text
                  style={[
                    styles.legalUpdatedText,
                    tinyLayout ? styles.legalUpdatedTextTiny : null,
                    modalTextStyles.meta,
                    { color: activeTheme.textSecondary },
                  ]}
                >
                  {`${activeLegalDoc.updatedAt}${activeLegalDoc.version ? ` · ${copy.legal.docVersion}: ${activeLegalDoc.version}` : ""}`}
                </Text>

                {activeLegalDoc.sections.map((section) => (
                  <View
                    key={`${activeLegalDoc.title}-${section.title}`}
                    style={[
                      styles.legalSectionBox,
                      tinyLayout ? styles.legalSectionBoxTiny : null,
                      { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.legalSectionTitle,
                        tinyLayout ? styles.legalSectionTitleTiny : null,
                        modalTextStyles.sectionTitle,
                        { color: activeTheme.textPrimary },
                      ]}
                    >
                      {section.title}
                    </Text>
                    {section.body.map((line, index) => (
                      <Text
                        key={`${section.title}-${index}`}
                        style={[
                          styles.legalSectionBody,
                          tinyLayout ? styles.legalSectionBodyTiny : null,
                          modalTextStyles.sectionBody,
                          { color: activeTheme.textPrimary },
                        ]}
                      >
                        • {line}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </FadeInView>
          </ScrollView>
        </View>
      ) : !isLoggedIn && !guestModeStarted ? (
        <ScrollView
          contentContainerStyle={[styles.authScrollContent, compactLayout ? styles.authScrollContentCompact : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView duration={280}>
            <View
              style={[
                styles.card,
                styles.authCard,
                compactLayout ? styles.authCardCompact : null,
                { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
              ]}
            >
              <View style={styles.authLandingBadgeRow}>
                {authLandingBadges.map((badge) => (
                  <View key={`auth-badge-${badge}`} style={[styles.authLandingBadge, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.authLandingBadgeText, { color: activeTheme.textSecondary }]}>{badge}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.authLandingHeroTitle, { color: activeTheme.textPrimary }]}>
                {copy.authLanding.hero}
              </Text>
              <Text style={[styles.authLandingHeroSubcopy, { color: activeTheme.textSecondary }]}>
                {copy.authLanding.subcopy}
              </Text>

              <View style={styles.authLandingExampleGrid}>
                <View style={[styles.authLandingExampleCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.authLandingExampleLabel, { color: activeTheme.textSecondary }]}>{copy.authLanding.beforeLabel}</Text>
                  <Text style={[styles.authLandingExampleBody, { color: activeTheme.textSecondary }]}>{copy.authLanding.beforeExample}</Text>
                </View>
                <View style={[styles.authLandingExampleCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.authLandingExampleLabel, { color: activeTheme.textSecondary }]}>{copy.authLanding.afterLabel}</Text>
                  <Text style={[styles.authLandingAfterTitle, { color: activeTheme.textPrimary }]}>{copy.authLanding.afterTitle}</Text>
                  <View style={styles.authLandingAfterList}>
                    {copy.authLanding.afterBullets.map((line) => (
                      <Text key={`after-${line}`} style={[styles.authLandingAfterItem, { color: activeTheme.textSecondary }]}>
                        - {line}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[styles.authLandingActionRow, compactLayout ? styles.authLandingActionRowCompact : null]}>
                <NmPressable
                  style={[styles.secondaryButton, styles.authLandingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={handleOpenOurs}
                >
                  <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.authLanding.oursCta}</Text>
                </NmPressable>
              </View>
            </View>
          </FadeInView>

          <FadeInView delay={60} duration={280}>
            <View style={[styles.authLandingFeatureGrid, styles.authCard, compactLayout ? styles.authCardCompact : null]}>
              {copy.authLanding.featureCards.map((feature) => (
                <View
                  key={`feature-${feature.title}`}
                  style={[styles.card, styles.authLandingFeatureCard, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                >
                  <Text style={[styles.authLandingFeatureTitle, { color: activeTheme.textPrimary }]}>{feature.title}</Text>
                  <Text style={[styles.authLandingFeatureBody, { color: activeTheme.textSecondary }]}>{feature.body}</Text>
                </View>
              ))}
            </View>
          </FadeInView>

          <FadeInView delay={110} duration={280}>
            <View
              style={[
                styles.card,
                styles.authCard,
                compactLayout ? styles.authCardCompact : null,
                { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
              ]}
            >
              <Text style={[styles.authLandingTestimonialLabel, { color: activeTheme.accent }]}>{copy.authLanding.testimonialLabel}</Text>
              <View style={styles.authLandingTestimonialGrid}>
                {copy.authLanding.testimonials.map((quote) => (
                  <View
                    key={`quote-${quote}`}
                    style={[styles.authLandingTestimonialCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}
                  >
                    <Text style={[styles.authLandingTestimonialText, { color: activeTheme.textPrimary }]}>{quote}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeInView>

          <FadeInView delay={150} duration={320}>
            <View
              style={[
                styles.card,
                styles.authCard,
                compactLayout ? styles.authCardCompact : null,
                compactLayout ? styles.cardCompact : null,
                { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
              ]}
            >
              <Text style={[styles.authIntro, compactLayout ? styles.authIntroCompact : null, { color: activeTheme.textPrimary }]}>
                {copy.authIntro}
              </Text>
              <Text style={[styles.authSubcopy, { color: activeTheme.textSecondary }]}>
                {copy.authSubcopy}
              </Text>

              <View style={styles.segmentRow}>
                <SegmentButton label={copy.login} active={authMode === "login"} onPress={() => setAuthMode("login")} theme={activeTheme} />
                <SegmentButton label={copy.signup} active={authMode === "signup"} onPress={() => setAuthMode("signup")} theme={activeTheme} />
              </View>

              {authMode === "signup" ? (
                <TextInput
                  style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder={copy.namePlaceholder}
                  placeholderTextColor={activeTheme.textSecondary}
                  autoCapitalize="none"
                />
              ) : null}

              <TextInput
                style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder={copy.emailPlaceholder}
                placeholderTextColor={activeTheme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder={copy.passwordPlaceholder}
                placeholderTextColor={activeTheme.textSecondary}
                secureTextEntry
              />

              <NmPressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                  authLoading ? styles.buttonDisabled : null,
                ]}
                onPress={handleAuthSubmit}
                disabled={authLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {authLoading
                    ? copy.processing
                  : authMode === "signup"
                      ? copy.signup
                      : copy.login}
                </Text>
              </NmPressable>

              <NmPressable
                style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                onPress={() => {
                  clearMessages();
                  setGuestModeStarted(true);
                  setActiveTab("transcribe");
                  fetchGuestUsage().catch(() => {});
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>
                  {copy.guestTrialCta}
                </Text>
              </NmPressable>
              <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>
                {copy.guestUserSubtitle}
              </Text>

              <Text style={[styles.orText, { color: activeTheme.textSecondary }]}>{copy.orSocial}</Text>

              <View style={styles.socialRow}>
                {Platform.OS === "ios" ? (
                  <SocialAuthButton
                    provider="apple"
                    label={copy.continueApple}
                    loading={socialLoading === "apple"}
                    loadingLabel={copy.connecting}
                    onPress={() => handleSocialLogin("apple")}
                    disabled={!!socialLoading}
                  />
                ) : null}

                {!isIosAppStoreReviewMode ? (
                  <>
                    <SocialAuthButton
                      provider="google"
                      label={copy.continueGoogle}
                      loading={socialLoading === "google"}
                      loadingLabel={copy.connecting}
                      onPress={() => handleSocialLogin("google")}
                      disabled={!!socialLoading}
                    />

                    <SocialAuthButton
                      provider="kakao"
                      label={copy.continueKakao}
                      loading={socialLoading === "kakao"}
                      loadingLabel={copy.connecting}
                      onPress={() => handleSocialLogin("kakao")}
                      disabled={!!socialLoading}
                    />
                  </>
                ) : null}
              </View>
            </View>
          </FadeInView>
        </ScrollView>
      ) : (
        <View style={styles.workspaceContainer}>
          <FadeInView>
            <View style={[styles.userBar, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <View style={styles.userInfo}>
                <Text style={[styles.userEmail, { color: activeTheme.textPrimary }]}>
                  {isGuestMode ? copy.guestUserTitle : (authUser?.email || copy.defaultUser)}
                </Text>
                <Text style={[styles.userName, { color: activeTheme.textSecondary }]}>
                  {isGuestMode ? copy.guestUserSubtitle : (authUser?.user_metadata?.full_name || authUser?.id || "")}
                </Text>
                {!isGuestMode ? (
                  <Text style={[styles.userSession, { color: activeTheme.textSecondary }]}>
                    {copy.sessionRemainingLabel}: {sessionRemainingLabel}
                  </Text>
                ) : null}
              </View>
              <NmPressable
                style={[styles.logoutButton, { borderColor: activeTheme.inputBorder }]}
                onPress={isGuestMode ? () => {
                  clearMessages();
                  setGuestModeStarted(false);
                  setActiveTab("transcribe");
                } : handleLogout}
              >
                <Text style={[styles.logoutButtonText, { color: isGuestMode ? activeTheme.accent : activeTheme.errorText }]}>
                  {isGuestMode ? copy.login : copy.logout}
                </Text>
              </NmPressable>
            </View>
          </FadeInView>

          <FadeInView delay={70} duration={360}>
            <View style={[styles.tabsWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.segmentScroll}
                contentContainerStyle={[styles.segmentRow, styles.segmentScrollContent]}
              >
                {tabOptions.map((tab) => (
                  <SegmentButton
                    key={tab.key}
                    label={tab.label}
                    active={activeTab === tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    theme={activeTheme}
                  />
                ))}
              </ScrollView>
            </View>
          </FadeInView>

          {renderUsageSummaryBar()}

          {activeTab === "transcribe" ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled={workspaceScrollEnabled}
            >
              <FadeInView key="transcribe-language">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcriptionLanguageLabel}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.segmentScroll}
                    contentContainerStyle={[styles.segmentRow, styles.segmentScrollContent]}
                  >
                    <SegmentButton
                      label={copy.transcriptionLanguageOptionKo}
                      active={transcriptionLanguage === "ko"}
                      onPress={() => setTranscriptionLanguage("ko")}
                      theme={activeTheme}
                    />
                    <SegmentButton
                      label={copy.transcriptionLanguageOptionEn}
                      active={transcriptionLanguage === "en"}
                      onPress={() => setTranscriptionLanguage("en")}
                      theme={activeTheme}
                    />
                    <SegmentButton
                      label={copy.transcriptionLanguageOptionJa}
                      active={transcriptionLanguage === "ja"}
                      onPress={() => setTranscriptionLanguage("ja")}
                      theme={activeTheme}
                    />
                  </ScrollView>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.transcriptionLanguageHint}</Text>
                </View>
              </FadeInView>

              <FadeInView key="transcribe-settings">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcribeSettings}</Text>

                  <View style={styles.typeCardGrid}>
                    {transcriptionTypeOptions.map((item) => (
                      <NmPressable
                        key={item.key}
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: transcriptionType === item.key ? activeTheme.noticeBg : activeTheme.inputBg,
                            borderColor: transcriptionType === item.key ? activeTheme.accent : activeTheme.inputBorder,
                          },
                        ]}
                        onPress={() => setTranscriptionType(item.key)}
                      >
                        <View
                          style={[
                            styles.typeCardIcon,
                            {
                              backgroundColor: transcriptionType === item.key ? activeTheme.accent : activeTheme.surface,
                              borderColor: transcriptionType === item.key ? activeTheme.accent : activeTheme.inputBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.typeCardIconText, { color: transcriptionType === item.key ? "#ffffff" : activeTheme.textSecondary }]}>
                            {TRANSCRIPTION_TYPE_CARD_META[item.key]?.icon || item.label.slice(0, 1)}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.typeCardLabel,
                            { color: transcriptionType === item.key ? activeTheme.accent : activeTheme.textSecondary },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </NmPressable>
                    ))}
                  </View>

                  <NmPressable
                    style={[
                      styles.uploadZone,
                      {
                        backgroundColor: activeTheme.inputBg,
                        borderColor: pickedFile ? activeTheme.accent : activeTheme.inputBorder,
                      },
                    ]}
                    onPress={pickAudioFile}
                  >
                    <Text style={[styles.uploadZoneIcon, { color: activeTheme.accent }]}>↑</Text>
                    <Text style={[styles.uploadZoneTitle, { color: activeTheme.textPrimary }]}>
                      {pickedFile ? `${copy.selectedFileLabel}: ${pickedFile.name}` : copy.uploadZoneTitle}
                    </Text>
                    <Text style={[styles.uploadZoneHint, { color: activeTheme.textSecondary }]}>
                      {pickedFile
                        ? `${Math.max(1, Math.round((pickedFile.size || 0) / 1024))} KB · ${pickedFile.mimeType}`
                        : copy.uploadZoneHint}
                    </Text>
                  </NmPressable>

                  <NmPressable
                    style={[
                      styles.startTranscribeButton,
                      { backgroundColor: activeTheme.textPrimary, borderColor: activeTheme.textPrimary },
                      submitting ? styles.buttonDisabled : null,
                    ]}
                    onPress={handleTranscribe}
                    disabled={submitting}
                  >
                    <Text style={[styles.startTranscribeButtonText, { color: activeTheme.bg }]}>
                      {submitting ? copy.transcribing : copy.transcribeStart}
                    </Text>
                  </NmPressable>

                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{selectedTypeHint}</Text>
                  {isGuestMode ? (
                    <Text style={[styles.helpText, { color: activeTheme.accent }]}>{copy.guestTrialHint}</Text>
                  ) : null}
                  {renderProcessingSteps()}
                </View>
              </FadeInView>

              {result ? (
                <FadeInView key="transcribe-result" delay={100}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <View style={styles.resultHeaderBlock}>
                      <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcribeResult}</Text>
                      <View style={styles.resultMetaRow}>
                        <View style={[styles.resultTag, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.resultTagText, { color: activeTheme.textSecondary }]}>{resolveTypeLabel(result)}</Text>
                        </View>
                        <View style={[styles.resultTag, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.resultTagText, { color: activeTheme.textSecondary }]}>
                            {Number(result.characters || 0).toLocaleString()}{uiLanguage === "en" ? " chars" : "자"}
                          </Text>
                        </View>
                        <View style={[styles.resultTag, { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "rgba(74,222,128,0.38)" }]}>
                          <Text style={[styles.resultTagText, { color: "#16A34A" }]}>{copy.taskState.done}</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.taskId}: {result.task_id}</Text>
                    </View>

                    <View style={[styles.resultSectionCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      {resultSectionValues.map((section, index) => (
                        <View key={section.key}>
                          <View style={styles.resultSectionRow}>
                            <Text style={[styles.resultSectionKey, { color: activeTheme.textSecondary }]}>{section.label}</Text>
                            <Text selectable style={[styles.resultSectionValue, { color: activeTheme.textPrimary }]}>
                              {section.value}
                            </Text>
                          </View>
                          {index < resultSectionValues.length - 1 ? (
                            <View style={[styles.resultSectionDivider, { backgroundColor: activeTheme.inputBorder }]} />
                          ) : null}
                        </View>
                      ))}
                    </View>

                    <View style={[styles.resultEditPanel, { backgroundColor: activeTheme.surfaceSoft || activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      <View style={styles.transcriptEditHeader}>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>
                          {copy.transcriptEditTitle} · {transcriptHasUnsavedEdit ? copy.transcriptEditChanged : copy.transcriptEditSaved}
                        </Text>
                      </View>
                      <TextInput
                        multiline
                        scrollEnabled
                        textAlignVertical="top"
                        value={transcriptEditText}
                        onChangeText={setTranscriptEditText}
                        style={[
                          styles.resultBox,
                          styles.resultEditor,
                          { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary, height: resultEditorHeight },
                        ]}
                        onTouchStart={lockWorkspaceScroll}
                        onTouchEnd={unlockWorkspaceScroll}
                        onTouchCancel={unlockWorkspaceScroll}
                        onFocus={lockWorkspaceScroll}
                        onBlur={unlockWorkspaceScroll}
                      />
                      <View style={styles.exportActionRow}>
                        <NmPressable
                          style={[
                            styles.tinyButton,
                            styles.exportTinyButton,
                            { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                            (transcriptEditSaving || !transcriptHasUnsavedEdit) ? styles.buttonDisabled : null,
                          ]}
                          onPress={handleSaveTranscriptCorrection}
                          disabled={transcriptEditSaving || !transcriptHasUnsavedEdit}
                        >
                          <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>
                            {transcriptEditSaving ? copy.transcriptEditSaving : copy.transcriptEditSave}
                          </Text>
                        </NmPressable>
                        <NmPressable
                          style={[
                            styles.tinyButton,
                            styles.exportTinyButton,
                            { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                            !transcriptHasUnsavedEdit ? styles.buttonDisabled : null,
                          ]}
                          onPress={handleResetTranscriptEdit}
                          disabled={!transcriptHasUnsavedEdit}
                        >
                          <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.transcriptEditReset}</Text>
                        </NmPressable>
                      </View>
                    </View>

                    <View style={styles.resultExportGrid}>
                      <NmPressable
                        style={[styles.resultExportButton, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}
                        onPress={() => handleCopyToClipboard(copy.correctedText, activeTranscriptText)}
                      >
                        <Text style={[styles.resultExportIcon, { color: activeTheme.textSecondary }]}>C</Text>
                        <Text numberOfLines={1} style={[styles.resultExportLabel, { color: activeTheme.textSecondary }]}>{copy.exportCopyShort}</Text>
                      </NmPressable>
                      <NmPressable
                        style={[styles.resultExportButton, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}
                        onPress={() => handleShareExport(copy.correctedText, activeTranscriptText, "txt")}
                      >
                        <Text style={[styles.resultExportIcon, { color: activeTheme.textSecondary }]}>T</Text>
                        <Text numberOfLines={1} style={[styles.resultExportLabel, { color: activeTheme.textSecondary }]}>{copy.exportTxtShort}</Text>
                      </NmPressable>
                      <NmPressable
                        style={[
                          styles.resultExportButton,
                          styles.resultExportButtonPrimary,
                          { backgroundColor: activeTheme.noticeBg, borderColor: activeTheme.accent },
                        ]}
                        onPress={() => handleShareExport(copy.correctedText, activeTranscriptText, "docx")}
                      >
                        <Text style={[styles.resultExportIcon, { color: activeTheme.accent }]}>D</Text>
                        <Text numberOfLines={1} style={[styles.resultExportLabel, styles.resultExportLabelPrimary, { color: activeTheme.accent }]}>{copy.exportDocxShort}</Text>
                      </NmPressable>
                    </View>

                    <NmPressable
                      style={[
                        styles.secondaryButton,
                        { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                        summaryLoading ? styles.buttonDisabled : null,
                      ]}
                      onPress={handleSummarize}
                      disabled={summaryLoading}
                    >
                      <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{summaryLoading ? copy.generatingSummary : summaryButtonLabel}</Text>
                    </NmPressable>

                  </View>
                </FadeInView>
              ) : null}

              {result ? (
                <FadeInView key="transcribe-records" delay={200}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.recordGenerateSave}</Text>

                    {recordCategoryOptions.map((category) => (
                      <View key={category.key} style={[styles.recordBlock, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                        <View style={styles.recordHeader}>
                          <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{category.label}</Text>
                          <View style={styles.recordActionRow}>
                            <NmPressable
                              style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                              onPress={() => handleGenerateRecordDraft(category.key)}
                              disabled={!!draftLoadingCategory || !!savingCategory}
                            >
                              <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                                {draftLoadingCategory === category.key ? copy.drafting : copy.draft}
                              </Text>
                            </NmPressable>
                            <NmPressable
                              style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                              onPress={() => handleSaveRecord(category.key)}
                              disabled={!!draftLoadingCategory || !!savingCategory}
                            >
                              <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                                {savingCategory === category.key ? copy.saving : copy.save}
                              </Text>
                            </NmPressable>
                          </View>
                        </View>

                        <TextInput
                          style={[
                            styles.recordEditor,
                            compactLayout ? styles.recordEditorCompact : null,
                            tinyLayout ? styles.recordEditorTiny : null,
                            { height: recordEditorHeight, backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary },
                          ]}
                          multiline
                          scrollEnabled
                          onFocus={lockWorkspaceScroll}
                          onBlur={unlockWorkspaceScroll}
                          onTouchStart={lockWorkspaceScroll}
                          onTouchEnd={unlockWorkspaceScroll}
                          onTouchCancel={unlockWorkspaceScroll}
                          value={recordDrafts[category.key] || ""}
                          onChangeText={(text) =>
                            setRecordDrafts((prev) => ({ ...prev, [category.key]: text }))
                          }
                          placeholder={copy.recordEditorPlaceholder.replace("{label}", category.label)}
                          placeholderTextColor={activeTheme.textSecondary}
                        />
                        <View style={styles.exportActionRow}>
                          <NmPressable
                            style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                            onPress={() => handleCopyToClipboard(category.label, recordDrafts[category.key] || "")}
                          >
                            <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.clipboardCopy}</Text>
                          </NmPressable>
                          <NmPressable
                            style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                            onPress={() => handleShareExport(category.label, recordDrafts[category.key] || "", "txt")}
                          >
                            <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportTxt}</Text>
                          </NmPressable>
                          <NmPressable
                            style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                            onPress={() => handleShareExport(category.label, recordDrafts[category.key] || "", "docx")}
                          >
                            <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportDocx}</Text>
                          </NmPressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </FadeInView>
              ) : null}
            </ScrollView>
          ) : null}

          {activeTab === "history" ? (
            <ScrollView contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
              <FadeInView key="history">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyHeaderText}>
                      <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.historyTitle}</Text>
                      <Text style={[styles.historyScopeText, { color: pendingHistoryBulkDelete ? "#dc2626" : activeTheme.textSecondary }]}>
                        {pendingHistoryBulkDelete ? copy.historyDeleteAllConfirmHint : copy.historyScopeHint}
                      </Text>
                    </View>
                    <View style={styles.historyHeaderActions}>
                      <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => fetchHistory(authToken)}>
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{historyLoading ? copy.loading : copy.refresh}</Text>
                      </NmPressable>
                      <NmPressable
                        style={[
                          styles.tinyButton,
                          pendingHistoryBulkDelete ? styles.destructiveConfirmButton : null,
                          { backgroundColor: pendingHistoryBulkDelete ? "#dc2626" : activeTheme.surface, borderColor: pendingHistoryBulkDelete ? "#dc2626" : activeTheme.inputBorder },
                          historyBulkDeleting || history.length === 0 ? styles.buttonDisabled : null
                        ]}
                        onPress={handleDeleteAllHistory}
                        disabled={historyBulkDeleting || history.length === 0}
                      >
                        <Text style={[styles.tinyButtonText, { color: pendingHistoryBulkDelete ? "#ffffff" : activeTheme.textPrimary }]}>
                          {historyBulkDeleting ? copy.deleting : pendingHistoryBulkDelete ? copy.deleteAllConfirm : copy.deleteAll}
                        </Text>
                      </NmPressable>
                      {pendingHistoryBulkDelete && !historyBulkDeleting ? (
                        <NmPressable
                          style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                          onPress={clearHistoryDeleteAllConfirmTimer}
                        >
                          <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.cancelAction}</Text>
                        </NmPressable>
                      ) : null}
                    </View>
                  </View>

                  {history.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>{copy.noHistory}</Text>
                  ) : (
                    history.map((item) => (
                      <View key={item.task_id} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                        <View style={styles.historyItemHeader}>
                          <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{resolveTypeLabel(item)}</Text>
                          <View style={[styles.historyStatusBadge, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                            <Text style={[styles.historyStatusBadgeText, { color: activeTheme.textSecondary }]}>
                              {resolveHistoryStatusLabel(item.status)}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>
                          {formatDate(item.created_at)}
                          {item.characters ? ` · ${Number(item.characters).toLocaleString()}${uiLanguage === "en" ? " chars" : "자"}` : ""}
                        </Text>
                        <Text numberOfLines={2} style={[styles.previewText, { color: activeTheme.textPrimary }]}>
                          {item.summary_preview || (uiLanguage === "en" ? "Open the transcript to view details." : "완료된 전사 결과를 열어 확인하세요.")}
                        </Text>
                        <View style={styles.historyActionRow}>
                          <NmPressable
                            style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                            onPress={() => handleLoadHistoryItem(item.task_id)}
                          >
                            <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.load}</Text>
                          </NmPressable>
                          <NmPressable
                            style={[
                              styles.tinyButton,
                              styles.usageActionButton,
                              pendingHistoryDeleteTaskId === item.task_id ? styles.destructiveConfirmButton : null,
                              { backgroundColor: pendingHistoryDeleteTaskId === item.task_id ? "#dc2626" : activeTheme.surface, borderColor: pendingHistoryDeleteTaskId === item.task_id ? "#dc2626" : activeTheme.inputBorder },
                              historyDeletingTaskId === item.task_id || ["queued", "processing"].includes(String(item.status || "").toLowerCase()) ? styles.buttonDisabled : null,
                            ]}
                            onPress={() => handleDeleteHistoryItem(item.task_id)}
                            disabled={historyDeletingTaskId === item.task_id || ["queued", "processing"].includes(String(item.status || "").toLowerCase())}
                          >
                            <Text style={[styles.tinyButtonText, { color: pendingHistoryDeleteTaskId === item.task_id ? "#ffffff" : activeTheme.textPrimary }]}>
                              {historyDeletingTaskId === item.task_id
                                ? copy.deleting
                                : ["queued", "processing"].includes(String(item.status || "").toLowerCase())
                                  ? copy.active
                                  : pendingHistoryDeleteTaskId === item.task_id
                                    ? copy.deleteConfirm
                                    : copy.delete}
                            </Text>
                          </NmPressable>
                          {pendingHistoryDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id ? (
                            <NmPressable
                              style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                              onPress={clearHistoryDeleteConfirmTimer}
                            >
                              <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.cancelAction}</Text>
                            </NmPressable>
                          ) : null}
                        </View>
                        {pendingHistoryDeleteTaskId === item.task_id && historyDeletingTaskId !== item.task_id ? (
                          <Text style={[styles.historyDeleteHint, { color: "#dc2626" }]}>{copy.historyDeleteConfirmHint}</Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </FadeInView>
            </ScrollView>
          ) : null}

          {activeTab === "records" ? (
            <ScrollView contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
              <FadeInView key="records">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <View style={styles.inlineBetween}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.recordsTitle}</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => fetchRecords(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{recordsLoading ? copy.loading : copy.refresh}</Text>
                    </NmPressable>
                  </View>

                  {records.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>{copy.noRecords}</Text>
                  ) : (
                    records.map((item) => {
                      const recordId = String(item.id || "");
                      const isEditing = Boolean(recordId && Object.prototype.hasOwnProperty.call(recordEditDrafts, recordId));
                      const draftText = isEditing ? recordEditDrafts[recordId] : String(item.content || "");
                      const busy = recordSavingId === recordId;
                      return (
                        <View key={item.id || `${item.category}-${item.created_at}`} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.title || item.category}</Text>
                          <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{formatDate(item.created_at)}</Text>
                          {isEditing ? (
                            <TextInput
                              style={[styles.recordEditor, { minHeight: 140, backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                              value={draftText}
                              onChangeText={(value) => handleRecordEditChange(recordId, value)}
                              multiline
                            />
                          ) : (
                            <Text selectable style={[styles.previewText, { color: activeTheme.textPrimary }]}>{item.content || ""}</Text>
                          )}
                          <View style={styles.exportActionRow}>
                            {isEditing ? (
                              <>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, busy ? styles.buttonDisabled : null]}
                                  onPress={() => handleUpdateRecord(item)}
                                  disabled={busy}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{busy ? copy.saving : copy.recordUpdateSave}</Text>
                                </NmPressable>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, busy ? styles.buttonDisabled : null]}
                                  onPress={() => handleCancelRecordEdit(recordId)}
                                  disabled={busy}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.cancelAction}</Text>
                                </NmPressable>
                              </>
                            ) : (
                              <>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                                  onPress={() => handleStartRecordEdit(item)}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.edit}</Text>
                                </NmPressable>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                                  onPress={() => handleCopyToClipboard(item.title || item.category || copy.recordsTitle, item.content || "")}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.clipboardCopy}</Text>
                                </NmPressable>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                                  onPress={() => handleShareExport(item.title || item.category || copy.recordsTitle, item.content || "", "txt")}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportTxt}</Text>
                                </NmPressable>
                                <NmPressable
                                  style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                                  onPress={() => handleShareExport(item.title || item.category || copy.recordsTitle, item.content || "", "docx")}
                                >
                                  <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportDocx}</Text>
                                </NmPressable>
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </FadeInView>
            </ScrollView>
          ) : null}

          {activeTab === "settings" ? (
            <ScrollView contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
              <FadeInView key="settings-main">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsSubtitle}</Text>
                </View>
              </FadeInView>

              <FadeInView key="settings-usage" delay={50}>
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{usageSettingsTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{usageSettingsHint}</Text>

                  {usageLoading && !effectiveUsage ? (
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.usageLoading}</Text>
                  ) : effectiveUsage ? (
                    <>
                      <View style={styles.usageMetaGrid}>
                        <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usagePlanLabel}</Text>
                          <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{planLabel}</Text>
                        </View>
                      </View>

                      <Text style={[styles.metaText, { color: activeTheme.textPrimary }]}>
                        {copy.usageThisMonth}:{" "}
                        {isFreeUsagePlan
                          ? `${formatSecondsToHourMinute(usedAudioSeconds)} / ${formatSecondsToHourMinute(monthlyLimitSeconds)}`
                          : `${formatSecondsToHourMinute(usedAudioSeconds)} / ${copy.usageUnlimited}`}
                      </Text>
                      {isFreeUsagePlan ? (
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>
                          {copy.usageRemaining}: {formatSecondsToHourMinute(remainingAudioSeconds)}
                        </Text>
                      ) : null}
                      {isFreeUsagePlan ? (
                        <View style={[styles.usageProgressTrack, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <View style={[styles.usageProgressFill, { backgroundColor: activeTheme.accent, width: `${usagePercent}%` }]} />
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.usageUnavailable}</Text>
                  )}

                  {isGuestMode ? (
                    <Text style={[styles.helpText, { color: activeTheme.accent }]}>{copy.guestTrialHint}</Text>
                  ) : null}
                  {!isGuestMode ? (
                    <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>
                      {Platform.OS === "ios" ? copy.iosUsageNotice : copy.iosFreeOnlyNotice}
                    </Text>
                  ) : null}

                  <View style={styles.usageActionRow}>
                    <NmPressable
                      style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                      onPress={() => {
                        clearMessages();
                        if (isGuestMode) {
                          fetchGuestUsage({ showNotice: true }).catch(() => {});
                        } else {
                          fetchUsage(authToken, { quiet: true }).then(() => {
                            setNotice(copy.notices.usageLoaded);
                          }).catch(() => {});
                        }
                      }}
                      disabled={usageLoading}
                    >
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                        {usageLoading ? copy.loading : copy.usageRefresh}
                      </Text>
                    </NmPressable>
                    {isGuestMode ? (
                      <NmPressable
                        style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft }]}
                        onPress={() => {
                          clearMessages();
                          setGuestModeStarted(false);
                          setActiveTab("transcribe");
                        }}
                      >
                        <Text style={styles.primaryButtonText}>
                          {copy.guestLoginButton}
                        </Text>
                      </NmPressable>
                    ) : null}
                  </View>
                </View>
              </FadeInView>

              {isLoggedIn ? (
                <FadeInView key="settings-glossary" delay={70}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.glossaryTitleBlock}>
                        <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsGlossaryTitle}</Text>
                        <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsGlossaryHint}</Text>
                      </View>
                      <NmPressable
                        style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                        onPress={() => fetchGlossary(authToken, { quiet: false })}
                        disabled={glossaryLoading}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                          {glossaryLoading ? copy.loading : copy.glossaryRefresh}
                        </Text>
                      </NmPressable>
                    </View>

                    <View style={styles.glossaryForm}>
                      <TextInput
                        style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                        value={glossaryForm.term}
                        onChangeText={(term) => setGlossaryForm((prev) => ({ ...prev, term }))}
                        placeholder={copy.glossaryTermPlaceholder}
                        placeholderTextColor={activeTheme.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                        value={glossaryForm.meaning}
                        onChangeText={(meaning) => setGlossaryForm((prev) => ({ ...prev, meaning }))}
                        placeholder={copy.glossaryMeaningPlaceholder}
                        placeholderTextColor={activeTheme.textMuted}
                        autoCorrect={false}
                      />
                      <TextInput
                        style={[styles.recordEditor, styles.glossaryTextarea, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                        value={glossaryForm.aliases}
                        onChangeText={(aliases) => setGlossaryForm((prev) => ({ ...prev, aliases }))}
                        placeholder={copy.glossaryAliasesPlaceholder}
                        placeholderTextColor={activeTheme.textMuted}
                        multiline
                        autoCorrect={false}
                      />
                      <TextInput
                        style={[styles.recordEditor, styles.glossaryTextarea, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                        value={glossaryForm.contexts}
                        onChangeText={(contexts) => setGlossaryForm((prev) => ({ ...prev, contexts }))}
                        placeholder={copy.glossaryContextsPlaceholder}
                        placeholderTextColor={activeTheme.textMuted}
                        multiline
                        autoCorrect={false}
                      />
                      <NmPressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                          glossaryActionId === CREATE_GLOSSARY_ACTION_ID ? styles.buttonDisabled : null,
                        ]}
                        onPress={handleCreateGlossaryTerm}
                        disabled={glossaryActionId === CREATE_GLOSSARY_ACTION_ID}
                      >
                        <Text style={styles.primaryButtonText}>
                          {glossaryActionId === CREATE_GLOSSARY_ACTION_ID ? copy.processing : copy.glossaryAdd}
                        </Text>
                      </NmPressable>
                    </View>

                    <View style={styles.glossaryTermList}>
                      {glossaryLoading && glossaryTerms.length === 0 ? (
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.loading}</Text>
                      ) : null}
                      {!glossaryLoading && glossaryTerms.length === 0 ? (
                        <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>{copy.glossaryEmpty}</Text>
                      ) : null}
                      {glossaryTerms.map((item) => {
                        const termId = item?.id == null ? item?.term : item.id;
                        const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
                        const contexts = Array.isArray(item?.contexts) ? item.contexts : [];
                        const busy = glossaryActionId === String(item?.id);
                        return (
                          <View key={`glossary-${termId}`} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                            <View style={styles.glossaryTermHeader}>
                              <View style={styles.glossaryTermText}>
                                <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.term}</Text>
                                {item.meaning ? (
                                  <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{item.meaning}</Text>
                                ) : null}
                              </View>
                              <View
                                style={[
                                  styles.glossaryStatusPill,
                                  { backgroundColor: item.is_active ? activeTheme.noticeBg : activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                                ]}
                              >
                                <Text style={[styles.glossaryStatusText, { color: item.is_active ? activeTheme.accent : activeTheme.textSecondary }]}>
                                  {item.is_active ? copy.glossaryActive : copy.glossaryInactive}
                                </Text>
                              </View>
                            </View>
                            {aliases.length ? (
                              <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>
                                {copy.glossaryAliasesLabel}: {aliases.join(", ")}
                              </Text>
                            ) : null}
                            {contexts.length ? (
                              <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>
                                {copy.glossaryContextsLabel}: {contexts.join(", ")}
                              </Text>
                            ) : null}
                            <View style={styles.glossaryActionRow}>
                              <NmPressable
                                style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, busy ? styles.buttonDisabled : null]}
                                onPress={() => handleToggleGlossaryTerm(item)}
                                disabled={busy}
                              >
                                <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                                  {item.is_active ? copy.glossaryDisable : copy.glossaryEnable}
                                </Text>
                              </NmPressable>
                              <NmPressable
                                style={[styles.tinyButton, styles.usageActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, busy ? styles.buttonDisabled : null]}
                                onPress={() => handleDeleteGlossaryTerm(item)}
                                disabled={busy}
                              >
                                <Text style={[styles.tinyButtonText, { color: activeTheme.errorText || "#b4233a" }]}>
                                  {busy ? copy.deleting : copy.glossaryDelete}
                                </Text>
                              </NmPressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </FadeInView>
              ) : null}

              {isLoggedIn && Platform.OS === "ios" ? (
                <FadeInView key="settings-apple-iap" delay={70}>
                  <AppleIapSubscriptionCard
                    copy={copy}
                    activeTheme={activeTheme}
                    authToken={authToken}
                    fetchUsage={fetchUsage}
                    setNotice={setNotice}
                    setError={setError}
                    onOpenPrivacy={() => openLegalDocument("privacy")}
                    onOpenTerms={() => openLegalDocument("terms")}
                  />
                </FadeInView>
              ) : null}

              {isLoggedIn ? (
                <FadeInView key="settings-account" delay={90}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsAccountTitle}</Text>
                    <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsAccountHint}</Text>
                    <NmPressable
                      style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, authLoading ? styles.buttonDisabled : null]}
                      onPress={handleRequestDeleteAccount}
                      disabled={authLoading}
                    >
                      <Text style={[styles.secondaryButtonText, { color: activeTheme.errorText || "#b4233a" }]}>
                        {authLoading ? copy.processing : copy.accountDelete}
                      </Text>
                    </NmPressable>
                  </View>
                </FadeInView>
              ) : null}

              <FadeInView key="settings-legal" delay={90}>
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsLegalTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsLegalHint}</Text>

                  <NmPressable
                    style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                    onPress={() => openLegalDocument("privacy")}
                  >
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.openPrivacy}</Text>
                  </NmPressable>
                  <NmPressable
                    style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                    onPress={() => openLegalDocument("terms")}
                  >
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.openTerms}</Text>
                  </NmPressable>
                  <NmPressable
                    style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                    onPress={() => openLegalDocument("company-policy")}
                  >
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.openCompanyPolicy}</Text>
                  </NmPressable>
                </View>
              </FadeInView>

              <FadeInView key="settings-support" delay={150}>
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsSupportTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsSupportHint}</Text>

                  <NmPressable
                    style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                    onPress={() => openLegalDocument("notice")}
                  >
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.openNotice}</Text>
                  </NmPressable>
                  <NmPressable
                    style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                    onPress={() => openLegalDocument("faq")}
                  >
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.legal.openFaq}</Text>
                  </NmPressable>
                </View>
              </FadeInView>

              <FadeInView key="settings-appearance" delay={220}>
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsAppearanceTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsAppearanceHint}</Text>

                  <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{copy.settingsLanguageLabel}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.segmentScroll}
                    contentContainerStyle={[styles.segmentRow, styles.segmentScrollContent]}
                  >
                    <SegmentButton label={copy.languageOptionKo} active={uiLanguage === "ko"} onPress={() => setUiLanguage("ko")} theme={activeTheme} />
                    <SegmentButton label={copy.languageOptionEn} active={uiLanguage === "en"} onPress={() => setUiLanguage("en")} theme={activeTheme} />
                  </ScrollView>

                  <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{copy.settingsThemeLabel}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.segmentScroll}
                    contentContainerStyle={[styles.segmentRow, styles.segmentScrollContent]}
                  >
                    {MOBILE_THEME_OPTIONS.map((themeOption) => {
                      const active =
                        themeOption.key === "auto"
                          ? themeMode === "auto"
                          : themeMode === "manual" && themeOption.targetTheme === themeKey;
                      return (
                        <SegmentButton
                          key={`settings-${themeOption.key}`}
                          label={themeOption.label}
                          active={active}
                          onPress={() => applyThemeOption(themeOption.key)}
                          theme={activeTheme}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              </FadeInView>

              <FadeInView key="settings-business-footer" delay={250}>
                <View style={styles.settingsBusinessFooter}>
                  {settingsBusinessRows.map((row, index) => (
                    <Text
                      key={`settings-business-${index}`}
                      style={[styles.settingsBusinessFooterText, { color: activeTheme.textSecondary }]}
                    >
                      {row.filter(Boolean).join(" | ")}
                    </Text>
                  ))}
                  <Text style={[styles.settingsBusinessFooterText, { color: activeTheme.textSecondary }]}>
                    mallog24 | Copyright 2026. OURS All rights reserved.
                  </Text>
                </View>
              </FadeInView>
            </ScrollView>
          ) : null}
        </View>
      )}
      </View>

      {isPrivacyGateVisible ? (
        <View
          style={[
            styles.privacyOverlay,
            {
              backgroundColor: "rgba(5, 12, 24, 0.78)",
              paddingHorizontal: modalHorizontalPadding,
              paddingVertical: modalVerticalPadding,
            },
          ]}
        >
          <FadeInView duration={260}>
            <View
              style={[
                styles.privacyModal,
                compactLayout ? styles.privacyModalCompact : null,
                tinyLayout ? styles.privacyModalTiny : null,
                {
                  backgroundColor: activeTheme.surface,
                  borderColor: activeTheme.inputBorder,
                  maxHeight: privacyModalMaxHeight,
                  width: privacyModalWidth,
                },
              ]}
            >
              <ScrollView
                style={[styles.privacyModalScroll, tinyLayout ? styles.modalScrollTiny : null]}
                contentContainerStyle={[styles.privacyModalContent, tinyLayout ? styles.modalContentTiny : null]}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={[
                    styles.privacyTitle,
                    compactLayout ? styles.privacyTitleCompact : null,
                    tinyLayout ? styles.privacyTitleTiny : null,
                    modalTextStyles.title,
                    { color: activeTheme.textPrimary },
                  ]}
                >
                  {copy.privacy.title}
                </Text>
                <Text
                  style={[
                    styles.legalUpdatedText,
                    tinyLayout ? styles.legalUpdatedTextTiny : null,
                    modalTextStyles.meta,
                    { color: activeTheme.textSecondary },
                  ]}
                >
                  {copy.privacy.version}
                </Text>
                <View
                  style={[
                    styles.privacyNoticeBox,
                    tinyLayout ? styles.privacyNoticeBoxTiny : null,
                    { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.privacyNoticeText,
                      tinyLayout ? styles.privacyNoticeTextTiny : null,
                      modalTextStyles.sectionBody,
                      { color: activeTheme.textPrimary },
                    ]}
                  >
                    {copy.privacy.gateNotice}
                  </Text>
                  <Text
                    style={[
                      styles.privacyNoticeText,
                      tinyLayout ? styles.privacyNoticeTextTiny : null,
                      modalTextStyles.sectionBody,
                      { color: activeTheme.textSecondary },
                    ]}
                  >
                    {copy.privacy.versionNotice}
                  </Text>
                </View>
                <Text style={[styles.privacyBody, compactLayout ? styles.privacyBodyCompact : null, tinyLayout ? styles.privacyBodyTiny : null, modalTextStyles.body, { color: activeTheme.textSecondary }]}>
                  {copy.privacy.body}
                </Text>

                <View style={[styles.privacySummaryBox, tinyLayout ? styles.privacySummaryBoxTiny : null, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryFile}
                  </Text>
                  <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryText}
                  </Text>
                  {copy.privacy.summaryAi ? (
                    <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                      {copy.privacy.summaryAi}
                    </Text>
                  ) : null}
                  {copy.privacy.summaryStorage ? (
                    <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                      {copy.privacy.summaryStorage}
                    </Text>
                  ) : null}
                  <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryVendors}
                  </Text>
                  <Text style={[styles.privacySummaryItem, compactLayout ? styles.privacySummaryItemCompact : null, tinyLayout ? styles.privacySummaryItemTiny : null, modalTextStyles.summaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summarySocial}
                  </Text>
                </View>

                <NmPressable
                  style={[styles.privacyLinkButton, tinyLayout ? styles.privacyLinkButtonTiny : null, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("privacy")}
                >
                  <Text style={[styles.privacyLinkText, tinyLayout ? styles.privacyLinkTextTiny : null, modalTextStyles.linkText, { color: activeTheme.accent }]}>{copy.privacy.viewPolicy}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyLinkButton, tinyLayout ? styles.privacyLinkButtonTiny : null, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("terms")}
                >
                  <Text style={[styles.privacyLinkText, tinyLayout ? styles.privacyLinkTextTiny : null, modalTextStyles.linkText, { color: activeTheme.accent }]}>{copy.privacy.viewTerms}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyLinkButton, tinyLayout ? styles.privacyLinkButtonTiny : null, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("company-policy")}
                >
                  <Text style={[styles.privacyLinkText, tinyLayout ? styles.privacyLinkTextTiny : null, modalTextStyles.linkText, { color: activeTheme.accent }]}>{copy.privacy.viewCompanyPolicy}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyCheckRow, tinyLayout ? styles.privacyCheckRowTiny : null, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}
                  onPress={() => setPrivacyConsentChecked((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.privacyCheckBox,
                      tinyLayout ? styles.privacyCheckBoxTiny : null,
                      { borderColor: activeTheme.inputBorder, backgroundColor: privacyConsentChecked ? activeTheme.accent : "transparent" },
                    ]}
                  >
                    {privacyConsentChecked ? <Text style={styles.privacyCheckMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.privacyCheckText, tinyLayout ? styles.privacyCheckTextTiny : null, modalTextStyles.checkText, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.check}
                  </Text>
                </NmPressable>

                <NmPressable
                  style={[
                    styles.privacyAcceptButton,
                    tinyLayout ? styles.privacyAcceptButtonTiny : null,
                    { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                    !privacyConsentChecked || privacyConsentSaving ? styles.buttonDisabled : null,
                  ]}
                  onPress={handleAcceptPrivacyPolicy}
                  disabled={!privacyConsentChecked || privacyConsentSaving}
                >
                  <Text style={[styles.privacyAcceptButtonText, tinyLayout ? styles.privacyAcceptButtonTextTiny : null, modalTextStyles.actionText]}>
                    {privacyConsentSaving ? copy.privacy.saving : copy.privacy.accept}
                  </Text>
                </NmPressable>
              </ScrollView>
            </View>
          </FadeInView>
        </View>
      ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NM.bg,
    position: "relative",
  },
  appShell: {
    flex: 1,
  },
  appShellBlocked: {
    opacity: 0.18,
    transform: [{ scale: 0.985 }],
  },
  centerScreen: {
    flex: 1,
    backgroundColor: NM.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: NM.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  softBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  softGlowOrbA: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -120,
    left: -90,
  },
  softGlowOrbB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    top: 90,
    right: -120,
  },
  softGlowOrbC: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    bottom: -110,
    left: 40,
  },
  workspaceContainer: {
    flex: 1,
  },
  legalPageContainer: {
    flex: 1,
  },
  legalPageHeader: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: NM.radius,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 16,
  },
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34,
    justifyContent: "flex-start",
  },
  authScrollContentCompact: {
    paddingTop: 6,
    paddingBottom: 26,
  },
  quickControlsWrap: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  quickControlsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  quickIconButton: {
    minWidth: 56,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  quickIconText: {
    fontSize: 16,
    fontWeight: "700",
  },
  quickMenu: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    gap: 6,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.15,
    shadowRadius: 22,
    elevation: 4,
  },
  quickMenuItem: {
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  quickMenuItemActive: {
    backgroundColor: "rgba(59, 125, 216, 0.08)",
  },
  quickMenuText: {
    fontSize: 12,
    fontWeight: "700",
  },
  authCard: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  authCardCompact: {
    maxWidth: 560,
  },
  cardCompact: {
    padding: 14,
    gap: 10,
  },
  authIntro: {
    color: NM.textPrimary,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  authIntroCompact: {
    fontSize: 17,
    lineHeight: 22,
  },
  authSubcopy: {
    color: NM.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  authLandingBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  authLandingBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  authLandingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  authLandingHeroTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  authLandingHeroSubcopy: {
    fontSize: 12,
    lineHeight: 18,
  },
  authLandingExampleGrid: {
    gap: 10,
  },
  authLandingExampleCard: {
    borderRadius: NM.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
  },
  authLandingExampleLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  authLandingExampleBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  authLandingAfterTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  authLandingAfterList: {
    gap: 3,
  },
  authLandingAfterItem: {
    fontSize: 11,
    lineHeight: 16,
  },
  authLandingActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  authLandingActionRowCompact: {
    flexDirection: "column",
  },
  authLandingActionButton: {
    flex: 1,
  },
  authLandingFeatureGrid: {
    width: "100%",
    alignSelf: "center",
    gap: 10,
  },
  authLandingFeatureCard: {
    paddingVertical: 14,
    gap: 6,
  },
  authLandingFeatureTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  authLandingFeatureBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  authLandingTestimonialLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  authLandingTestimonialGrid: {
    gap: 8,
  },
  authLandingTestimonialCard: {
    borderRadius: NM.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  authLandingTestimonialText: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  card: {
    backgroundColor: NM.surface,
    borderRadius: NM.radius,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: NM.inputBorder,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 5,
  },
  cardTitle: {
    color: NM.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  tabsWrap: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: NM.radiusSm,
    backgroundColor: NM.inputBg,
    padding: 6,
    borderWidth: 1,
    borderColor: NM.inputBorder,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
  },
  segmentScroll: {
    flexGrow: 0,
  },
  segmentScrollContent: {
    paddingRight: 6,
  },
  input: {
    borderRadius: NM.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: NM.inputBg,
    fontSize: 14,
    color: NM.textPrimary,
    borderWidth: 1,
    borderColor: NM.inputBorder,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: NM.accent,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: NM.accentSoft,
    shadowColor: NM.accent,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: NM.surface,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: NM.inputBorder,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  secondaryButtonText: {
    color: NM.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  tinyButton: {
    borderRadius: 999,
    backgroundColor: NM.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: NM.inputBorder,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  tinyButtonText: {
    color: NM.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  orText: {
    textAlign: "center",
    color: NM.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  socialRow: {
    flexDirection: "column",
    gap: 10,
  },
  helpText: {
    color: NM.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  settingsBusinessFooter: {
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 3,
  },
  settingsBusinessFooterText: {
    color: NM.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  topUsageCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  topUsageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  topUsageTextBlock: {
    flex: 1,
    gap: 2,
  },
  topUsageLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  topUsageValue: {
    fontSize: 12,
    fontWeight: "900",
  },
  topUsagePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topUsagePillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  topUsageProgressTrack: {
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  topUsageProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  topUsageRemaining: {
    fontSize: 10,
    fontWeight: "700",
  },
  typeCardGrid: {
    flexDirection: "row",
    gap: 8,
  },
  typeCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  typeCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardIconText: {
    fontSize: 12,
    fontWeight: "900",
  },
  typeCardLabel: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  uploadZone: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center",
    gap: 5,
  },
  uploadZoneIcon: {
    fontSize: 22,
    fontWeight: "900",
  },
  uploadZoneTitle: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  uploadZoneHint: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
  startTranscribeButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
  },
  startTranscribeButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  processingPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  processingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  processingMark: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  processingMarkText: {
    fontSize: 12,
    fontWeight: "900",
  },
  processingHeaderText: {
    flex: 1,
    gap: 3,
  },
  processingTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  processingSubcopy: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  processingStepList: {
    gap: 8,
  },
  processingStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  processingStepDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  processingStepDotDone: {
    backgroundColor: "rgba(74,222,128,0.16)",
  },
  processingStepDotActive: {
    backgroundColor: "rgba(91,130,240,0.12)",
  },
  processingStepDotWait: {
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  processingStepDotText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
  },
  processingStepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  processingStepTextActive: {
    fontWeight: "900",
  },
  processingProgressTrack: {
    height: 5,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  processingProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  usageMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  usageMetaItem: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  usageMetaLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  usageMetaValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  usageProgressTrack: {
    marginTop: 2,
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  usageProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  usageActionRow: {
    flexDirection: "row",
    gap: 6,
  },
  historyHeaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  historyActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  historyDeleteHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  historyHeader: {
    gap: 10,
  },
  historyHeaderText: {
    gap: 4,
  },
  historyScopeText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  usageActionButton: {
    flexGrow: 1,
    flexBasis: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  glossaryTitleBlock: {
    flex: 1,
    gap: 4,
  },
  glossaryForm: {
    gap: 8,
  },
  glossaryTextarea: {
    minHeight: 72,
  },
  glossaryTermList: {
    gap: 8,
  },
  glossaryTermHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  glossaryTermText: {
    flex: 1,
    gap: 3,
  },
  glossaryStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  glossaryStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  glossaryActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  destructiveConfirmButton: {
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  userBar: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: NM.radius,
    backgroundColor: NM.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 4,
    borderWidth: 1,
    borderColor: NM.inputBorder,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    color: NM.textPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
  userName: {
    marginTop: 2,
    color: NM.textSecondary,
    fontWeight: "600",
    fontSize: 11,
  },
  userSession: {
    marginTop: 2,
    color: NM.textSecondary,
    fontWeight: "600",
    fontSize: 10,
  },
  logoutButton: {
    borderRadius: 999,
    backgroundColor: "#f4e5e8",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#f1c7d0",
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  logoutButtonText: {
    color: "#be123c",
    fontWeight: "700",
    fontSize: 11,
  },
  metaText: {
    color: NM.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  sectionTitle: {
    color: NM.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  resultHeaderBlock: {
    gap: 7,
  },
  resultMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  resultTag: {
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultTagText: {
    fontSize: 10,
    fontWeight: "800",
  },
  resultSectionCard: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 0,
  },
  resultSectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  resultSectionKey: {
    width: 52,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  resultSectionValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  resultSectionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  resultEditPanel: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  resultBox: {
    borderRadius: NM.radiusSm,
    backgroundColor: NM.inputBg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: NM.inputBorder,
  },
  resultScrollContent: {
    padding: 12,
  },
  resultEditor: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "500",
  },
  transcriptEditHeader: {
    marginTop: 8,
  },
  resultExportGrid: {
    flexDirection: "row",
    gap: 7,
  },
  resultExportButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  resultExportButtonPrimary: {
    shadowColor: "#5B82F0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  resultExportIcon: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "900",
  },
  resultExportLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  resultExportLabelPrimary: {
    fontWeight: "900",
  },
  recordBlock: {
    marginTop: 6,
    borderRadius: NM.radiusSm,
    backgroundColor: NM.surface,
    padding: 12,
    gap: 8,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#edf2f8",
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  recordActionRow: {
    flexDirection: "row",
    gap: 6,
  },
  recordEditor: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 12,
    lineHeight: 18,
    color: NM.textPrimary,
    backgroundColor: NM.inputBg,
    borderWidth: 1,
    borderColor: NM.inputBorder,
  },
  recordEditorCompact: {
    fontSize: 11,
    lineHeight: 17,
  },
  recordEditorTiny: {
    fontSize: 10,
    lineHeight: 15,
  },
  exportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  exportTinyButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  exportTinyButtonText: {
    textAlign: "center",
    fontSize: 10.5,
    lineHeight: 14,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: NM.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  listItem: {
    borderRadius: NM.radiusSm,
    backgroundColor: NM.surface,
    padding: 12,
    gap: 6,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#edf2f8",
  },
  listTitle: {
    color: NM.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  historyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  previewText: {
    color: NM.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  modalOverlayCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalOverlayTiny: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  legalModal: {
    width: "100%",
    maxWidth: 700,
    maxHeight: "90%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
    gap: 10,
  },
  legalModalCompact: {
    maxHeight: "92%",
    padding: 14,
  },
  legalModalTiny: {
    borderRadius: 16,
    padding: 10,
    gap: 8,
  },
  legalModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  legalModalContent: {
    gap: 10,
    paddingBottom: 2,
  },
  modalScrollTiny: {
    maxHeight: "100%",
  },
  modalContentTiny: {
    gap: 8,
    paddingBottom: 0,
  },
  legalUpdatedText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  legalUpdatedTextTiny: {
    fontSize: 10,
    lineHeight: 14,
  },
  legalSectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  legalSectionBoxTiny: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 5,
  },
  legalSectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  legalSectionTitleTiny: {
    fontSize: 12,
    lineHeight: 16,
  },
  legalSectionBody: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  legalSectionBodyTiny: {
    fontSize: 10,
    lineHeight: 15,
  },
  privacyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyModal: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "86%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
  },
  privacyModalCompact: {
    maxHeight: "90%",
    padding: 14,
  },
  privacyModalTiny: {
    borderRadius: 16,
    padding: 10,
  },
  privacyModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  privacyModalContent: {
    gap: 11,
    paddingBottom: 2,
  },
  privacyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: NM.textPrimary,
    letterSpacing: -0.25,
  },
  privacyTitleCompact: {
    fontSize: 16,
  },
  privacyTitleTiny: {
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.15,
  },
  privacyBody: {
    fontSize: 12,
    lineHeight: 18,
    color: NM.textSecondary,
  },
  privacyBodyCompact: {
    fontSize: 11,
    lineHeight: 16,
  },
  privacyBodyTiny: {
    fontSize: 10,
    lineHeight: 15,
  },
  privacyNoticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  privacyNoticeBoxTiny: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  privacyNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  privacyNoticeTextTiny: {
    fontSize: 10,
    lineHeight: 14,
  },
  privacySummaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  privacySummaryBoxTiny: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 5,
  },
  privacySummaryItem: {
    fontSize: 11,
    lineHeight: 17,
    color: NM.textPrimary,
    fontWeight: "600",
  },
  privacySummaryItemCompact: {
    fontSize: 10,
    lineHeight: 15,
  },
  privacySummaryItemTiny: {
    fontSize: 9.5,
    lineHeight: 14,
  },
  privacyLinkButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  privacyLinkButtonTiny: {
    paddingVertical: 8,
  },
  privacyLinkText: {
    fontSize: 12,
    fontWeight: "700",
  },
  privacyLinkTextTiny: {
    fontSize: 11,
  },
  privacyCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  privacyCheckRowTiny: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  privacyCheckBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyCheckBoxTiny: {
    width: 18,
    height: 18,
  },
  privacyCheckMark: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  privacyCheckText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: NM.textPrimary,
  },
  privacyCheckTextTiny: {
    fontSize: 10.5,
    lineHeight: 15,
  },
  privacyAcceptButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: NM.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 4,
  },
  privacyAcceptButtonTiny: {
    paddingVertical: 10,
  },
  privacyAcceptButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  privacyAcceptButtonTextTiny: {
    fontSize: 12,
  },
});
