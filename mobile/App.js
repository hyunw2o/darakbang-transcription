import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
const AUTH_TOKEN_KEY = "mallog24_access_token";
const UI_THEME_KEY = "mallog24_mobile_ui_theme";
const UI_THEME_MODE_KEY = "mallog24_mobile_ui_theme_mode";
const PRIVACY_CONSENT_KEY = "mallog24_privacy_policy_consent_version";
const PRIVACY_POLICY_VERSION = "2026-02-19";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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
const APP_TABS = ["transcribe", "history", "records"];

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
    },
    legal: {
      openPrivacy: "개인정보처리방침",
      openTerms: "이용약관",
      openCompanyPolicy: "회사 정책",
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
    privacy: {
      title: "개인정보처리방침 동의",
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
      openPrivacyFailed: "개인정보처리방침 페이지를 열 수 없습니다.",
      openPrivacyLinkFailed: "개인정보처리방침 링크를 열 수 없습니다.",
      openTermsFailed: "이용약관 페이지를 열 수 없습니다.",
      openTermsLinkFailed: "이용약관 링크를 열 수 없습니다.",
      openCompanyPolicyFailed: "회사 정책 페이지를 열 수 없습니다.",
      openCompanyPolicyLinkFailed: "회사 정책 링크를 열 수 없습니다.",
      privacySaveFailed: "동의 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
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
    },
    legal: {
      openPrivacy: "Privacy Policy",
      openTerms: "Terms of Service",
      openCompanyPolicy: "Company Policy",
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
    privacy: {
      title: "Privacy Policy Consent",
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
      openPrivacyFailed: "Unable to open the privacy policy page.",
      openPrivacyLinkFailed: "Unable to open privacy policy link.",
      openTermsFailed: "Unable to open terms of service page.",
      openTermsLinkFailed: "Unable to open terms of service link.",
      openCompanyPolicyFailed: "Unable to open company policy page.",
      openCompanyPolicyLinkFailed: "Unable to open company policy link.",
      privacySaveFailed: "Failed to save consent state. Please try again.",
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
      updatedAt: "최종 업데이트: 2026년 2월 20일",
      sections: [
        {
          title: "1. 수집 및 처리 항목",
          body: [
            "회원 인증(이메일/소셜 로그인), 업로드 음성 파일, 변환 텍스트, 저장 기록본, 접속 로그를 처리할 수 있습니다.",
          ],
        },
        {
          title: "2. 처리 목적",
          body: [
            "로그인/회원관리, 음성 전사 및 교정, 요약, 기록본 저장, 고객지원 및 보안 대응을 위해 처리합니다.",
          ],
        },
        {
          title: "3. 보관 및 파기",
          body: [
            "원본 음성 파일은 처리 목적의 임시 저장 후 지체 없이 삭제합니다.",
            "변환 결과와 기록본은 서비스 제공 범위 내 보관되며, 삭제 요청 또는 계정 정리 시 파기됩니다.",
          ],
        },
        {
          title: "4. 처리 위탁",
          body: [
            "Supabase(인증/DB), OpenAI(Whisper), Google(Gemini) 등 외부 처리사를 사용합니다.",
          ],
        },
        {
          title: "5. 문의",
          body: ["문의: ours113814@gmail.com"],
        },
      ],
    },
    terms: {
      title: "이용약관",
      updatedAt: "시행일: 2026년 2월 20일",
      sections: [
        {
          title: "1. 서비스 이용",
          body: [
            "mallog24는 음성 파일 전사/교정/요약/기록본 저장 기능을 제공합니다.",
            "서비스 품질 향상을 위해 기능이 변경될 수 있습니다.",
          ],
        },
        {
          title: "2. 계정 관리",
          body: [
            "계정 및 인증정보 관리 책임은 이용자에게 있습니다.",
            "보안 위험 또는 약관 위반 시 이용 제한이 적용될 수 있습니다.",
          ],
        },
        {
          title: "3. 금지 행위",
          body: [
            "권리침해/불법 콘텐츠 업로드, 서비스 우회/공격/악용, 무단 재판매를 금지합니다.",
          ],
        },
        {
          title: "4. 면책 및 책임",
          body: [
            "외부 API 장애, 통신 장애, 불가항력 상황에서 서비스 지연이 발생할 수 있습니다.",
            "전사 결과의 최종 검토와 활용 책임은 이용자에게 있습니다.",
          ],
        },
        {
          title: "5. 문의",
          body: ["문의: ours113814@gmail.com"],
        },
      ],
    },
    companyPolicy: {
      title: "회사 정책",
      updatedAt: "최종 업데이트: 2026년 2월 20일",
      sections: [
        {
          title: "1. 운영 원칙",
          body: [
            "정확도, 보안, 안정성을 우선순위로 서비스 운영 및 개선을 진행합니다.",
          ],
        },
        {
          title: "2. 데이터 최소 처리",
          body: [
            "서비스 제공에 필요한 최소 데이터만 처리하며, 불필요한 보관을 지양합니다.",
          ],
        },
        {
          title: "3. 보안 정책",
          body: [
            "HTTPS, 토큰 인증, 권한 분리, 요청 제한 등 기본 보안조치를 적용합니다.",
          ],
        },
        {
          title: "4. AI 윤리",
          body: [
            "업로드 데이터는 서비스 처리 목적에 한정해 사용합니다.",
            "불법/권리침해 이용 신고 시 내부 기준에 따라 검토 및 제한 조치합니다.",
          ],
        },
        {
          title: "5. 문의",
          body: ["문의: ours113814@gmail.com"],
        },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy Policy",
      updatedAt: "Last updated: February 20, 2026",
      sections: [
        {
          title: "1. Data We Process",
          body: [
            "We may process account credentials, uploaded audio, transcript text, saved records, and access logs.",
          ],
        },
        {
          title: "2. Purpose",
          body: [
            "Data is used for authentication, transcription, correction, summarization, saved records, support, and security operations.",
          ],
        },
        {
          title: "3. Retention and Deletion",
          body: [
            "Source audio is handled in temporary storage and removed promptly after processing.",
            "Transcript text and records are retained for service features and deleted upon request/account closure.",
          ],
        },
        {
          title: "4. Processors",
          body: [
            "We use Supabase (auth/database), OpenAI (Whisper), and Google (Gemini) for required processing.",
          ],
        },
        {
          title: "5. Contact",
          body: ["Contact: ours113814@gmail.com"],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      updatedAt: "Effective date: February 20, 2026",
      sections: [
        {
          title: "1. Service Use",
          body: [
            "mallog24 provides speech transcription, correction, summarization, and structured record features.",
            "Features may change for quality and security improvements.",
          ],
        },
        {
          title: "2. Account Responsibility",
          body: [
            "Users are responsible for account security and credential management.",
            "Access may be limited for security risks or policy violations.",
          ],
        },
        {
          title: "3. Prohibited Conduct",
          body: [
            "Uploading unlawful content, abuse/attacks, bypass attempts, and unauthorized resale are prohibited.",
          ],
        },
        {
          title: "4. Disclaimer",
          body: [
            "Service delays may occur due to external API outages, network failures, or force majeure events.",
            "Users are responsible for final review and business use of generated transcripts.",
          ],
        },
        {
          title: "5. Contact",
          body: ["Contact: ours113814@gmail.com"],
        },
      ],
    },
    companyPolicy: {
      title: "Company Policy",
      updatedAt: "Last updated: February 20, 2026",
      sections: [
        {
          title: "1. Operating Principles",
          body: [
            "We prioritize transcript quality, security, and service stability in product operations.",
          ],
        },
        {
          title: "2. Data Minimization",
          body: [
            "Only the minimum data required for service delivery is processed and retained.",
          ],
        },
        {
          title: "3. Security",
          body: [
            "HTTPS, token-based auth, access control, and request throttling are applied as baseline controls.",
          ],
        },
        {
          title: "4. Responsible AI Use",
          body: [
            "Uploaded data is processed for service functionality only.",
            "Reported abuse or rights-infringing usage is reviewed under internal policy.",
          ],
        },
        {
          title: "5. Contact",
          body: ["Contact: ours113814@gmail.com"],
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
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
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Please check server status.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const colorScheme = useColorScheme();
  const { height: screenHeight } = useWindowDimensions();

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

  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [recordDrafts, setRecordDrafts] = useState({});
  const [draftLoadingCategory, setDraftLoadingCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState("");

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
  const compactLayout = screenHeight < 760;
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

  useEffect(() => {
    setOpenSettingsMenu("");
  }, [isLoggedIn]);

  const warmUpBackend = () => {
    requestApi("/health", { timeoutMs: 4000 }).catch(() => { });
  };

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearAuthState = async (message = "") => {
    stopPolling();
    setAuthToken("");
    setAuthUser(null);
    setHistory([]);
    setRecords([]);
    setResult(null);
    setPickedFile(null);
    setRecordDrafts({});
    setTaskStateText("");
    if (message) setNotice(message);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const fetchHistory = async (token = authToken) => {
    if (!token) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const data = await requestApi("/api/history", { token });
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || copy.errors.historyReadFailed);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchRecords = async (token = authToken) => {
    if (!token) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    try {
      const data = await requestApi("/api/records", { token });
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || copy.errors.recordsReadFailed);
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadWorkspaceInBackground = (token) => {
    fetchHistory(token);
    fetchRecords(token);
  };

  const hydrateWithToken = async (
    token,
    { successMessage = "", userHint = null, verifyUser = true, loadWorkspace = true } = {}
  ) => {
    try {
      const shouldVerifyUser = verifyUser || !userHint;
      const userData = shouldVerifyUser
        ? (await requestApi("/api/auth/me", { token, timeoutMs: 12000 }))?.user || null
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
            await hydrateWithToken(savedToken, { verifyUser: true });
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
      const data = await requestApi(endpoint, { method: "POST", body });

      if (data?.access_token) {
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
      const data = await requestApi(path);
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
    }
  };

  const handleSummarize = async () => {
    clearMessages();

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
      const body = new FormData();
      body.append("text", sourceText);
      body.append("summary_type", "short");

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

  const selectedTypeHint = useMemo(() => {
    return copy.selectedTypeHints[transcriptionType] || "";
  }, [copy, transcriptionType]);

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
        <NmPressable
          style={[styles.quickIconButton, { borderColor: activeTheme.inputBorder }]}
          onPress={() => setOpenSettingsMenu((prev) => (prev === "legal" ? "" : "legal"))}
          accessibilityLabel={copy.legalMenu}
        >
          <Text style={[styles.quickIconText, { color: activeTheme.textPrimary }]}>⚖︎</Text>
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

      {openSettingsMenu === "legal" ? (
        <View style={[styles.quickMenu, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
          <NmPressable
            style={[styles.quickMenuItem, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              openLegalDocument("privacy");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: activeTheme.textPrimary }]}>
              {copy.legal.openPrivacy}
            </Text>
          </NmPressable>
          <NmPressable
            style={[styles.quickMenuItem, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              openLegalDocument("terms");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: activeTheme.textPrimary }]}>
              {copy.legal.openTerms}
            </Text>
          </NmPressable>
          <NmPressable
            style={[styles.quickMenuItem, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              openLegalDocument("company-policy");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: activeTheme.textPrimary }]}>
              {copy.legal.openCompanyPolicy}
            </Text>
          </NmPressable>
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
      {renderQuickControls()}

      {!isLoggedIn ? (
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
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                    <View style={[styles.resultBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      <Text selectable style={[styles.resultText, { color: activeTheme.textPrimary }]}>
                        {result.corrected_text || result.raw_text || ""}
                      </Text>
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
                      <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{summaryLoading ? copy.generatingSummary : copy.generateSummary}</Text>
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
                          style={[styles.recordEditor, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                          multiline
                          value={recordDrafts[category.key] || ""}
                          onChangeText={(text) =>
                            setRecordDrafts((prev) => ({ ...prev, [category.key]: text }))
                          }
                          placeholder={copy.recordEditorPlaceholder.replace("{label}", category.label)}
                          placeholderTextColor={activeTheme.textSecondary}
                        />
                      </View>
                    ))}
                  </View>
                </FadeInView>
              ) : null}
            </ScrollView>
          ) : null}

          {activeTab === "history" ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        <Text numberOfLines={2} style={[styles.previewText, { color: activeTheme.textPrimary }]}>{item.summary_preview || ""}</Text>
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                      </View>
                    ))
                  )}
                </View>
              </FadeInView>
            </ScrollView>
          ) : null}
        </View>
      )}

      {activeLegalDoc ? (
        <View style={[styles.legalOverlay, { backgroundColor: "rgba(5, 12, 24, 0.64)" }]}>
          <FadeInView duration={220}>
            <View
              style={[
                styles.legalModal,
                compactLayout ? styles.legalModalCompact : null,
                { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder },
              ]}
            >
              <ScrollView
                style={styles.legalModalScroll}
                contentContainerStyle={styles.legalModalContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.privacyTitle, { color: activeTheme.textPrimary }]}>
                  {activeLegalDoc.title}
                </Text>
                <Text style={[styles.legalUpdatedText, { color: activeTheme.textSecondary }]}>
                  {activeLegalDoc.updatedAt}
                </Text>

                {activeLegalDoc.sections.map((section) => (
                  <View
                    key={`${activeLegalDoc.title}-${section.title}`}
                    style={[
                      styles.legalSectionBox,
                      { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                    ]}
                  >
                    <Text style={[styles.legalSectionTitle, { color: activeTheme.textPrimary }]}>
                      {section.title}
                    </Text>
                    {section.body.map((line, index) => (
                      <Text
                        key={`${section.title}-${index}`}
                        style={[styles.legalSectionBody, { color: activeTheme.textPrimary }]}
                      >
                        • {line}
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>

              <NmPressable
                style={[
                  styles.privacyAcceptButton,
                  { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                ]}
                onPress={closeLegalDocument}
              >
                <Text style={styles.privacyAcceptButtonText}>{copy.legal.close}</Text>
              </NmPressable>
            </View>
          </FadeInView>
        </View>
      ) : null}

      {!privacyAccepted ? (
        <View style={[styles.privacyOverlay, { backgroundColor: "rgba(5, 12, 24, 0.58)" }]}>
          <FadeInView duration={260}>
            <View style={[styles.privacyModal, compactLayout ? styles.privacyModalCompact : null, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <ScrollView style={styles.privacyModalScroll} contentContainerStyle={styles.privacyModalContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.privacyTitle, { color: activeTheme.textPrimary }]}>{copy.privacy.title}</Text>
                <Text style={[styles.privacyBody, { color: activeTheme.textSecondary }]}>
                  {copy.privacy.body}
                </Text>

                <View style={[styles.privacySummaryBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryFile}
                  </Text>
                  <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryText}
                  </Text>
                  <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summaryVendors}
                  </Text>
                  <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.summarySocial}
                  </Text>
                </View>

                <NmPressable
                  style={[styles.privacyLinkButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("privacy")}
                >
                  <Text style={[styles.privacyLinkText, { color: activeTheme.accent }]}>{copy.privacy.viewPolicy}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyLinkButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("terms")}
                >
                  <Text style={[styles.privacyLinkText, { color: activeTheme.accent }]}>{copy.privacy.viewTerms}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyLinkButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                  onPress={() => openLegalDocument("company-policy")}
                >
                  <Text style={[styles.privacyLinkText, { color: activeTheme.accent }]}>{copy.privacy.viewCompanyPolicy}</Text>
                </NmPressable>

                <NmPressable
                  style={[styles.privacyCheckRow, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}
                  onPress={() => setPrivacyConsentChecked((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.privacyCheckBox,
                      { borderColor: activeTheme.inputBorder, backgroundColor: privacyConsentChecked ? activeTheme.accent : "transparent" },
                    ]}
                  >
                    {privacyConsentChecked ? <Text style={styles.privacyCheckMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.privacyCheckText, { color: activeTheme.textPrimary }]}>
                    {copy.privacy.check}
                  </Text>
                </NmPressable>

                <NmPressable
                  style={[
                    styles.privacyAcceptButton,
                    { backgroundColor: activeTheme.accent, borderColor: activeTheme.accentSoft },
                    !privacyConsentChecked || privacyConsentSaving ? styles.buttonDisabled : null,
                  ]}
                  onPress={handleAcceptPrivacyPolicy}
                  disabled={!privacyConsentChecked || privacyConsentSaving}
                >
                  <Text style={styles.privacyAcceptButtonText}>
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
    padding: 12,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: NM.inputBorder,
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
    minHeight: 90,
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
  legalModalScroll: {
    flexGrow: 0,
  },
  legalModalContent: {
    gap: 10,
    paddingBottom: 2,
  },
  legalUpdatedText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  legalSectionBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  legalSectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  legalSectionBody: {
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
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
  privacyModalScroll: {
    flexGrow: 0,
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
  privacyBody: {
    fontSize: 12,
    lineHeight: 18,
    color: NM.textSecondary,
  },
  privacySummaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  privacySummaryItem: {
    fontSize: 11,
    lineHeight: 17,
    color: NM.textPrimary,
    fontWeight: "600",
  },
  privacyLinkButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  privacyLinkText: {
    fontSize: 12,
    fontWeight: "700",
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
  privacyCheckBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  privacyAcceptButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
