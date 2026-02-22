import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Linking,
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
import * as ExpoLinking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import NmPressable from "./components/NmPressable";
import FadeInView from "./components/FadeInView";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.mallog24.com";
const API_FALLBACK_URLS = String(
  process.env.EXPO_PUBLIC_API_FALLBACK_URLS || "https://darakbang-transcription-backend.onrender.com"
)
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const AUTH_TOKEN_KEY = "mallog24_access_token";
const UI_THEME_KEY = "mallog24_mobile_ui_theme";
const UI_THEME_MODE_KEY = "mallog24_mobile_ui_theme_mode";
const PRIVACY_CONSENT_KEY = "mallog24_privacy_policy_consent_version";
const PRIVACY_POLICY_VERSION = "2026-02-21";
const LEGAL_DOC_VERSION = process.env.EXPO_PUBLIC_LEGAL_DOC_VERSION || "v2026.02.21";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const FREE_MONTHLY_LIMIT_SECONDS = 10 * 60 * 60;
const PRICING_URL = process.env.EXPO_PUBLIC_PRICING_URL || "https://mallog24.com/pricing";
const AUTH_REQUEST_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.EXPO_PUBLIC_AUTH_REQUEST_TIMEOUT_MS) || 60000
);

const MOBILE_THEME_OPTIONS = [
  { key: "auto", label: "System", targetTheme: "" },
  { key: "light", label: "Light", targetTheme: "aurora" },
  { key: "dark", label: "Dark", targetTheme: "noir" },
];

const MOBILE_THEMES = {
  aurora: {
    bg: "#eef3ff",
    surface: "#ffffff",
    surfaceSoft: "#f6f8ff",
    light: "#ffffff",
    dark: "#8aa1d0",
    shadowTint: "#6f8ec8",
    accent: "#3f63f4",
    accentSoft: "#5b79fa",
    textPrimary: "#1f2b47",
    textSecondary: "#607093",
    inputBg: "#f6f8ff",
    inputBorder: "#d7e0f3",
    errorBg: "#fce8ea",
    errorText: "#b4233a",
    noticeBg: "#e8efff",
    noticeText: "#2458d3",
    glowA: "rgba(120, 151, 255, 0.24)",
    glowB: "rgba(198, 169, 255, 0.2)",
    glowC: "rgba(132, 198, 255, 0.18)",
    radius: 22,
    radiusSm: 14,
  },
  noir: {
    bg: "#0f1728",
    surface: "#172238",
    surfaceSoft: "#1b2943",
    light: "#223252",
    dark: "#050b17",
    shadowTint: "#040916",
    accent: "#8dacff",
    accentSoft: "#a8c0ff",
    textPrimary: "#e6edff",
    textSecondary: "#9aabce",
    inputBg: "#1a2842",
    inputBorder: "#2d3f65",
    errorBg: "#3a2028",
    errorText: "#ff98a7",
    noticeBg: "#1d2f57",
    noticeText: "#a6c2ff",
    glowA: "rgba(111, 147, 247, 0.22)",
    glowB: "rgba(76, 110, 191, 0.24)",
    glowC: "rgba(56, 84, 148, 0.2)",
    radius: 22,
    radiusSm: 14,
  },
  sunset: {
    bg: "#f8eee4",
    surface: "#fff9f2",
    surfaceSoft: "#fbf3ea",
    light: "#fff9f2",
    dark: "#caa987",
    shadowTint: "#b8845f",
    accent: "#cf6e30",
    accentSoft: "#e08546",
    textPrimary: "#3b2d24",
    textSecondary: "#7a6050",
    inputBg: "#fbf3ea",
    inputBorder: "#e0cfbd",
    errorBg: "#f6e0db",
    errorText: "#b1453a",
    noticeBg: "#f3e5d7",
    noticeText: "#a15b26",
    glowA: "rgba(255, 173, 108, 0.24)",
    glowB: "rgba(255, 212, 174, 0.2)",
    glowC: "rgba(255, 189, 142, 0.18)",
    radius: 22,
    radiusSm: 14,
  },
};

const NM = MOBILE_THEMES.aurora;

const MIME_BY_EXT = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
};

const TRANSCRIPTION_TYPES = ["sermon", "phonecall", "conversation"];
const RECORD_CATEGORIES = ["meeting_keywords", "clinical_notes", "sermon_core_summary"];
const APP_TABS = ["transcribe", "history", "records", "settings"];

