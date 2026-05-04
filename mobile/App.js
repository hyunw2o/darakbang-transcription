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
import {
  APP_TABS,
  FREE_MONTHLY_LIMIT_SECONDS,
  GUEST_MAX_AUDIO_SECONDS,
  GUEST_MONTHLY_LIMIT_SECONDS,
  GUEST_SESSION_KEY,
  MAX_UPLOAD_BYTES,
  MOBILE_THEME_OPTIONS,
  MOBILE_THEMES,
  NM,
  PRIVACY_CONSENT_KEY,
  PRIVACY_POLICY_VERSION,
  RECORD_CATEGORIES,
  STATUS_POLL_INTERVAL_MS,
  TRANSCRIBE_POLL_TIMEOUT_MS,
  TRANSCRIPTION_TYPES,
  UI_THEME_KEY,
  UI_THEME_MODE_KEY,
} from "./config";
import { getExtension, inferMimeFromAsset } from "./utils/file";
import { formatDate, formatSecondsToHourMinute, sanitizeFileName } from "./utils/format";
import { buildDocxBase64 } from "./utils/docx";
import { requestApi } from "./utils/network";
import useMobileAuth from "./hooks/useMobileAuth";

import { I18N, LEGAL_DOCUMENTS } from "./content";

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

  const [recordDrafts, setRecordDrafts] = useState({});
  const [draftLoadingCategory, setDraftLoadingCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState("");
  const [workspaceScrollEnabled, setWorkspaceScrollEnabled] = useState(true);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [privacyConsentSaving, setPrivacyConsentSaving] = useState(false);
  const [legalModalDocType, setLegalModalDocType] = useState("");

  const copy = I18N[uiLanguage] || I18N.ko;
  const legalDocs = LEGAL_DOCUMENTS[uiLanguage] || LEGAL_DOCUMENTS.ko;
  const activeLegalDoc = legalModalDocType ? legalDocs[legalModalDocType] || null : null;
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
    setDraftLoadingCategory("");
    setSavingCategory("");
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
  const resultTextBoxHeight = tinyLayout ? 170 : compactLayout ? 210 : 260;
  const recordEditorHeight = tinyLayout ? 118 : compactLayout ? 132 : 150;
  const resolvedThemeKey =
    themeMode === "auto" ? (colorScheme === "dark" ? "noir" : "aurora") : themeKey;
  const activeTheme = MOBILE_THEMES[resolvedThemeKey] || MOBILE_THEMES.aurora;
  const isIosAppStoreReviewMode = Platform.OS === "ios";
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
    () => TRANSCRIPTION_TYPES.map((key) => ({ key, label: copy.transcriptionTypes[key] || key })),
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

  const resetAppWorkspace = useCallback(() => {
    invalidatePollingSession();
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryDeletingTaskId("");
    setHistoryBulkDeleting(false);
    setRecords([]);
    setRecordsLoaded(false);
    resetResultWorkspace(true);
    setPickedFile(null);
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
    billingStatus,
    billingLoading,
    billingActionLoading,
    fetchUsage,
    fetchBillingStatus,
    refreshUsageAndBilling,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    handleOpenPricing,
    handleOpenOurs,
    handleBillingCheckout,
    handleBillingPortal,
    handleBillingCancel,
    handleBillingRefund,
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
  const isFreeUsagePlan = usagePlan === "free" || usagePlan === "guest";
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
  const billingProvider = String(billingStatus?.provider || "portone");
  const billingState = String(billingStatus?.status || "inactive");
  const billingCheckoutMode = String(billingStatus?.checkout_mode || "disabled");
  const billingCheckoutSupported = Boolean(billingStatus?.checkout_supported);
  const billingPortalSupported = Boolean(billingStatus?.portal_supported);
  const billingManageSupported = Boolean(billingStatus?.can_manage_subscription);
  const canRunBillingAction = Boolean(
    isLoggedIn &&
    (
      usagePlan !== "free"
      || billingState === "active"
      || billingState === "trialing"
      || billingState === "canceled"
      || billingState === "refund_requested"
    )
  );
  const planLabel = copy.planLabels?.[usagePlan] || usagePlan;
  const billingStateLabel = copy.billingStatusLabels?.[billingState] || billingState;
  const usageSettingsTitle = isIosAppStoreReviewMode ? copy.usageThisMonth : copy.settingsUsageTitle;
  const usageSettingsHint = isIosAppStoreReviewMode
    ? copy.iosBillingReviewNotice
    : copy.settingsUsageHint;
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
    if (!isLoggedIn) return;
    if (!usage && !usageLoading) {
      fetchUsage(authToken).catch(() => {});
    }
    if (!billingStatus && !billingLoading) {
      fetchBillingStatus(authToken).catch(() => {});
    }
  }, [isLoggedIn, authToken, usage, usageLoading, billingStatus, billingLoading]);

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
    setTaskStateText(copy.taskState.waiting);

    pollRef.current = setInterval(async () => {
      try {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return;

        const elapsed = Date.now() - (pollStartedAtRef.current || Date.now());
        if (elapsed > TRANSCRIBE_POLL_TIMEOUT_MS) {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
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
          setTaskStateText(copy.taskState.queued);
          return;
        }

        if (data.status === "processing") {
          setTaskStateText(copy.taskState.processing);
          return;
        }

        if (data.status === "completed") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskStateText(copy.taskState.done);
          if (expectedResultEpoch !== resultEpochRef.current) return;
          setResult(data);
          setNotice(copy.notices.transcribeDone);
          if (isLoggedIn) {
            fetchHistory(authToken);
            refreshUsageAndBilling(authToken).catch(() => {});
          } else {
            fetchGuestUsage().catch(() => {});
          }
          return;
        }

        if (data.status === "error") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskStateText("");
          setError(data.error || copy.errors.transcribeError);
          return;
        }

        if (data.status === "not_found") {
          stopPolling();
          activeTaskIdRef.current = "";
          setSubmitting(false);
          setTaskStateText("");
          setError(copy.errors.taskNotFound);
        }
      } catch (e) {
        if (pollToken !== pollTokenRef.current || activeTaskIdRef.current !== taskId) return;
        stopPolling();
        activeTaskIdRef.current = "";
        setSubmitting(false);
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
        setTaskStateText(copy.taskState.done);
        if (data.language) {
          setTranscriptionLanguage(String(data.language).toLowerCase());
        }
        setResult(data);
        if (isLoggedIn) {
          fetchHistory(authToken);
          refreshUsageAndBilling(authToken).catch(() => {});
        } else {
          fetchGuestUsage().catch(() => {});
        }
      } else {
        setSubmitting(false);
        setTaskStateText("");
        setNotice(data.message || copy.notices.requestAccepted);
      }
    } catch (e) {
      setSubmitting(false);
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

    const sourceText = result?.corrected_text || result?.raw_text || "";
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

    const sourceText = result?.corrected_text || result?.raw_text || "";
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
      setRecordDrafts((prev) => ({ ...prev, [category]: data?.content || "" }));
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
      const body = new FormData();
      body.append("category", category);
      body.append("title", copy.recordCategories[category] || category);
      body.append("content", content);
      body.append("task_id", result?.task_id || "");
      body.append("source_type", result?.transcription_type || transcriptionType);

      await requestApi("/api/records", {
        method: "POST",
        token: authToken,
        body,
      });

      await fetchRecords(authToken);
      setNotice(copy.notices.recordSaved);
      setActiveTab("records");
    } catch (e) {
      setError(e.message || copy.errors.saveFailed);
    } finally {
      setSavingCategory("");
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
                {!isIosAppStoreReviewMode ? (
                  <NmPressable
                    style={[styles.primaryButton, styles.authLandingActionButton, { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft }]}
                    onPress={handleOpenPricing}
                  >
                    <Text style={styles.primaryButtonText}>{copy.authLanding.pricingCta}</Text>
                  </NmPressable>
                ) : null}
                <NmPressable
                  style={[styles.secondaryButton, styles.authLandingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={handleOpenOurs}
                >
                  <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.authLanding.oursCta}</Text>
                </NmPressable>
              </View>
              {isIosAppStoreReviewMode ? (
                <Text style={[styles.helpText, { color: activeTheme.textSecondary, marginTop: 10 }]}>
                  {copy.iosBillingReviewNotice}
                </Text>
              ) : null}
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

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.segmentScroll}
                    contentContainerStyle={[styles.segmentRow, styles.segmentScrollContent]}
                  >
                    {transcriptionTypeOptions.map((item) => (
                      <SegmentButton
                        key={item.key}
                        label={item.label}
                        active={transcriptionType === item.key}
                        onPress={() => setTranscriptionType(item.key)}
                        theme={activeTheme}
                      />
                    ))}
                  </ScrollView>

                  <NmPressable style={[styles.secondaryButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={pickAudioFile}>
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{copy.pickFile}</Text>
                  </NmPressable>

                  <Text style={[styles.fileInfo, { color: activeTheme.textPrimary }]}>
                    {pickedFile
                      ? `${pickedFile.name} (${Math.max(1, Math.round((pickedFile.size || 0) / 1024))} KB · ${pickedFile.mimeType})`
                      : copy.noFile}
                  </Text>

                  <NmPressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                      submitting ? styles.buttonDisabled : null,
                    ]}
                    onPress={handleTranscribe}
                    disabled={submitting}
                  >
                    <Text style={styles.primaryButtonText}>{submitting ? copy.transcribing : copy.transcribeStart}</Text>
                  </NmPressable>

                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{selectedTypeHint}</Text>
                  {isGuestMode ? (
                    <Text style={[styles.helpText, { color: activeTheme.accent }]}>{copy.guestTrialHint}</Text>
                  ) : null}
                  {taskStateText ? <Text style={[styles.taskStateText, { color: activeTheme.accent }]}>{taskStateText}</Text> : null}
                </View>
              </FadeInView>

              {result ? (
                <FadeInView key="transcribe-result" delay={100}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcribeResult}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.taskId}: {result.task_id}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.itemType}: {resolveTypeLabel(result)}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.charCount}: {result.characters || 0}</Text>

                    <Text style={styles.sectionTitle}>{copy.correctedText}</Text>
                    <ScrollView
                      nestedScrollEnabled
                      style={[
                        styles.resultBox,
                        { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, height: resultTextBoxHeight },
                      ]}
                      contentContainerStyle={styles.resultScrollContent}
                      showsVerticalScrollIndicator
                      onTouchStart={lockWorkspaceScroll}
                      onTouchEnd={unlockWorkspaceScroll}
                      onTouchCancel={unlockWorkspaceScroll}
                      onResponderRelease={unlockWorkspaceScroll}
                      onResponderTerminate={unlockWorkspaceScroll}
                      onScrollBeginDrag={lockWorkspaceScroll}
                      onScrollEndDrag={unlockWorkspaceScroll}
                      onMomentumScrollBegin={lockWorkspaceScroll}
                      onMomentumScrollEnd={unlockWorkspaceScroll}
                    >
                      <Text selectable style={[styles.resultText, { color: activeTheme.textPrimary }]}>
                        {result.corrected_text || result.raw_text || ""}
                      </Text>
                    </ScrollView>

                    <View style={styles.exportActionRow}>
                      <NmPressable
                        style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                        onPress={() => handleCopyToClipboard(copy.correctedText, result.corrected_text || result.raw_text || "")}
                      >
                        <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.clipboardCopy}</Text>
                      </NmPressable>
                      <NmPressable
                        style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                        onPress={() => handleShareExport(copy.correctedText, result.corrected_text || result.raw_text || "", "txt")}
                      >
                        <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportTxt}</Text>
                      </NmPressable>
                      <NmPressable
                        style={[styles.tinyButton, styles.exportTinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                        onPress={() => handleShareExport(copy.correctedText, result.corrected_text || result.raw_text || "", "docx")}
                      >
                        <Text numberOfLines={1} style={[styles.tinyButtonText, styles.exportTinyButtonText, { color: activeTheme.textPrimary }]}>{copy.exportDocx}</Text>
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

                    {result.summary ? (
                      <View style={[styles.summaryBox, { backgroundColor: activeTheme.noticeBg }]}>
                        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{`${resolveTypeLabel(result)} ${copy.summary}`}</Text>
                        <Text selectable style={[styles.resultText, { color: activeTheme.textPrimary }]}>{result.summary}</Text>
                      </View>
                    ) : null}
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
                            style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                            onPress={() => handleLoadHistoryItem(item.task_id)}
                          >
                            <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.load}</Text>
                          </NmPressable>
                          <NmPressable
                            style={[
                              styles.tinyButton,
                              styles.billingActionButton,
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
                              style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
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
                    records.map((item) => (
                      <View key={item.id || `${item.category}-${item.created_at}`} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                        <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.title || item.category}</Text>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{formatDate(item.created_at)}</Text>
                        <Text selectable style={[styles.previewText, { color: activeTheme.textPrimary }]}>{item.content || ""}</Text>
                        <View style={styles.exportActionRow}>
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
                        </View>
                      </View>
                    ))
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
                        {isGuestMode || isIosAppStoreReviewMode ? null : (
                          <>
                            <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                              <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageStatusLabel}</Text>
                              <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingStateLabel}</Text>
                            </View>
                            {!isIosAppStoreReviewMode ? (
                              <>
                                <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                                  <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageBillingProvider}</Text>
                                  <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingProvider}</Text>
                                </View>
                                <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                                  <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageCheckoutMode}</Text>
                                  <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingCheckoutMode}</Text>
                                </View>
                              </>
                            ) : null}
                          </>
                        )}
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
                  {!isGuestMode && !isIosAppStoreReviewMode && !billingCheckoutSupported ? (
                    <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.billingUnsupported}</Text>
                  ) : null}
                  {!isGuestMode && isIosAppStoreReviewMode ? (
                    <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.iosBillingReviewNotice}</Text>
                  ) : null}

                  <View style={styles.billingActionRow}>
                    <NmPressable
                      style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                      onPress={() => {
                        clearMessages();
                        if (isGuestMode) {
                          fetchGuestUsage({ showNotice: true }).catch(() => {});
                        } else {
                          refreshUsageAndBilling(authToken, { showNotice: true }).catch(() => {});
                        }
                      }}
                      disabled={usageLoading || billingLoading}
                    >
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                        {usageLoading || billingLoading ? copy.loading : copy.usageRefresh}
                      </Text>
                    </NmPressable>
                    {isGuestMode ? (
                      <NmPressable
                        style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft }]}
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
                    ) : !isIosAppStoreReviewMode ? (
                      <NmPressable
                        style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, billingActionLoading ? styles.buttonDisabled : null]}
                        onPress={handleBillingCheckout}
                        disabled={!!billingActionLoading}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                          {billingActionLoading === "checkout" ? copy.processing : copy.usageUpgrade}
                        </Text>
                      </NmPressable>
                    ) : null}
                  </View>

                  {!isGuestMode && !isIosAppStoreReviewMode ? (
                    <View style={styles.billingActionRow}>
                      <NmPressable
                        style={[
                          styles.tinyButton,
                          styles.billingActionButton,
                          { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                          !billingPortalSupported || !billingManageSupported || !!billingActionLoading
                            ? styles.buttonDisabled
                            : null,
                        ]}
                        onPress={handleBillingPortal}
                        disabled={!billingPortalSupported || !billingManageSupported || !!billingActionLoading}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                          {billingActionLoading === "portal" ? copy.processing : copy.usageManageSubscription}
                        </Text>
                      </NmPressable>
                      <NmPressable
                        style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                        onPress={() => {
                          clearMessages();
                          handleOpenPricing();
                        }}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.usageOpenPricing}</Text>
                      </NmPressable>
                    </View>
                  ) : null}

                  {!isIosAppStoreReviewMode ? (
                    <View style={styles.billingActionRow}>
                      <NmPressable
                        style={[
                          styles.tinyButton,
                          styles.billingActionButton,
                          { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                          !canRunBillingAction || !!billingActionLoading
                            ? styles.buttonDisabled
                            : null,
                        ]}
                        onPress={handleBillingCancel}
                        disabled={!canRunBillingAction || !!billingActionLoading}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                          {billingActionLoading === "cancel" ? copy.processing : copy.usageCancelSubscription}
                        </Text>
                      </NmPressable>
                      <NmPressable
                        style={[
                          styles.tinyButton,
                          styles.billingActionButton,
                          { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                          !canRunBillingAction || !!billingActionLoading
                            ? styles.buttonDisabled
                            : null,
                        ]}
                        onPress={handleBillingRefund}
                        disabled={!canRunBillingAction || !!billingActionLoading}
                      >
                        <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                          {billingActionLoading === "refund" ? copy.processing : copy.usageRequestRefund}
                        </Text>
                      </NmPressable>
                    </View>
                  ) : null}
                </View>
              </FadeInView>

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
  billingActionRow: {
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
  billingActionButton: {
    flexGrow: 1,
    flexBasis: 88,
    alignItems: "center",
    justifyContent: "center",
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
  fileInfo: {
    color: NM.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  taskStateText: {
    color: NM.accent,
    fontWeight: "700",
    fontSize: 12,
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
  summaryBox: {
    marginTop: 8,
    borderRadius: NM.radiusSm,
    backgroundColor: NM.noticeBg,
    padding: 12,
    gap: 6,
  },
  resultText: {
    color: NM.textPrimary,
    fontSize: 12,
    lineHeight: 19,
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
    flexWrap: "nowrap",
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
