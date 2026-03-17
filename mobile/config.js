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
const PRIVACY_POLICY_VERSION = "2026-02-21";
const LEGAL_DOC_VERSION = process.env.EXPO_PUBLIC_LEGAL_DOC_VERSION || "v2026.02.23";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const FREE_MONTHLY_LIMIT_SECONDS = 10 * 60 * 60;
const PRICING_URL = process.env.EXPO_PUBLIC_PRICING_URL || "https://mallog24.com/pricing";
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
  Number(process.env.EXPO_PUBLIC_AUTH_REQUEST_TIMEOUT_MS) || 120000
);
const TRANSCRIBE_POLL_TIMEOUT_MS = Math.max(
  120000,
  Number(process.env.EXPO_PUBLIC_TRANSCRIBE_POLL_TIMEOUT_MS) || 45 * 60 * 1000
);
const STATUS_POLL_INTERVAL_MS = Math.max(
  2000,
  Number(process.env.EXPO_PUBLIC_STATUS_POLL_INTERVAL_MS) || 3000
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
  FREE_MONTHLY_LIMIT_SECONDS,
  PRICING_URL,
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
  MOBILE_THEME_OPTIONS,
  MOBILE_THEMES,
  NM,
  MIME_BY_EXT,
  TRANSCRIPTION_TYPES,
  RECORD_CATEGORIES,
  APP_TABS,
};
