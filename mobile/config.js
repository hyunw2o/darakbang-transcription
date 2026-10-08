const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.mallog24.com";
const API_FALLBACK_URLS = String(
  process.env.EXPO_PUBLIC_API_FALLBACK_URLS || "https://darakbang-transcription-backend.onrender.com"
)
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const SUPABASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const AUTH_TOKEN_KEY = "mallog24_access_token";
const AUTH_SESSION_EXPIRES_AT_KEY = "mallog24_session_expires_at_ms";
const UI_THEME_KEY = "mallog24_mobile_ui_theme";
const UI_THEME_MODE_KEY = "mallog24_mobile_ui_theme_mode";
const PRIVACY_CONSENT_KEY = "mallog24_privacy_policy_consent_version";
const PRIVACY_POLICY_VERSION = "2026-09-11";
const LEGAL_DOC_VERSION = process.env.EXPO_PUBLIC_LEGAL_DOC_VERSION || "v2026.09.11";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://mallog24.com";
const OURS_URL = process.env.EXPO_PUBLIC_OURS_URL || "https://ours.mallog24.com";
const BUSINESS_NAME = process.env.EXPO_PUBLIC_BUSINESS_NAME || "OURS";
const BUSINESS_REG_NUMBER = process.env.EXPO_PUBLIC_BUSINESS_REG_NUMBER || "696-08-03518";
const LANDLINE_PHONE = process.env.EXPO_PUBLIC_LANDLINE_PHONE || "준비중";
const REPRESENTATIVE_NAME =
  process.env.EXPO_PUBLIC_REPRESENTATIVE_NAME || "김현우";
const REPRESENTATIVE_NAME_EN =
  process.env.EXPO_PUBLIC_REPRESENTATIVE_NAME_EN
  || process.env.EXPO_PUBLIC_REPRESENTATIVE_NAME
  || "Kim Hyunwoo";
const BUSINESS_ADDRESS = process.env.EXPO_PUBLIC_BUSINESS_ADDRESS || "12735, 경기도 광주시 초월읍 무들로 28";
const BUSINESS_ADDRESS_EN =
  process.env.EXPO_PUBLIC_BUSINESS_ADDRESS_EN
  || process.env.EXPO_PUBLIC_BUSINESS_ADDRESS
  || "28 Mudeul-ro, Chowol-eup, Gwangju-si, Gyeonggi-do, 12735, Republic of Korea";
const ECOMMERCE_REG_NUMBER = process.env.EXPO_PUBLIC_ECOMMERCE_REG_NUMBER || "통신판매업 신고 면제 대상";
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "ours113814@gmail.com";
const AUTH_REQUEST_TIMEOUT_MS = Math.max(
  10000,
  Math.min(30000, Number(process.env.EXPO_PUBLIC_AUTH_REQUEST_TIMEOUT_MS) || 20000)
);
const TRANSCRIBE_POLL_TIMEOUT_MS = Math.max(
  120000,
  Number(process.env.EXPO_PUBLIC_TRANSCRIBE_POLL_TIMEOUT_MS) || 2 * 60 * 60 * 1000
);
const STATUS_POLL_INTERVAL_MS = Math.max(
  2000,
  Number(process.env.EXPO_PUBLIC_STATUS_POLL_INTERVAL_MS) || 3000
);
const ADMOB_ANDROID_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-8592086805043488~9419599131";
const ADMOB_IOS_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-8592086805043488~8107056464";
const ADMOB_ANDROID_BANNER_HOME_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_HOME_UNIT_ID || "ca-app-pub-8592086805043488/7142630018";
const ADMOB_IOS_BANNER_HOME_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_HOME_UNIT_ID || "ca-app-pub-8592086805043488/7110840427";

const MOBILE_THEME_OPTIONS = [
  { key: "auto", label: "System", targetTheme: "" },
  { key: "light", label: "Light", targetTheme: "aurora" },
  { key: "dark", label: "Dark", targetTheme: "noir" },
];

const MOBILE_THEMES = {
  aurora: {
    bg: "#F5F6F5",
    surface: "#FFFFFF",
    surfaceSoft: "#F1F3F2",
    light: "#FFFFFF",
    dark: "#D3D9D5",
    shadowTint: "#202823",
    accent: "#21744F",
    accentSoft: "#398361",
    textPrimary: "#202622",
    textSecondary: "#626C65",
    inputBg: "#F5F7F5",
    inputBorder: "#DCE2DD",
    errorBg: "#FCEDEC",
    errorText: "#B33936",
    noticeBg: "#EAF4EE",
    noticeText: "#236346",
    radius: 8,
    radiusSm: 6,
  },
  noir: {
    bg: "#141715",
    surface: "#1C211E",
    surfaceSoft: "#252C27",
    light: "#333C35",
    dark: "#0C0F0D",
    shadowTint: "#000000",
    accent: "#70BE94",
    accentSoft: "#8AC9A7",
    textPrimary: "#F1F4F2",
    textSecondary: "#B2BDB5",
    inputBg: "#242B26",
    inputBorder: "#3A453E",
    errorBg: "#392522",
    errorText: "#F09B95",
    noticeBg: "#243A2C",
    noticeText: "#9ACBAE",
    radius: 8,
    radiusSm: 6,
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

const TRANSCRIPTION_TYPES = ["sermon", "prayer", "phonecall", "conversation"];
const RECORD_CATEGORIES = ["meeting_keywords", "clinical_notes", "sermon_core_summary"];
const APP_TABS = ["transcribe", "history", "records", "settings"];

export {
  API_URL,
  API_FALLBACK_URLS,
  SUPABASE_URL,
  AUTH_TOKEN_KEY,
  AUTH_SESSION_EXPIRES_AT_KEY,
  UI_THEME_KEY,
  UI_THEME_MODE_KEY,
  PRIVACY_CONSENT_KEY,
  PRIVACY_POLICY_VERSION,
  LEGAL_DOC_VERSION,
  MAX_UPLOAD_BYTES,
  SITE_URL,
  OURS_URL,
  BUSINESS_NAME,
  BUSINESS_REG_NUMBER,
  LANDLINE_PHONE,
  REPRESENTATIVE_NAME,
  REPRESENTATIVE_NAME_EN,
  BUSINESS_ADDRESS,
  BUSINESS_ADDRESS_EN,
  ECOMMERCE_REG_NUMBER,
  SUPPORT_EMAIL,
  AUTH_REQUEST_TIMEOUT_MS,
  TRANSCRIBE_POLL_TIMEOUT_MS,
  STATUS_POLL_INTERVAL_MS,
  ADMOB_ANDROID_APP_ID,
  ADMOB_IOS_APP_ID,
  ADMOB_ANDROID_BANNER_HOME_UNIT_ID,
  ADMOB_IOS_BANNER_HOME_UNIT_ID,
  MOBILE_THEME_OPTIONS,
  MOBILE_THEMES,
  NM,
  MIME_BY_EXT,
  TRANSCRIPTION_TYPES,
  RECORD_CATEGORIES,
  APP_TABS,
};