const I18N = {
  ko: {
    languageOptionKo: "한국어",
    languageOptionEn: "English",
    legalMenu: "정책 메뉴",
    loadingApp: "앱 초기화 중...",
    authIntro: "AI 음성 기록, 지금 시작하세요.",
    authSubcopy: "로그인 후 바로 파일 업로드와 변환을 시작할 수 있습니다.",
    login: "로그인",
    signup: "회원가입",
    namePlaceholder: "이름",
    emailPlaceholder: "이메일",
    passwordPlaceholder: "비밀번호",
    processing: "처리 중...",
    orSocial: "또는 소셜 로그인",
    connecting: "연결 중...",
    continueGoogle: "Google로 계속하기",
    continueKakao: "Kakao로 계속하기",
    defaultUser: "로그인 사용자",
    logout: "로그아웃",
    tabs: {
      transcribe: "변환",
      history: "히스토리",
      records: "기록본",
      settings: "설정",
    },
    legal: {
      openPrivacy: "개인정보처리방침",
      openTerms: "이용약관",
      openCompanyPolicy: "회사 정책",
      openNotice: "공지사항",
      openFaq: "자주 묻는 질문",
      docVersion: "문서 버전",
      close: "닫기",
    },
    transcriptionTypes: {
      sermon: "설교",
      phonecall: "통화",
      conversation: "회의",
    },
    recordCategories: {
      meeting_keywords: "회의 중요 키워드",
      clinical_notes: "진료 도움 기록",
      sermon_core_summary: "설교 핵심 요약",
    },
    transcribeSettings: "변환 설정",
    pickFile: "파일 선택",
    noFile: "선택된 파일 없음",
    transcribeStart: "변환 시작",
    transcribing: "변환 중...",
    transcribeResult: "변환 결과",
    taskId: "작업 ID",
    itemType: "유형",
    charCount: "문자 수",
    correctedText: "교정 텍스트",
    generateSummary: "설교 요약 생성",
    generateSummaryByType: {
      sermon: "설교 요약 생성",
      phonecall: "통화 기록 요약 생성",
      conversation: "회의 요약 생성",
    },
    generatingSummary: "요약 생성 중...",
    summary: "요약",
    recordGenerateSave: "기록본 생성 및 저장",
    draft: "초안",
    drafting: "생성 중",
    save: "저장",
    saving: "저장 중",
    recordEditorPlaceholder: "{label} 내용을 여기에 편집하세요",
    historyTitle: "최근 변환 기록",
    recordsTitle: "저장 기록본",
    refresh: "새로고침",
    loading: "로딩...",
    noHistory: "변환 기록이 없습니다.",
    noRecords: "저장된 기록본이 없습니다.",
    load: "불러오기",
    selectedTypeHints: {
      sermon: "설교 흐름(본론/결론/기도) 중심으로 구조화합니다.",
      phonecall: "통화 화자 분리와 핵심 문장 중심으로 정리합니다.",
      conversation: "회의 안건/결정/후속 조치를 분리해 정리합니다.",
    },
    settingsTitle: "설정",
    settingsSubtitle: "정책 확인과 앱 환경을 관리합니다.",
    settingsLegalTitle: "법률 문서",
    settingsLegalHint: "개인정보처리방침, 이용약관, 회사 정책을 앱 내 문서 페이지에서 확인하세요.",
    settingsAppearanceTitle: "언어 및 테마",
    settingsAppearanceHint: "언어와 테마를 즉시 변경할 수 있습니다.",
    settingsLanguageLabel: "언어 선택",
    settingsThemeLabel: "테마 선택",
    settingsSupportTitle: "공지 및 도움말",
    settingsSupportHint: "업데이트 공지와 자주 묻는 질문을 앱 내 문서로 확인하세요.",
    settingsUsageTitle: "사용량 및 구독",
    settingsUsageHint: "이번 달 남은 사용 시간을 확인하고 구독 업그레이드를 진행할 수 있습니다.",
    usagePlanLabel: "현재 플랜",
    usageStatusLabel: "구독 상태",
    usageBillingProvider: "결제 공급자",
    usageCheckoutMode: "결제 모드",
    usageThisMonth: "이번 달 사용량",
    usageRemaining: "남은 시간",
    usageUnlimited: "무제한",
    usageLoading: "사용량 정보를 불러오는 중...",
    usageUnavailable: "사용량 정보를 아직 불러오지 못했습니다.",
    usageRefresh: "사용량 새로고침",
    usageUpgrade: "구독 업그레이드",
    usageManageSubscription: "구독 관리",
    usageOpenPricing: "요금제 안내 보기",
    billingUnsupported: "현재 결제 설정에서는 앱 내 결제 호출이 비활성화되어 있습니다.",
    planLabels: {
      free: "Free",
      pro: "Pro",
      enterprise: "Enterprise",
      admin: "Admin",
    },
    billingStatusLabels: {
      inactive: "미구독",
      active: "활성",
      trialing: "체험중",
      checkout_pending: "결제 대기",
      checkout_canceled: "결제 취소",
      canceled: "해지",
      past_due: "미납",
      unpaid: "미납",
      incomplete: "미완료",
      incomplete_expired: "만료",
      unknown: "확인 필요",
    },
    clipboardCopy: "클립보드 복사",
    exportTxt: "TXT 저장/공유",
    exportDocx: "DOCX 저장/공유",
    privacy: {
      title: "개인정보처리방침 동의",
      version: `정책 버전: ${LEGAL_DOC_VERSION}`,
      body: "mallog24 이용 전 개인정보 처리 내용을 확인해주세요. 동의 후 로그인 및 음성 변환 기능을 사용할 수 있습니다.",
      summaryFile: "• 원본 음성 파일: 변환 처리 후 임시 저장소에서 지체 없이 삭제",
      summaryText: "• 변환 텍스트/기록본: 히스토리 및 기록 기능 제공 목적 범위 내 보관",
      summaryVendors: "• 처리 위탁: Supabase, OpenAI, Google(Gemini)",
      summarySocial: "• 소셜 로그인: Google/Kakao 계정 정보(이메일, 프로필, UID)",
      viewPolicy: "개인정보처리방침 전문 보기",
      viewTerms: "이용약관 보기",
      viewCompanyPolicy: "회사 정책 보기",
      check: "개인정보처리방침을 확인했고 동의합니다.",
      accept: "동의하고 시작하기",
      saving: "저장 중...",
    },
    notices: {
      socialLoginDone: "소셜 로그인이 완료되었습니다.",
      authDoneSignup: "회원가입/로그인이 완료되었습니다.",
      authDoneLogin: "로그인되었습니다.",
      signupDone: "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.",
      loggedOut: "로그아웃되었습니다.",
      fileSelected: "파일이 선택되었습니다.",
      transcribeDone: "변환이 완료되었습니다.",
      requestAccepted: "요청이 접수되었습니다.",
      historyLoaded: "히스토리 결과를 불러왔습니다.",
      summaryDone: "요약을 생성했습니다.",
      draftDone: "{label} 초안을 생성했습니다.",
      recordSaved: "기록본을 저장했습니다.",
      privacyAccepted: "개인정보처리방침 동의가 완료되었습니다.",
      copiedToClipboard: "{label} 내용을 클립보드에 복사했습니다.",
      openedShareTxt: "TXT 저장/공유 창을 열었습니다.",
      openedShareDocx: "DOCX 저장/공유 창을 열었습니다.",
      usageLoaded: "사용량 정보를 업데이트했습니다.",
      checkoutOpened: "결제 페이지를 열었습니다.",
      portalOpened: "구독 관리 페이지를 열었습니다.",
    },
    errors: {
      authRequired: "로그인 후 파일 변환을 사용할 수 있습니다.",
      authInputRequired: "이메일/비밀번호를 입력해주세요.",
      passwordMin: "비밀번호는 8자 이상이어야 합니다.",
      oauthUrlCreate: "OAuth URL 생성 실패",
      openLoginUrl: "로그인 URL을 열 수 없습니다.",
      socialStartFailed: "소셜 로그인 시작 실패",
      socialSessionFailed: "소셜 로그인 세션 처리 실패",
      socialFailedPrefix: "소셜 로그인 실패",
      fileTooLarge: "파일 크기는 100MB 이하여야 합니다.",
      filePickFailed: "파일 선택 실패",
      fileNotSelected: "먼저 파일을 선택해주세요.",
      transcribeFailed: "변환 요청 실패",
      taskNotFound: "작업 상태를 찾을 수 없습니다.",
      transcribeError: "변환 중 오류가 발생했습니다.",
      statusFailed: "상태 조회 실패",
      historyReadFailed: "히스토리 조회 실패",
      recordsReadFailed: "기록본 조회 실패",
      historyLoadFailed: "히스토리 불러오기 실패",
      historyLoadOnlyCompleted: "완료된 작업만 불러올 수 있습니다.",
      summaryFailed: "요약 실패",
      summaryNoText: "요약할 텍스트가 없습니다.",
      draftNeedLogin: "로그인 후 기록본 초안을 생성할 수 있습니다.",
      draftNoSource: "기록본 초안 생성에 필요한 변환 결과가 없습니다.",
      draftFailed: "기록본 초안 생성 실패",
      saveNeedLogin: "로그인 후 기록본 저장이 가능합니다.",
      saveNoContent: "저장할 기록본 내용이 없습니다.",
      saveFailed: "기록본 저장 실패",
      noExportContent: "내보낼 내용이 없습니다.",
      clipboardFailed: "클립보드 복사에 실패했습니다.",
      shareFailed: "공유 창을 열지 못했습니다.",
      exportModuleMissing: "파일 내보내기 모듈이 없습니다. 앱 의존성을 업데이트해 주세요.",
      shareUnavailable: "이 기기에서는 파일 공유를 지원하지 않습니다.",
      openPrivacyFailed: "개인정보처리방침 페이지를 열 수 없습니다.",
      openPrivacyLinkFailed: "개인정보처리방침 링크를 열 수 없습니다.",
      openTermsFailed: "이용약관 페이지를 열 수 없습니다.",
      openTermsLinkFailed: "이용약관 링크를 열 수 없습니다.",
      openCompanyPolicyFailed: "회사 정책 페이지를 열 수 없습니다.",
      openCompanyPolicyLinkFailed: "회사 정책 링크를 열 수 없습니다.",
      privacySaveFailed: "동의 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
      usageReadFailed: "사용량 정보를 불러오지 못했습니다.",
      billingStatusReadFailed: "구독 상태를 불러오지 못했습니다.",
      billingCheckoutFailed: "결제 페이지를 열지 못했습니다.",
      billingPortalFailed: "구독 관리 페이지를 열지 못했습니다.",
      openExternalFailed: "외부 페이지를 열 수 없습니다.",
      requestFailedPrefix: "요청 실패",
      timeout: "요청 시간이 초과되었습니다. 서버 상태를 확인해주세요.",
    },
    taskState: {
      waiting: "변환 작업 대기 중...",
      queued: "변환 대기 중...",
      processing: "음성 인식/교정 처리 중...",
      done: "완료",
      uploading: "업로드 중...",
      historyLoading: "히스토리 불러오는 중...",
    },
    authErrors: {
      invalidCredentials: "이메일/비밀번호가 일치하지 않습니다. 기존 계정이 Google/Kakao로 가입된 계정이면 소셜 로그인 버튼을 사용하세요.",
      emailNotConfirmed: "이메일 인증이 완료되지 않았습니다. 인증 메일 확인 후 다시 로그인해주세요.",
      timeout: "인증 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
      default: "인증 처리 실패",
    },
  },
  en: {
    languageOptionKo: "Korean",
    languageOptionEn: "English",
    legalMenu: "Legal menu",
    loadingApp: "Initializing app...",
    authIntro: "Start AI speech records now.",
    authSubcopy: "Sign in to upload files and start transcription.",
    login: "Log In",
    signup: "Sign Up",
    namePlaceholder: "Name",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    processing: "Processing...",
    orSocial: "or continue with social login",
    connecting: "Connecting...",
    continueGoogle: "Continue with Google",
    continueKakao: "Continue with Kakao",
    defaultUser: "Signed-in user",
    logout: "Log out",
    tabs: {
      transcribe: "Transcribe",
      history: "History",
      records: "Records",
      settings: "Settings",
    },
    legal: {
      openPrivacy: "Privacy Policy",
      openTerms: "Terms of Service",
      openCompanyPolicy: "Company Policy",
      openNotice: "Notices",
      openFaq: "FAQ",
      docVersion: "Doc version",
      close: "Close",
    },
    transcriptionTypes: {
      sermon: "Sermon",
      phonecall: "Call",
      conversation: "Meeting",
    },
    recordCategories: {
      meeting_keywords: "Meeting Keywords",
      clinical_notes: "Clinical Notes",
      sermon_core_summary: "Sermon Core Summary",
    },
    transcribeSettings: "Transcription Settings",
    pickFile: "Choose File",
    noFile: "No file selected",
    transcribeStart: "Start Transcription",
    transcribing: "Transcribing...",
    transcribeResult: "Transcription Result",
    taskId: "Task ID",
    itemType: "Type",
    charCount: "Characters",
    correctedText: "Corrected Text",
    generateSummary: "Generate Summary",
    generateSummaryByType: {
      sermon: "Generate Sermon Summary",
      phonecall: "Generate Call Summary",
      conversation: "Generate Meeting Summary",
    },
    generatingSummary: "Generating summary...",
    summary: "Summary",
    recordGenerateSave: "Generate & Save Records",
    draft: "Draft",
    drafting: "Drafting",
    save: "Save",
    saving: "Saving",
    recordEditorPlaceholder: "Edit {label} content here",
    historyTitle: "Recent History",
    recordsTitle: "Saved Records",
    refresh: "Refresh",
    loading: "Loading...",
    noHistory: "No transcription history.",
    noRecords: "No saved records.",
    load: "Load",
    selectedTypeHints: {
      sermon: "Structures content by sermon flow (message/application/prayer).",
      phonecall: "Focuses on speaker separation and core call statements.",
      conversation: "Separates agenda, decisions, and action items for meetings.",
    },
    settingsTitle: "Settings",
    settingsSubtitle: "Manage legal documents and app preferences.",
    settingsLegalTitle: "Legal Documents",
    settingsLegalHint: "Review privacy policy, terms of service, and company policy in the in-app document page.",
    settingsAppearanceTitle: "Language & Theme",
    settingsAppearanceHint: "Change language and theme instantly.",
    settingsLanguageLabel: "Language",
    settingsThemeLabel: "Theme",
    settingsSupportTitle: "Notices & Help",
    settingsSupportHint: "Read product updates and frequently asked questions in the in-app document page.",
    settingsUsageTitle: "Usage & Subscription",
    settingsUsageHint: "Check remaining monthly time and open subscription actions.",
    usagePlanLabel: "Current plan",
    usageStatusLabel: "Subscription status",
    usageBillingProvider: "Billing provider",
    usageCheckoutMode: "Checkout mode",
    usageThisMonth: "This month usage",
    usageRemaining: "Remaining",
    usageUnlimited: "Unlimited",
    usageLoading: "Loading usage information...",
    usageUnavailable: "Usage information is not available yet.",
    usageRefresh: "Refresh usage",
    usageUpgrade: "Upgrade subscription",
    usageManageSubscription: "Manage subscription",
    usageOpenPricing: "Open pricing page",
    billingUnsupported: "In-app checkout is currently disabled for this billing setup.",
    planLabels: {
      free: "Free",
      pro: "Pro",
      enterprise: "Enterprise",
      admin: "Admin",
    },
    billingStatusLabels: {
      inactive: "Inactive",
      active: "Active",
      trialing: "Trialing",
      checkout_pending: "Checkout pending",
      checkout_canceled: "Checkout canceled",
      canceled: "Canceled",
      past_due: "Past due",
      unpaid: "Unpaid",
      incomplete: "Incomplete",
      incomplete_expired: "Expired",
      unknown: "Unknown",
    },
    clipboardCopy: "Copy to Clipboard",
    exportTxt: "Save/Share TXT",
    exportDocx: "Save/Share DOCX",
    privacy: {
      title: "Privacy Policy Consent",
      version: `Policy version: ${LEGAL_DOC_VERSION}`,
      body: "Please review our privacy handling details before using mallog24. You can use login and transcription after consent.",
      summaryFile: "• Source audio files: removed from temporary storage after processing",
      summaryText: "• Transcribed text/records: retained only for history and record features",
      summaryVendors: "• Processors: Supabase, OpenAI, Google (Gemini)",
      summarySocial: "• Social login: Google/Kakao account data (email, profile, UID)",
      viewPolicy: "View full privacy policy",
      viewTerms: "View terms of service",
      viewCompanyPolicy: "View company policy",
      check: "I have reviewed and agree to the Privacy Policy.",
      accept: "Agree and Continue",
      saving: "Saving...",
    },
    notices: {
      socialLoginDone: "Social login completed.",
      authDoneSignup: "Sign-up and login completed.",
      authDoneLogin: "Logged in successfully.",
      signupDone: "Sign-up completed. Please verify your email before login.",
      loggedOut: "You have been logged out.",
      fileSelected: "File selected.",
      transcribeDone: "Transcription completed.",
      requestAccepted: "Request accepted.",
      historyLoaded: "Loaded selected history result.",
      summaryDone: "Summary generated.",
      draftDone: "{label} draft generated.",
      recordSaved: "Record saved.",
      privacyAccepted: "Privacy consent saved.",
      copiedToClipboard: "{label} copied to clipboard.",
      openedShareTxt: "TXT save/share sheet opened.",
      openedShareDocx: "DOCX save/share sheet opened.",
      usageLoaded: "Usage information updated.",
      checkoutOpened: "Checkout page opened.",
      portalOpened: "Subscription portal opened.",
    },
    errors: {
      authRequired: "Please log in to use transcription.",
      authInputRequired: "Please enter email and password.",
      passwordMin: "Password must be at least 8 characters.",
      oauthUrlCreate: "Failed to create OAuth URL.",
      openLoginUrl: "Unable to open login URL.",
      socialStartFailed: "Failed to start social login",
      socialSessionFailed: "Failed to process social login session",
      socialFailedPrefix: "Social login failed",
      fileTooLarge: "File size must be 100MB or less.",
      filePickFailed: "Failed to select file",
      fileNotSelected: "Please select a file first.",
      transcribeFailed: "Failed to request transcription",
      taskNotFound: "Task status not found.",
      transcribeError: "An error occurred during transcription.",
      statusFailed: "Failed to check task status",
      historyReadFailed: "Failed to fetch history",
      recordsReadFailed: "Failed to fetch records",
      historyLoadFailed: "Failed to load history item",
      historyLoadOnlyCompleted: "Only completed tasks can be loaded.",
      summaryFailed: "Failed to generate summary",
      summaryNoText: "No text available to summarize.",
      draftNeedLogin: "Log in to generate record drafts.",
      draftNoSource: "No source text available for draft generation.",
      draftFailed: "Failed to generate record draft",
      saveNeedLogin: "Log in to save records.",
      saveNoContent: "No record content to save.",
      saveFailed: "Failed to save record",
      noExportContent: "No content to export.",
      clipboardFailed: "Failed to copy to clipboard.",
      shareFailed: "Unable to open share sheet.",
      exportModuleMissing: "File export modules are missing. Please update app dependencies.",
      shareUnavailable: "File sharing is not available on this device.",
      openPrivacyFailed: "Unable to open the privacy policy page.",
      openPrivacyLinkFailed: "Unable to open privacy policy link.",
      openTermsFailed: "Unable to open terms of service page.",
      openTermsLinkFailed: "Unable to open terms of service link.",
      openCompanyPolicyFailed: "Unable to open company policy page.",
      openCompanyPolicyLinkFailed: "Unable to open company policy link.",
      privacySaveFailed: "Failed to save consent state. Please try again.",
      usageReadFailed: "Failed to load usage information.",
      billingStatusReadFailed: "Failed to load subscription status.",
      billingCheckoutFailed: "Failed to open checkout page.",
      billingPortalFailed: "Failed to open subscription portal.",
      openExternalFailed: "Unable to open external page.",
      requestFailedPrefix: "Request failed",
      timeout: "Request timed out. Please check server status.",
    },
    taskState: {
      waiting: "Waiting for transcription task...",
      queued: "Queued...",
      processing: "Running speech recognition/correction...",
      done: "Done",
      uploading: "Uploading...",
      historyLoading: "Loading history item...",
    },
    authErrors: {
      invalidCredentials: "Email/password is incorrect. If this account was created with Google/Kakao, use social login.",
      emailNotConfirmed: "Email verification is not complete. Please verify your email first.",
      timeout: "Auth server response is delayed. Please try again shortly.",
      default: "Authentication failed",
    },
  },
};

const LEGAL_DOCUMENTS = {
  ko: {
    privacy: {
      title: "개인정보처리방침",
      version: LEGAL_DOC_VERSION,
      updatedAt: "최종 업데이트: 2026년 2월 21일",
      sections: [
        {
          title: "1. 처리 항목",
          body: [
            "회원정보(이메일/UID), 소셜로그인 정보, 업로드 음성, 변환 텍스트, 기록본, 접속/오류 로그를 처리할 수 있습니다.",
          ],
        },
        {
          title: "2. 처리 목적",
          body: [
            "로그인/계정보호, 전사·교정·요약·기록본 기능 제공, 서비스 보안 및 고객지원 목적입니다.",
          ],
        },
        {
          title: "3. 보관 및 파기",
          body: [
            "원본 음성은 임시 저장 후 처리 완료 시 지체 없이 삭제합니다.",
            "변환 결과/기록본은 기능 제공 범위 내 보관되며 삭제 요청 또는 계정 종료 시 파기됩니다.",
          ],
        },
        {
          title: "4. 위탁 및 국외 처리",
          body: [
            "Supabase(인증/DB), OpenAI(Whisper), Google(Gemini)를 이용하며 API 처리 과정에서 국외 서버 처리가 발생할 수 있습니다.",
          ],
        },
        {
          title: "5. 이용자 권리",
          body: [
            "열람·정정·삭제·처리정지를 요청할 수 있으며, 문의 메일로 접수 시 합리적 기간 내 안내합니다.",
            "민감정보 업로드는 지양해 주세요.",
          ],
        },
        {
          title: "6. 문의",
          body: ["문의: ours113814@gmail.com"],
        },
      ],
    },
    terms: {
      title: "이용약관",
      version: LEGAL_DOC_VERSION,
      updatedAt: "시행일: 2026년 2월 21일",
      sections: [
        {
          title: "1. 서비스 범위",
          body: [
            "mallog24는 음성 전사/교정/요약/기록본 저장 기능을 제공합니다.",
            "외부 API 연동 특성상 처리시간과 결과 품질은 환경에 따라 달라질 수 있습니다.",
          ],
        },
        {
          title: "2. 계정 및 사용량",
          body: [
            "계정·세션 관리 책임은 이용자에게 있으며, 무료 플랜은 월간 사용량 한도가 적용됩니다.",
            "유료 결제 도입 시 가격/환불/해지 기준을 별도 고지합니다.",
          ],
        },
        {
          title: "3. 이용자 책임",
          body: [
            "업로드 자료에 대한 적법한 권리를 보유해야 하며, 타인 권리 침해 자료 업로드를 금지합니다.",
          ],
        },
        {
          title: "4. 금지 행위",
          body: [
            "서비스 우회/공격/비정상 자동화 트래픽, 무단 재판매, 역설계 등 운영을 저해하는 행위를 금지합니다.",
          ],
        },
        {
          title: "5. 제한 및 면책",
          body: [
            "약관 위반 또는 보안위험 시 이용이 제한될 수 있습니다.",
            "전사 결과는 보조 도구이며 최종 검토 책임은 이용자에게 있습니다.",
          ],
        },
        {
          title: "6. 문의",
          body: ["문의: ours113814@gmail.com"],
        },
      ],
    },
    companyPolicy: {
      title: "회사 정책",
      version: LEGAL_DOC_VERSION,
      updatedAt: "최종 업데이트: 2026년 2월 21일",
      sections: [
        {
          title: "1. 운영 원칙",
          body: [
            "정확도·보안·안정성을 우선으로 제품을 개선합니다.",
            "사용자가 빠르게 기록을 재활용할 수 있는 단순한 흐름을 유지합니다.",
          ],
        },
        {
          title: "2. 데이터/보안 정책",
          body: [
            "최소 데이터 처리, 권한 분리, HTTPS, 토큰 검증, 요청 제한을 기본 통제로 적용합니다.",
          ],
        },
        {
          title: "3. 품질 정책",
          body: [
            "자동 생성 결과의 사용자 최종 검토를 권장하며, 도메인별 용어 사전/프롬프트를 지속 개선합니다.",
          ],
        },
        {
          title: "4. 책임 있는 AI",
          body: [
            "업로드 데이터는 서비스 목적 내에서만 처리합니다.",
            "불법/권리침해 신고는 내부 기준으로 검토 후 제한 조치할 수 있습니다.",
          ],
        },
        {
          title: "5. 공지 및 지원",
          body: [
            "주요 정책/장애/기능 변경은 웹/앱 공지로 안내합니다.",
            "문의: ours113814@gmail.com",
          ],
        },
      ],
    },
    notice: {
      title: "공지사항",
      version: LEGAL_DOC_VERSION,
      updatedAt: "최종 업데이트: 2026년 2월 21일",
      sections: [
        {
          title: "1. 서비스 안정화 안내",
          body: [
            "대용량 파일 처리 시 응답 지연이 발생할 수 있으며, 처리 상태는 작업 ID 기준으로 계속 확인할 수 있습니다.",
            "백엔드 점검이 필요한 경우 앱 내 배너와 웹 공지를 통해 사전 안내합니다.",
          ],
        },
        {
          title: "2. 정책 문서 개정 안내",
          body: [
            "개인정보처리방침/이용약관/회사정책 개정 시 문서 버전과 시행일을 함께 고지합니다.",
            "중요 변경 사항은 앱 초기 화면 또는 설정 탭에서 확인할 수 있습니다.",
          ],
        },
        {
          title: "3. 문의 채널",
          body: [
            "서비스 관련 문의: ours113814@gmail.com",
          ],
        },
      ],
    },
    faq: {
      title: "자주 묻는 질문 (FAQ)",
      version: LEGAL_DOC_VERSION,
      updatedAt: "최종 업데이트: 2026년 2월 21일",
      sections: [
        {
          title: "Q1. 로그인은 되는데 처리 시작이 느립니다.",
          body: [
            "네트워크 상태, 백엔드 인스턴스 워밍업, 외부 AI API 응답 시간에 따라 초기 지연이 발생할 수 있습니다.",
            "잠시 후 다시 시도하거나 앱을 재실행하면 개선되는 경우가 많습니다.",
          ],
        },
        {
          title: "Q2. 파일 업로드가 실패합니다.",
          body: [
            "파일 용량(최대 100MB), 포맷(mp3/wav/m4a/mp4/webm)과 로그인 상태를 먼저 확인해 주세요.",
            "오류가 반복되면 파일명을 단순화하고 네트워크를 변경해 다시 시도해 주세요.",
          ],
        },
        {
          title: "Q3. 전사 결과가 기대와 다릅니다.",
          body: [
            "배경소음이 적고 화자 구분이 명확한 원본 음성을 권장합니다.",
            "변환 후 요약/기록본 기능으로 문맥을 재정리하면 정확도를 높일 수 있습니다.",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy Policy",
      version: LEGAL_DOC_VERSION,
      updatedAt: "Last updated: February 21, 2026",
      sections: [
        {
          title: "1. Data We Process",
          body: [
            "We may process account data (email/UID), social-login data, uploaded audio, transcript text, saved records, and access/error logs.",
          ],
        },
        {
          title: "2. Purpose",
          body: [
            "Used for authentication, account security, transcription/correction/summarization, records, support, and service protection.",
          ],
        },
        {
          title: "3. Retention and Deletion",
          body: [
            "Source audio is kept in temporary storage and removed promptly after processing.",
            "Transcripts/records are kept for service features and removed on request or account closure.",
          ],
        },
        {
          title: "4. Processors and Overseas Processing",
          body: [
            "We use Supabase (auth/DB), OpenAI (Whisper), and Google (Gemini). API processing may involve overseas infrastructure.",
          ],
        },
        {
          title: "5. User Rights",
          body: [
            "You may request access, correction, deletion, and restriction via support email. Avoid uploading unnecessary sensitive data.",
          ],
        },
        {
          title: "6. Contact",
          body: ["Contact: ours113814@gmail.com"],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      version: LEGAL_DOC_VERSION,
      updatedAt: "Effective date: February 21, 2026",
      sections: [
        {
          title: "1. Service Scope",
          body: [
            "mallog24 provides speech transcription, correction, summarization, and structured record features.",
            "Processing time and output quality may vary due to external API dependencies.",
          ],
        },
        {
          title: "2. Account and Usage Limits",
          body: [
            "Users are responsible for account/session security. Free plans are subject to monthly usage quotas.",
            "Paid-plan pricing, refund, and cancellation terms are disclosed when billing is enabled.",
          ],
        },
        {
          title: "3. User Responsibility",
          body: [
            "Users must have lawful rights to uploaded content and must not infringe third-party rights.",
          ],
        },
        {
          title: "4. Prohibited Conduct",
          body: [
            "Abuse, attacks, bypass attempts, abnormal automation traffic, reverse engineering, and unauthorized resale are prohibited.",
          ],
        },
        {
          title: "5. Restriction and Disclaimer",
          body: [
            "Access may be limited for policy violations or security risks.",
            "Generated outputs are assistive; users are responsible for final review and use.",
          ],
        },
        {
          title: "6. Contact",
          body: ["Contact: ours113814@gmail.com"],
        },
      ],
    },
    companyPolicy: {
      title: "Company Policy",
      version: LEGAL_DOC_VERSION,
      updatedAt: "Last updated: February 21, 2026",
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
            "We apply data minimization, role separation, HTTPS, token validation, and request throttling as baseline controls.",
          ],
        },
        {
          title: "3. Quality Policy",
          body: [
            "Machine-generated outputs should be user-reviewed. Domain-specific prompts and dictionaries are continuously refined.",
          ],
        },
        {
          title: "4. Responsible AI Use",
          body: [
            "Uploaded data is used only for service functionality.",
            "Reported illegal or rights-infringing usage may lead to restrictions under internal policy.",
          ],
        },
        {
          title: "5. Notice and Support",
          body: [
            "Major policy/feature/incident updates are announced via web or in-app notices.",
            "Contact: ours113814@gmail.com",
          ],
        },
      ],
    },
    notice: {
      title: "Notices",
      version: LEGAL_DOC_VERSION,
      updatedAt: "Last updated: February 21, 2026",
      sections: [
        {
          title: "1. Service Stability Notice",
          body: [
            "Large files may take longer to process. You can keep tracking status using the task ID.",
            "If backend maintenance is required, we provide advance notice in-app and on the web.",
          ],
        },
        {
          title: "2. Policy Revision Notice",
          body: [
            "When privacy/terms/company policy changes, we announce both document version and effective date.",
            "Major changes are highlighted on the app entry flow or in the Settings tab.",
          ],
        },
        {
          title: "3. Support Channel",
          body: [
            "Service inquiries: ours113814@gmail.com",
          ],
        },
      ],
    },
    faq: {
      title: "Frequently Asked Questions (FAQ)",
      version: LEGAL_DOC_VERSION,
      updatedAt: "Last updated: February 21, 2026",
      sections: [
        {
          title: "Q1. Login works, but processing starts slowly.",
          body: [
            "Initial delays can happen due to network conditions, backend warm-up, or external AI API latency.",
            "Retrying after a short wait or relaunching the app often helps.",
          ],
        },
        {
          title: "Q2. Upload keeps failing.",
          body: [
            "Check file size (max 100MB), supported formats (mp3/wav/m4a/mp4/webm), and sign-in status.",
            "If it keeps failing, simplify the file name and retry on a different network.",
          ],
        },
        {
          title: "Q3. Transcript quality is lower than expected.",
          body: [
            "Use cleaner audio with clear speaker separation when possible.",
            "Post-process with summary/record features to improve final readability and structure.",
          ],
        },
      ],
    },
  },
};

function parseResponseText(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

function isTimeoutErrorMessage(message) {
  return /timed out|timeout|시간 초과/i.test(String(message || ""));
}

function isNetworkFetchError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    message.includes("could not resolve host")
  );
}

function getFriendlyAuthError(message, copy) {
  const raw = (message || "").trim();
  const normalized = raw.toLowerCase();
  const authErrors = copy?.authErrors || I18N.ko.authErrors;

  if (normalized.includes("invalid login credentials")) {
    return authErrors.invalidCredentials;
  }
  if (normalized.includes("email not confirmed")) {
    return authErrors.emailNotConfirmed;
  }
  if (normalized.includes("timeout")) {
    return authErrors.timeout;
  }
  return raw || authErrors.default;
}

async function requestApi(path, { method = "GET", token = "", body = undefined, timeoutMs = 20000 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const baseCandidates = [API_URL, ...API_FALLBACK_URLS].filter(Boolean).filter((value, idx, arr) => arr.indexOf(value) === idx);
  let lastError = null;

  for (let idx = 0; idx < baseCandidates.length; idx += 1) {
    const baseUrl = baseCandidates[idx];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const data = parseResponseText(rawText);

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
      }

      return data;
    } catch (e) {
      lastError = e;
      const isTimeout = e?.name === "AbortError" || isTimeoutErrorMessage(e?.message);
      const canFallback = idx < baseCandidates.length - 1 && (isTimeout || isNetworkFetchError(e));
      if (!canFallback) {
        if (isTimeout) {
          throw new Error("Request timed out. Please check server status.");
        }
        throw e;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError?.name === "AbortError" || isTimeoutErrorMessage(lastError?.message)) {
    throw new Error("Request timed out. Please check server status.");
  }
  throw lastError || new Error("Request failed.");
}

function normalizeMimeType(value) {
  const raw = (value || "").toLowerCase().split(";", 1)[0].trim();
  if (!raw || raw === "application/octet-stream") return "";
  if (raw === "audio/mp3") return "audio/mpeg";
  if (raw === "audio/x-wav" || raw === "audio/wave") return "audio/wav";
  if (raw === "audio/x-m4a" || raw === "video/mp4") return "audio/mp4";
  return raw;
}

function getExtension(filename = "") {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

function inferMimeFromAsset(asset) {
  const normalized = normalizeMimeType(asset?.mimeType);
  if (normalized) return normalized;
  const ext = getExtension(asset?.name || "");
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  return "audio/mpeg";
}

function parseAuthParamsFromUrl(url) {
  if (!url) return { accessToken: "", oauthError: "" };

  const parts = url.split("#");
  const beforeHash = parts[0] || "";
  const hash = parts[1] || "";
  const query = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";

  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  const accessToken =
    hashParams.get("access_token") || queryParams.get("access_token") || "";
  const oauthError =
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error_description") ||
    queryParams.get("error") ||
    "";

  return { accessToken, oauthError };
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || "";
  }
}

function formatSecondsToHourMinute(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function utf8Encode(text) {
  const value = String(text || "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  const encoded = encodeURIComponent(value);
  const out = [];
  for (let i = 0; i < encoded.length; i += 1) {
    const ch = encoded[i];
    if (ch === "%") {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(ch.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const idx = (crc ^ bytes[i]) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[idx];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUInt32LE(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function concatUint8Arrays(arrays) {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((arr) => {
    out.set(arr, offset);
    offset += arr.length;
  });
  return out;
}

function buildZipFile(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach((file) => {
    const nameBytes = utf8Encode(file.path);
    const dataBytes = utf8Encode(file.content);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUInt32LE(localView, 0, 0x04034b50);
    writeUInt16LE(localView, 4, 20);
    writeUInt16LE(localView, 6, 0);
    writeUInt16LE(localView, 8, 0);
    writeUInt16LE(localView, 10, 0);
    writeUInt16LE(localView, 12, 0);
    writeUInt32LE(localView, 14, crc);
    writeUInt32LE(localView, 18, dataBytes.length);
    writeUInt32LE(localView, 22, dataBytes.length);
    writeUInt16LE(localView, 26, nameBytes.length);
    writeUInt16LE(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUInt32LE(centralView, 0, 0x02014b50);
    writeUInt16LE(centralView, 4, 20);
    writeUInt16LE(centralView, 6, 20);
    writeUInt16LE(centralView, 8, 0);
    writeUInt16LE(centralView, 10, 0);
    writeUInt16LE(centralView, 12, 0);
    writeUInt16LE(centralView, 14, 0);
    writeUInt32LE(centralView, 16, crc);
    writeUInt32LE(centralView, 20, dataBytes.length);
    writeUInt32LE(centralView, 24, dataBytes.length);
    writeUInt16LE(centralView, 28, nameBytes.length);
    writeUInt16LE(centralView, 30, 0);
    writeUInt16LE(centralView, 32, 0);
    writeUInt16LE(centralView, 34, 0);
    writeUInt16LE(centralView, 36, 0);
    writeUInt32LE(centralView, 38, 0);
    writeUInt32LE(centralView, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + dataBytes.length;
  });

  const centralDirectory = concatUint8Arrays(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUInt32LE(endView, 0, 0x06054b50);
  writeUInt16LE(endView, 4, 0);
  writeUInt16LE(endView, 6, 0);
  writeUInt16LE(endView, 8, files.length);
  writeUInt16LE(endView, 10, files.length);
  writeUInt32LE(endView, 12, centralDirectory.length);
  writeUInt32LE(endView, 16, localOffset);
  writeUInt16LE(endView, 20, 0);

  return concatUint8Arrays([...localParts, centralDirectory, end]);
}

function uint8ToBase64(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += chars[(triple >> 18) & 0x3f];
    output += chars[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? chars[(triple >> 6) & 0x3f] : "=";
    output += i + 2 < bytes.length ? chars[triple & 0x3f] : "=";
  }
  return output;
}

function buildDocxBase64(title, text) {
  const paragraphs = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === "" && idx === arr.length - 1))
    .map((line) => {
      const safe = escapeXml(line === "" ? " " : line);
      return `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`;
    })
    .join("");

  const safeTitle = escapeXml(title || "mallog24");
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${safeTitle}</w:t></w:r></w:p>
    ${paragraphs || "<w:p><w:r><w:t xml:space=\"preserve\"> </w:t></w:r></w:p>"}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zipBytes = buildZipFile([
    { path: "[Content_Types].xml", content: contentTypes },
    { path: "_rels/.rels", content: rels },
    { path: "word/document.xml", content: documentXml },
  ]);

  return uint8ToBase64(zipBytes);
}

function sanitizeFileName(input) {
  return String(input || "mallog24")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48);
}

function SegmentButton({ label, active, onPress, theme }) {
  return (
    <NmPressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        { borderColor: theme.inputBorder },
        active
          ? [styles.segmentButtonActive, { backgroundColor: theme.bg, shadowColor: theme.dark }]
          : { backgroundColor: "transparent" },
      ]}
      scaleDown={0.95}
    >
      <Text
        style={[
          styles.segmentButtonText,
          { color: theme.textSecondary },
          active ? [styles.segmentButtonTextActive, { color: theme.accent }] : null,
        ]}
      >
        {label}
      </Text>
    </NmPressable>
  );
}

function Banner({ type = "notice", text }) {
  if (!text) return null;
  return (
    <FadeInView duration={300}>
      <View style={[styles.banner, type === "error" ? styles.bannerError : styles.bannerNotice]}>
        <Text style={[styles.bannerText, type === "error" ? styles.bannerTextError : styles.bannerTextNotice]}>
          {text}
        </Text>
      </View>
    </FadeInView>
  );
}

function App() {
  const pollRef = useRef(null);
  const scrollUnlockTimerRef = useRef(null);
  const colorScheme = useColorScheme();
  const { width: screenWidth, height: screenHeight, fontScale } = useWindowDimensions();

  const [bootLoading, setBootLoading] = useState(true);
  const [themeMode, setThemeMode] = useState("auto");
  const [themeKey, setThemeKey] = useState("aurora");
  const [openSettingsMenu, setOpenSettingsMenu] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");

  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState("");

  const [activeTab, setActiveTab] = useState("transcribe");

  const [language, setLanguage] = useState("ko");
  const [transcriptionType, setTranscriptionType] = useState("sermon");
  const [pickedFile, setPickedFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [taskStateText, setTaskStateText] = useState("");
  const [result, setResult] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

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

  const isLoggedIn = !!authToken && !!authUser;
  const copy = I18N[language] || I18N.ko;
  const legalDocs = LEGAL_DOCUMENTS[language] || LEGAL_DOCUMENTS.ko;
  const activeLegalDoc = legalModalDocType ? legalDocs[legalModalDocType] || null : null;
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
  const transcriptionTypeOptions = useMemo(
    () => TRANSCRIPTION_TYPES.map((key) => ({ key, label: copy.transcriptionTypes[key] || key })),
    [copy]
  );
  const recordCategoryOptions = useMemo(
    () => RECORD_CATEGORIES.map((key) => ({ key, label: copy.recordCategories[key] || key })),
    [copy]
  );
  const tabOptions = useMemo(
    () => APP_TABS.map((key) => ({ key, label: copy.tabs[key] || key })),
    [copy]
  );
  const usagePlan = String(usage?.plan_tier || "free");
  const isFreeUsagePlan = usagePlan === "free";
  const usedAudioSeconds = Math.max(0, Number(usage?.used_audio_seconds) || 0);
  const monthlyLimitSeconds = Math.max(
    1,
    Number(usage?.monthly_limit_seconds) || FREE_MONTHLY_LIMIT_SECONDS
  );
  const remainingAudioSeconds = isFreeUsagePlan
    ? Math.max(0, Number(usage?.remaining_seconds ?? monthlyLimitSeconds - usedAudioSeconds))
    : null;
  const usagePercent = isFreeUsagePlan
    ? Math.max(0, Math.min(100, Number(usage?.usage_percent) || 0))
    : 0;
  const billingProvider = String(billingStatus?.provider || "portone");
  const billingState = String(billingStatus?.status || "inactive");
  const billingCheckoutMode = String(billingStatus?.checkout_mode || "disabled");
  const billingCheckoutSupported = Boolean(billingStatus?.checkout_supported);
  const billingPortalSupported = Boolean(billingStatus?.portal_supported);
  const billingManageSupported = Boolean(billingStatus?.can_manage_subscription);
  const planLabel = copy.planLabels?.[usagePlan] || usagePlan;
  const billingStateLabel = copy.billingStatusLabels?.[billingState] || billingState;

  useEffect(() => {
    setOpenSettingsMenu("");
  }, [isLoggedIn]);

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

  const warmUpBackend = () => {
    requestApi("/health", { timeoutMs: 4000 }).catch(() => { });
  };

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const updateWorkspaceScrollLock = (locked) => {
    setWorkspaceScrollEnabled((prev) => {
      const next = !locked;
      return prev === next ? prev : next;
    });
  };

  const clearScrollUnlockTimer = () => {
    if (scrollUnlockTimerRef.current) {
      clearTimeout(scrollUnlockTimerRef.current);
      scrollUnlockTimerRef.current = null;
    }
  };

  const lockWorkspaceScroll = () => {
    updateWorkspaceScrollLock(true);
    clearScrollUnlockTimer();
    // Android nested scroll 이벤트 누락 시 고착 방지용 자동 해제
    scrollUnlockTimerRef.current = setTimeout(() => {
      updateWorkspaceScrollLock(false);
      scrollUnlockTimerRef.current = null;
    }, 1200);
  };

  const unlockWorkspaceScroll = () => {
    clearScrollUnlockTimer();
    updateWorkspaceScrollLock(false);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const requestApiWithTimeoutRetry = async (path, options = {}, retryDelayMs = 1200) => {
    try {
      return await requestApi(path, options);
    } catch (e) {
      if (!isTimeoutErrorMessage(e?.message || "")) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return requestApi(path, options);
    }
  };

  const clearAuthState = async (message = "") => {
    stopPolling();
    setAuthToken("");
    setAuthUser(null);
    setUsage(null);
    setBillingStatus(null);
    setBillingActionLoading("");
    setHistory([]);
    setHistoryLoaded(false);
    setRecords([]);
    setRecordsLoaded(false);
    setResult(null);
    setPickedFile(null);
    setRecordDrafts({});
    setTaskStateText("");
    if (message) setNotice(message);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const fetchUsage = async (token = authToken, { quiet = false } = {}) => {
    if (!token) {
      setUsage(null);
      return null;
    }
    setUsageLoading(true);
    try {
      const data = await requestApi("/api/usage", { token });
      const normalized = {
        plan_tier: String(data?.plan_tier || "free"),
        used_audio_seconds: Math.max(0, Number(data?.used_audio_seconds) || 0),
        monthly_limit_seconds: Number(data?.monthly_limit_seconds) || FREE_MONTHLY_LIMIT_SECONDS,
        remaining_seconds:
          data?.remaining_seconds === null || data?.remaining_seconds === undefined
            ? null
            : Math.max(0, Number(data?.remaining_seconds) || 0),
        usage_percent: Math.max(0, Math.min(100, Number(data?.usage_percent) || 0)),
      };
      setUsage(normalized);
      return normalized;
    } catch (e) {
      if (!quiet) {
        setError(e.message || copy.errors.usageReadFailed);
      }
      return null;
    } finally {
      setUsageLoading(false);
    }
  };

  const fetchBillingStatus = async (token = authToken, { quiet = false } = {}) => {
    if (!token) {
      setBillingStatus(null);
      return null;
    }
    setBillingLoading(true);
    try {
      const data = await requestApi("/api/billing/status", { token });
      if (data?.usage) {
        setUsage({
          plan_tier: String(data.usage.plan_tier || "free"),
          used_audio_seconds: Math.max(0, Number(data.usage.used_audio_seconds) || 0),
          monthly_limit_seconds: Number(data.usage.monthly_limit_seconds) || FREE_MONTHLY_LIMIT_SECONDS,
          remaining_seconds:
            data.usage.remaining_seconds === null || data.usage.remaining_seconds === undefined
              ? null
              : Math.max(0, Number(data.usage.remaining_seconds) || 0),
          usage_percent: Math.max(0, Math.min(100, Number(data.usage.usage_percent) || 0)),
        });
      }
      setBillingStatus(data || null);
      return data || null;
    } catch (e) {
      if (!quiet) {
        setError(e.message || copy.errors.billingStatusReadFailed);
      }
      return null;
    } finally {
      setBillingLoading(false);
    }
  };

  const refreshUsageAndBilling = async (token = authToken, { showNotice = false } = {}) => {
    if (!token) return;
    const [usageData, billingData] = await Promise.all([
      fetchUsage(token, { quiet: true }),
      fetchBillingStatus(token, { quiet: true }),
    ]);

    if (!usageData) {
      setError(copy.errors.usageReadFailed);
      return;
    }
    if (!billingData) {
      setError(copy.errors.billingStatusReadFailed);
      return;
    }
    if (showNotice) {
      setNotice(copy.notices.usageLoaded);
    }
  };

  const fetchHistory = async (token = authToken) => {
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
  };

  const fetchRecords = async (token = authToken) => {
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
  };

  const loadWorkspaceInBackground = (token) => {
    fetchHistory(token);
    fetchRecords(token);
    refreshUsageAndBilling(token).catch(() => {});
  };

  const hydrateWithToken = async (
    token,
    { successMessage = "", userHint = null, verifyUser = true, loadWorkspace = false } = {}
  ) => {
    try {
      const shouldVerifyUser = verifyUser || !userHint;
      const userData = shouldVerifyUser
        ? (await requestApiWithTimeoutRetry("/api/auth/me", { token, timeoutMs: AUTH_REQUEST_TIMEOUT_MS }))?.user || null
        : (userHint || null);

      setAuthToken(token);
      setAuthUser(userData);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);

      if (loadWorkspace) {
        loadWorkspaceInBackground(token);
      }

      if (successMessage) setNotice(successMessage);
      setError("");
    } catch (e) {
      await clearAuthState("");
      throw e;
    }
  };

  const handleDeepLink = async (url) => {
    const { accessToken, oauthError } = parseAuthParamsFromUrl(url);

    if (oauthError) {
      setError(`${copy.errors.socialFailedPrefix}: ${oauthError}`);
      setSocialLoading("");
      return;
    }

    if (!accessToken) return;

    try {
      await hydrateWithToken(accessToken, {
        successMessage: copy.notices.socialLoginDone,
        verifyUser: true,
        loadWorkspace: true,
      });
    } catch (e) {
      setError(e.message || copy.errors.socialSessionFailed);
    } finally {
      setSocialLoading("");
    }
  };

  useEffect(() => {
    let active = true;

    warmUpBackend();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

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

        const initialUrl = await Linking.getInitialURL();
        const initialAuth = parseAuthParamsFromUrl(initialUrl || "");
        let consumedOauthToken = false;

        if (initialUrl) {
          await handleDeepLink(initialUrl);
          consumedOauthToken = !!initialAuth.accessToken;
        }

        if (!consumedOauthToken) {
          const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
          if (savedToken) {
            await hydrateWithToken(savedToken, { verifyUser: true, loadWorkspace: true });
          }
        }
      } catch {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      } finally {
        if (active) setBootLoading(false);
      }
    })();

    return () => {
      active = false;
      subscription?.remove?.();
      clearScrollUnlockTimer();
      stopPolling();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(UI_THEME_KEY, themeKey).catch(() => { });
    AsyncStorage.setItem(UI_THEME_MODE_KEY, themeMode).catch(() => { });
  }, [themeKey, themeMode]);

  const handleAuthSubmit = async () => {
    clearMessages();

    if (!authEmail.trim() || !authPassword) {
      setError(copy.errors.authInputRequired);
      return;
    }

    if (authMode === "signup" && authPassword.length < 8) {
      setError(copy.errors.passwordMin);
      return;
    }

    setAuthLoading(true);

    try {
      const body = new FormData();
      body.append("email", authEmail.trim());
      body.append("password", authPassword);
      if (authMode === "signup" && authName.trim()) {
        body.append("full_name", authName.trim());
      }

      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const data = await requestApiWithTimeoutRetry(endpoint, {
        method: "POST",
        body,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      });

      if (data?.access_token) {
        setHistory([]);
        setRecords([]);
        setHistoryLoaded(false);
        setRecordsLoaded(false);
        await hydrateWithToken(data.access_token, {
          successMessage: authMode === "signup" ? copy.notices.authDoneSignup : copy.notices.authDoneLogin,
          userHint: data?.user || null,
          verifyUser: false,
          loadWorkspace: true,
        });
      } else {
        setNotice(data?.message || copy.notices.signupDone);
      }

      setAuthPassword("");
      if (authMode === "signup") setAuthMode("login");
    } catch (e) {
      setError(getFriendlyAuthError(e.message, copy));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    if (socialLoading) return;

    clearMessages();
    setSocialLoading(provider);

    try {
      const redirectTo = ExpoLinking.createURL("auth-callback");
      const path = `/api/auth/oauth-url?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
      const data = await requestApiWithTimeoutRetry(path, { timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
      if (!data?.auth_url) throw new Error(copy.errors.oauthUrlCreate);

      const supported = await Linking.canOpenURL(data.auth_url);
      if (!supported) throw new Error(copy.errors.openLoginUrl);

      await Linking.openURL(data.auth_url);
      setSocialLoading("");
    } catch (e) {
      setError(
        `${e.message || copy.errors.socialStartFailed}\n(backend OAUTH_REDIRECT_ALLOW_SCHEMES / Supabase Redirect URL check required)`
      );
      setSocialLoading("");
    }
  };

  const handleLogout = async () => {
    clearMessages();
    await clearAuthState(copy.notices.loggedOut);
  };

  const openExternalUrl = async (url) => {
    if (!url) throw new Error(copy.errors.openExternalFailed);
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error(copy.errors.openExternalFailed);
    await Linking.openURL(url);
  };

  const handleOpenPricing = async () => {
    try {
      await openExternalUrl(PRICING_URL);
    } catch (e) {
      setError(e.message || copy.errors.openExternalFailed);
    }
  };

  const handleBillingCheckout = async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    if (!billingCheckoutSupported) {
      setNotice(copy.billingUnsupported);
      await handleOpenPricing();
      return;
    }

    setBillingActionLoading("checkout");
    try {
      const data = await requestApi("/api/billing/checkout", {
        method: "POST",
        token: authToken,
      });
      if (!data?.checkout_url) {
        throw new Error(copy.errors.billingCheckoutFailed);
      }
      await openExternalUrl(data.checkout_url);
      setNotice(copy.notices.checkoutOpened);
      fetchBillingStatus(authToken, { quiet: true }).catch(() => {});
    } catch (e) {
      setError(e.message || copy.errors.billingCheckoutFailed);
    } finally {
      setBillingActionLoading("");
    }
  };

  const handleBillingPortal = async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    if (!billingPortalSupported || !billingManageSupported) {
      setError(copy.errors.billingPortalFailed);
      return;
    }

    setBillingActionLoading("portal");
    try {
      const data = await requestApi("/api/billing/portal", {
        method: "POST",
        token: authToken,
      });
      if (!data?.portal_url) {
        throw new Error(copy.errors.billingPortalFailed);
      }
      await openExternalUrl(data.portal_url);
      setNotice(copy.notices.portalOpened);
    } catch (e) {
      setError(e.message || copy.errors.billingPortalFailed);
    } finally {
      setBillingActionLoading("");
    }
  };

  const pickAudioFile = async () => {
    clearMessages();
    setResult(null);
    setRecordDrafts({});

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

  const startPollingTask = (taskId) => {
    stopPolling();
    setTaskStateText(copy.taskState.waiting);

    pollRef.current = setInterval(async () => {
      try {
        const data = await requestApi(`/api/status/${taskId}`, { token: authToken });

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
          setSubmitting(false);
          setTaskStateText(copy.taskState.done);
          setResult(data);
          setNotice(copy.notices.transcribeDone);
          fetchHistory(authToken);
          refreshUsageAndBilling(authToken).catch(() => {});
          return;
        }

        if (data.status === "error") {
          stopPolling();
          setSubmitting(false);
          setTaskStateText("");
          setError(data.error || copy.errors.transcribeError);
          return;
        }

        if (data.status === "not_found") {
          stopPolling();
          setSubmitting(false);
          setTaskStateText("");
          setError(copy.errors.taskNotFound);
        }
      } catch (e) {
        stopPolling();
        setSubmitting(false);
        setTaskStateText("");
        setError(e.message || copy.errors.statusFailed);
      }
    }, 2000);
  };

  const handleTranscribe = async () => {
    clearMessages();

    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    if (!pickedFile) {
      setError(copy.errors.fileNotSelected);
      return;
    }

    setSubmitting(true);
    setTaskStateText(copy.taskState.uploading);
    setResult(null);
    setRecordDrafts({});

    try {
      const body = new FormData();
      body.append("file", {
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.mimeType,
      });
      body.append("language", language);
      body.append("correct", "true");
      body.append("transcription_type", transcriptionType);

      const data = await requestApi("/api/transcribe", {
        method: "POST",
        token: authToken,
        body,
      });

      if (data.status === "queued" && data.task_id) {
        startPollingTask(data.task_id);
      } else if (data.status === "completed") {
        setSubmitting(false);
        setTaskStateText(copy.taskState.done);
        setResult(data);
        fetchHistory(authToken);
        refreshUsageAndBilling(authToken).catch(() => {});
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
    setSubmitting(true);
    setTaskStateText(copy.taskState.historyLoading);

    try {
      const data = await requestApi(`/api/status/${taskId}`, { token: authToken });
      if (data.status !== "completed") {
        throw new Error(copy.errors.historyLoadOnlyCompleted);
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

    setSummaryLoading(true);

    try {
      const normalizedType = result?.transcription_type || transcriptionType || "sermon";
      const body = new FormData();
      body.append("text", sourceText);
      body.append("summary_type", "short");
      body.append("transcription_type", normalizedType);
      body.append("language", language || "ko");

      const data = await requestApi("/api/summarize", {
        method: "POST",
        token: authToken,
        body,
      });

      setResult((prev) => ({ ...prev, summary: data.summary || "" }));
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

    setDraftLoadingCategory(category);

    try {
      const body = new FormData();
      body.append("text", sourceText);
      body.append("category", category);
      body.append("language", language);

      const data = await requestApi("/api/records/draft", {
        method: "POST",
        token: authToken,
        body,
      });

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
    const key = result?.transcription_type || transcriptionType;
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
            style={[styles.quickMenuItem, language === "ko" ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              setLanguage("ko");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: language === "ko" ? activeTheme.accent : activeTheme.textPrimary }]}>
              {copy.languageOptionKo}
            </Text>
          </NmPressable>
          <NmPressable
            style={[styles.quickMenuItem, language === "en" ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              setLanguage("en");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: language === "en" ? activeTheme.accent : activeTheme.textPrimary }]}>
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
      ) : !isLoggedIn ? (
        <ScrollView
          contentContainerStyle={[styles.authScrollContent, compactLayout ? styles.authScrollContentCompact : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView duration={420}>
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

              <Text style={[styles.orText, { color: activeTheme.textSecondary }]}>{copy.orSocial}</Text>

              <View style={styles.socialRow}>
                <NmPressable
                  style={[
                    styles.socialButton,
                    { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                    socialLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => handleSocialLogin("google")}
                  disabled={!!socialLoading}
                >
                  <View style={styles.socialButtonInner}>
                    <View style={styles.googleIconBubble}>
                      <Text style={styles.socialIconText}>G</Text>
                    </View>
                    <Text style={[styles.socialButtonText, { color: activeTheme.textPrimary }]}>
                      {socialLoading === "google" ? copy.connecting : copy.continueGoogle}
                    </Text>
                  </View>
                </NmPressable>

                <NmPressable
                  style={[
                    styles.socialButton,
                    { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
                    socialLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => handleSocialLogin("kakao")}
                  disabled={!!socialLoading}
                >
                  <View style={styles.socialButtonInner}>
                    <View style={styles.kakaoIconBubble}>
                      <Text style={styles.socialIconText}>K</Text>
                    </View>
                    <Text style={[styles.socialButtonText, { color: activeTheme.textPrimary }]}>
                      {socialLoading === "kakao" ? copy.connecting : copy.continueKakao}
                    </Text>
                  </View>
                </NmPressable>
              </View>
            </View>
          </FadeInView>
        </ScrollView>
      ) : (
        <View style={styles.workspaceContainer}>
          <FadeInView>
            <View style={[styles.userBar, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <View style={styles.userInfo}>
                <Text style={[styles.userEmail, { color: activeTheme.textPrimary }]}>{authUser?.email || copy.defaultUser}</Text>
                <Text style={[styles.userName, { color: activeTheme.textSecondary }]}>{authUser?.user_metadata?.full_name || authUser?.id || ""}</Text>
              </View>
              <NmPressable style={[styles.logoutButton, { borderColor: activeTheme.inputBorder }]} onPress={handleLogout}>
                <Text style={[styles.logoutButtonText, { color: activeTheme.errorText }]}>{copy.logout}</Text>
              </NmPressable>
            </View>
          </FadeInView>

          <FadeInView delay={70} duration={360}>
            <View style={[styles.tabsWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <View style={styles.segmentRow}>
                {tabOptions.map((tab) => (
                  <SegmentButton
                    key={tab.key}
                    label={tab.label}
                    active={activeTab === tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    theme={activeTheme}
                  />
                ))}
              </View>
            </View>
          </FadeInView>

          {activeTab === "transcribe" ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled={workspaceScrollEnabled}
            >
              <FadeInView key="transcribe-settings">
                <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcribeSettings}</Text>

                  <View style={styles.segmentRow}>
                    {transcriptionTypeOptions.map((item) => (
                      <SegmentButton
                        key={item.key}
                        label={item.label}
                        active={transcriptionType === item.key}
                        onPress={() => setTranscriptionType(item.key)}
                        theme={activeTheme}
                      />
                    ))}
                  </View>

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
                  {taskStateText ? <Text style={[styles.taskStateText, { color: activeTheme.accent }]}>{taskStateText}</Text> : null}
                </View>
              </FadeInView>

              {result ? (
                <FadeInView key="transcribe-result" delay={100}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.transcribeResult}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.taskId}: {result.task_id}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.itemType}: {result.transcription_type || transcriptionType}</Text>
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
                        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{copy.summary}</Text>
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
                  <View style={styles.inlineBetween}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.historyTitle}</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => fetchHistory(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{historyLoading ? copy.loading : copy.refresh}</Text>
                    </NmPressable>
                  </View>

                  {history.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>{copy.noHistory}</Text>
                  ) : (
                    history.map((item) => (
                      <View key={item.task_id} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                        <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.transcription_type || "sermon"} · {item.status}</Text>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{formatDate(item.created_at)}</Text>
                        <Text numberOfLines={2} style={[styles.previewText, { color: activeTheme.textPrimary }]}>
                          {item.summary_preview || (language === "en" ? "Open the transcript to view details." : "완료된 전사 결과를 열어 확인하세요.")}
                        </Text>
                        <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => handleLoadHistoryItem(item.task_id)}>
                          <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{copy.load}</Text>
                        </NmPressable>
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
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>{copy.settingsUsageTitle}</Text>
                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.settingsUsageHint}</Text>

                  {usageLoading && !usage ? (
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{copy.usageLoading}</Text>
                  ) : usage ? (
                    <>
                      <View style={styles.usageMetaGrid}>
                        <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usagePlanLabel}</Text>
                          <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{planLabel}</Text>
                        </View>
                        <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageStatusLabel}</Text>
                          <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingStateLabel}</Text>
                        </View>
                        <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageBillingProvider}</Text>
                          <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingProvider}</Text>
                        </View>
                        <View style={[styles.usageMetaItem, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                          <Text style={[styles.usageMetaLabel, { color: activeTheme.textSecondary }]}>{copy.usageCheckoutMode}</Text>
                          <Text style={[styles.usageMetaValue, { color: activeTheme.textPrimary }]}>{billingCheckoutMode}</Text>
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

                  {!billingCheckoutSupported ? (
                    <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{copy.billingUnsupported}</Text>
                  ) : null}

                  <View style={styles.billingActionRow}>
                    <NmPressable
                      style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                      onPress={() => {
                        clearMessages();
                        refreshUsageAndBilling(authToken, { showNotice: true }).catch(() => {});
                      }}
                      disabled={usageLoading || billingLoading}
                    >
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                        {usageLoading || billingLoading ? copy.loading : copy.usageRefresh}
                      </Text>
                    </NmPressable>
                    <NmPressable
                      style={[styles.tinyButton, styles.billingActionButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }, billingActionLoading ? styles.buttonDisabled : null]}
                      onPress={handleBillingCheckout}
                      disabled={!!billingActionLoading}
                    >
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                        {billingActionLoading === "checkout" ? copy.processing : copy.usageUpgrade}
                      </Text>
                    </NmPressable>
                  </View>

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
                </View>
              </FadeInView>

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
                  <View style={styles.segmentRow}>
                    <SegmentButton label={copy.languageOptionKo} active={language === "ko"} onPress={() => setLanguage("ko")} theme={activeTheme} />
                    <SegmentButton label={copy.languageOptionEn} active={language === "en"} onPress={() => setLanguage("en")} theme={activeTheme} />
                  </View>

                  <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{copy.settingsThemeLabel}</Text>
                  <View style={styles.segmentRow}>
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
                  </View>
                </View>
              </FadeInView>
            </ScrollView>
          ) : null}
        </View>
      )}

      {!privacyAccepted && !activeLegalDoc ? (
        <View
          style={[
            styles.privacyOverlay,
            {
              backgroundColor: "rgba(5, 12, 24, 0.58)",
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
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: NM.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
  },
  bannerError: {
    backgroundColor: NM.errorBg,
    borderLeftColor: NM.errorText,
  },
  bannerNotice: {
    backgroundColor: NM.noticeBg,
    borderLeftColor: NM.noticeText,
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  bannerTextError: {
    color: NM.errorText,
  },
  bannerTextNotice: {
    color: NM.noticeText,
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
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  segmentButtonActive: {
    backgroundColor: NM.surface,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 3,
  },
  segmentButtonText: {
    fontSize: 12,
    color: NM.textSecondary,
    fontWeight: "700",
  },
  segmentButtonTextActive: {
    color: NM.accent,
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
  socialButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: NM.surface,
    borderWidth: 1,
    borderColor: NM.inputBorder,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  socialButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleIconBubble: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  kakaoIconBubble: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#FEE500",
    alignItems: "center",
    justifyContent: "center",
  },
  socialIconText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
  },
  socialButtonText: {
    color: NM.textPrimary,
    fontSize: 12,
    fontWeight: "800",
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
  billingActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
