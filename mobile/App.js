import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ExpoLinking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NmPressable from "./components/NmPressable";
import FadeInView from "./components/FadeInView";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://darakbang-transcription-backend.onrender.com";
const AUTH_TOKEN_KEY = "mallog24_access_token";
const UI_THEME_KEY = "mallog24_mobile_ui_theme";
const UI_THEME_MODE_KEY = "mallog24_mobile_ui_theme_mode";
const PRIVACY_CONSENT_KEY = "mallog24_privacy_policy_consent_version";
const PRIVACY_POLICY_VERSION = "2026-02-19";
const PRIVACY_POLICY_URL_KO = process.env.EXPO_PUBLIC_PRIVACY_URL_KO || "https://ours-homepage.vercel.app/privacy";
const PRIVACY_POLICY_URL_EN = process.env.EXPO_PUBLIC_PRIVACY_URL_EN || "https://ours-homepage.vercel.app/privacy-en";
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

const TRANSCRIPTION_TYPES = [
  { key: "sermon", label: "설교" },
  { key: "phonecall", label: "통화" },
  { key: "conversation", label: "회의" },
];

const RECORD_CATEGORIES = [
  { key: "meeting_keywords", label: "회의 중요 키워드" },
  { key: "clinical_notes", label: "진료 도움 기록" },
  { key: "sermon_core_summary", label: "설교 핵심 요약" },
];

const APP_TABS = [
  { key: "transcribe", label: "변환" },
  { key: "history", label: "히스토리" },
  { key: "records", label: "기록본" },
];

function parseResponseText(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

function getFriendlyAuthError(message) {
  const raw = (message || "").trim();
  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "이메일/비밀번호가 일치하지 않습니다. 기존 계정이 Google/Kakao로 가입된 계정이면 소셜 로그인 버튼을 사용하세요.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 인증 메일 확인 후 다시 로그인해주세요.";
  }
  if (normalized.includes("timeout")) {
    return "인증 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.";
  }
  return raw || "인증 처리 실패";
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
      throw new Error(data?.detail || data?.message || `요청 실패 (${response.status})`);
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 서버 상태를 확인해주세요.");
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

  const isLoggedIn = !!authToken && !!authUser;
  const resolvedThemeKey =
    themeMode === "auto" ? (colorScheme === "dark" ? "noir" : "aurora") : themeKey;
  const activeTheme = MOBILE_THEMES[resolvedThemeKey] || MOBILE_THEMES.aurora;

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
      setError(e.message || "히스토리 조회 실패");
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
      setError(e.message || "기록본 조회 실패");
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
      setError(`소셜 로그인 실패: ${oauthError}`);
      setSocialLoading("");
      return;
    }

    if (!accessToken) return;

    try {
      await hydrateWithToken(accessToken, {
        successMessage: "소셜 로그인이 완료되었습니다.",
        verifyUser: true,
      });
    } catch (e) {
      setError(e.message || "소셜 로그인 세션 처리 실패");
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
      setError("이메일/비밀번호를 입력해주세요.");
      return;
    }

    if (authMode === "signup" && authPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
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
          successMessage: authMode === "signup" ? "회원가입/로그인이 완료되었습니다." : "로그인되었습니다.",
          userHint: data?.user || null,
          verifyUser: false,
          loadWorkspace: true,
        });
      } else {
        setNotice(data?.message || "회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.");
      }

      setAuthPassword("");
      if (authMode === "signup") setAuthMode("login");
    } catch (e) {
      setError(getFriendlyAuthError(e.message));
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
      if (!data?.auth_url) throw new Error("OAuth URL 생성 실패");

      const supported = await Linking.canOpenURL(data.auth_url);
      if (!supported) throw new Error("로그인 URL을 열 수 없습니다.");

      await Linking.openURL(data.auth_url);
      setSocialLoading("");
    } catch (e) {
      setError(
        `${e.message || "소셜 로그인 시작 실패"}\n(백엔드 OAUTH_REDIRECT_ALLOW_SCHEMES / Supabase Redirect URL 설정 확인 필요)`
      );
      setSocialLoading("");
    }
  };

  const handleLogout = async () => {
    clearMessages();
    await clearAuthState("로그아웃되었습니다.");
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
        setError("파일 크기는 100MB 이하여야 합니다.");
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
      setNotice("파일이 선택되었습니다.");
    } catch (e) {
      setError(e.message || "파일 선택 실패");
    }
  };

  const startPollingTask = (taskId) => {
    stopPolling();
    setTaskStateText("변환 작업 대기 중...");

    pollRef.current = setInterval(async () => {
      try {
        const data = await requestApi(`/api/status/${taskId}`, { token: authToken });

        if (data.status === "queued") {
          setTaskStateText("변환 대기 중...");
          return;
        }

        if (data.status === "processing") {
          setTaskStateText("음성 인식/교정 처리 중...");
          return;
        }

        if (data.status === "completed") {
          stopPolling();
          setSubmitting(false);
          setTaskStateText("완료");
          setResult(data);
          setNotice("변환이 완료되었습니다.");
          fetchHistory(authToken);
          return;
        }

        if (data.status === "error") {
          stopPolling();
          setSubmitting(false);
          setTaskStateText("");
          setError(data.error || "변환 중 오류가 발생했습니다.");
          return;
        }

        if (data.status === "not_found") {
          stopPolling();
          setSubmitting(false);
          setTaskStateText("");
          setError("작업 상태를 찾을 수 없습니다.");
        }
      } catch (e) {
        stopPolling();
        setSubmitting(false);
        setTaskStateText("");
        setError(e.message || "상태 조회 실패");
      }
    }, 2000);
  };

  const handleTranscribe = async () => {
    clearMessages();

    if (!isLoggedIn) {
      setError("로그인 후 파일 변환을 사용할 수 있습니다.");
      return;
    }

    if (!pickedFile) {
      setError("먼저 파일을 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setTaskStateText("업로드 중...");
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
        setTaskStateText("완료");
        setResult(data);
        fetchHistory(authToken);
      } else {
        setSubmitting(false);
        setTaskStateText("");
        setNotice(data.message || "요청이 접수되었습니다.");
      }
    } catch (e) {
      setSubmitting(false);
      setTaskStateText("");
      setError(e.message || "변환 요청 실패");
    }
  };

  const handleLoadHistoryItem = async (taskId) => {
    clearMessages();
    setSubmitting(true);
    setTaskStateText("히스토리 불러오는 중...");

    try {
      const data = await requestApi(`/api/status/${taskId}`, { token: authToken });
      if (data.status !== "completed") {
        throw new Error("완료된 작업만 불러올 수 있습니다.");
      }
      setResult(data);
      setActiveTab("transcribe");
      setNotice("히스토리 결과를 불러왔습니다.");
    } catch (e) {
      setError(e.message || "히스토리 불러오기 실패");
    } finally {
      setSubmitting(false);
      setTaskStateText("");
    }
  };

  const handleSummarize = async () => {
    clearMessages();

    if (!isLoggedIn) {
      setError("로그인 후 요약을 사용할 수 있습니다.");
      return;
    }

    const sourceText = result?.corrected_text || result?.raw_text || "";
    if (!sourceText.trim()) {
      setError("요약할 텍스트가 없습니다.");
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
      setNotice("요약을 생성했습니다.");
    } catch (e) {
      setError(e.message || "요약 실패");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleGenerateRecordDraft = async (category) => {
    clearMessages();

    if (!isLoggedIn) {
      setError("로그인 후 기록본 초안을 생성할 수 있습니다.");
      return;
    }

    const sourceText = result?.corrected_text || result?.raw_text || "";
    if (!sourceText.trim()) {
      setError("기록본 초안 생성에 필요한 변환 결과가 없습니다.");
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
      setNotice(`${data?.category_label || "기록본"} 초안을 생성했습니다.`);
    } catch (e) {
      setError(e.message || "기록본 초안 생성 실패");
    } finally {
      setDraftLoadingCategory("");
    }
  };

  const handleSaveRecord = async (category) => {
    clearMessages();

    if (!isLoggedIn) {
      setError("로그인 후 기록본 저장이 가능합니다.");
      return;
    }

    const content = (recordDrafts[category] || "").trim();
    if (!content) {
      setError("저장할 기록본 내용이 없습니다.");
      return;
    }

    setSavingCategory(category);

    try {
      const body = new FormData();
      body.append("category", category);
      body.append("title", RECORD_CATEGORIES.find((item) => item.key === category)?.label || category);
      body.append("content", content);
      body.append("task_id", result?.task_id || "");
      body.append("source_type", result?.transcription_type || transcriptionType);

      await requestApi("/api/records", {
        method: "POST",
        token: authToken,
        body,
      });

      await fetchRecords(authToken);
      setNotice("기록본을 저장했습니다.");
      setActiveTab("records");
    } catch (e) {
      setError(e.message || "기록본 저장 실패");
    } finally {
      setSavingCategory("");
    }
  };

  const selectedTypeHint = useMemo(() => {
    if (transcriptionType === "sermon") return "설교 흐름(본론/결론/기도) 중심으로 구조화합니다.";
    if (transcriptionType === "phonecall") return "통화 화자 분리와 핵심 문장 중심으로 정리합니다.";
    return "회의 안건/결정/후속 조치를 분리해 정리합니다.";
  }, [transcriptionType]);

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

  const openPrivacyPolicy = async () => {
    const targetUrl = language === "en" ? PRIVACY_POLICY_URL_EN : PRIVACY_POLICY_URL_KO;
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (!supported) throw new Error("개인정보처리방침 링크를 열 수 없습니다.");
      await Linking.openURL(targetUrl);
    } catch (e) {
      setError(e.message || "개인정보처리방침 페이지를 열 수 없습니다.");
    }
  };

  const handleAcceptPrivacyPolicy = async () => {
    if (privacyConsentSaving || !privacyConsentChecked) return;

    setPrivacyConsentSaving(true);
    try {
      await AsyncStorage.setItem(PRIVACY_CONSENT_KEY, PRIVACY_POLICY_VERSION);
      setPrivacyAccepted(true);
      setNotice("개인정보처리방침 동의가 완료되었습니다.");
      setError("");
    } catch {
      setError("동의 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
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
        >
          <Text style={[styles.quickIconText, { color: activeTheme.textPrimary }]}>🌐</Text>
        </NmPressable>
        <NmPressable
          style={[styles.quickIconButton, { borderColor: activeTheme.inputBorder }]}
          onPress={() => setOpenSettingsMenu((prev) => (prev === "theme" ? "" : "theme"))}
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
            <Text style={[styles.quickMenuText, { color: language === "ko" ? activeTheme.accent : activeTheme.textPrimary }]}>한국어</Text>
          </NmPressable>
          <NmPressable
            style={[styles.quickMenuItem, language === "en" ? styles.quickMenuItemActive : null, { borderColor: activeTheme.inputBorder }]}
            onPress={() => {
              setLanguage("en");
              setOpenSettingsMenu("");
            }}
          >
            <Text style={[styles.quickMenuText, { color: language === "en" ? activeTheme.accent : activeTheme.textPrimary }]}>English</Text>
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
      <SafeAreaView style={[styles.centerScreen, { backgroundColor: activeTheme.bg }]}>
        <StatusBar style={resolvedThemeKey === "noir" ? "light" : "dark"} />
        <View pointerEvents="none" style={styles.softBackground}>
          <View style={[styles.softGlowOrbA, { backgroundColor: activeTheme.glowA }]} />
          <View style={[styles.softGlowOrbB, { backgroundColor: activeTheme.glowB }]} />
        </View>
        <ActivityIndicator size="large" color={activeTheme.accent} />
        <Text style={[styles.loadingText, { color: activeTheme.textPrimary }]}>앱 초기화 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: activeTheme.bg }]}>
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
        <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled">
          <FadeInView duration={420}>
            <View style={[styles.card, styles.authCard, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <Text style={[styles.authIntro, { color: activeTheme.textPrimary }]}>
                AI 음성 기록, 지금 시작하세요.
              </Text>
              <Text style={[styles.authSubcopy, { color: activeTheme.textSecondary }]}>
                로그인 후 바로 파일 업로드와 변환을 시작할 수 있습니다.
              </Text>

              <View style={styles.segmentRow}>
                <SegmentButton label="로그인" active={authMode === "login"} onPress={() => setAuthMode("login")} theme={activeTheme} />
                <SegmentButton label="회원가입" active={authMode === "signup"} onPress={() => setAuthMode("signup")} theme={activeTheme} />
              </View>

              {authMode === "signup" ? (
                <TextInput
                  style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                  value={authName}
                  onChangeText={setAuthName}
                  placeholder="이름"
                  placeholderTextColor={activeTheme.textSecondary}
                  autoCapitalize="none"
                />
              ) : null}

              <TextInput
                style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder="이메일"
                placeholderTextColor={activeTheme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={[styles.input, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, color: activeTheme.textPrimary }]}
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder="비밀번호"
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
                    ? "처리 중..."
                    : authMode === "signup"
                      ? "회원가입"
                      : "로그인"}
                </Text>
              </NmPressable>

              <Text style={[styles.orText, { color: activeTheme.textSecondary }]}>또는 소셜 로그인</Text>

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
                      {socialLoading === "google" ? "연결 중..." : "Google로 계속하기"}
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
                      {socialLoading === "kakao" ? "연결 중..." : "Kakao로 계속하기"}
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
                <Text style={[styles.userEmail, { color: activeTheme.textPrimary }]}>{authUser?.email || "로그인 사용자"}</Text>
                <Text style={[styles.userName, { color: activeTheme.textSecondary }]}>{authUser?.user_metadata?.full_name || authUser?.id || ""}</Text>
              </View>
              <NmPressable style={[styles.logoutButton, { borderColor: activeTheme.inputBorder }]} onPress={handleLogout}>
                <Text style={[styles.logoutButtonText, { color: activeTheme.errorText }]}>로그아웃</Text>
              </NmPressable>
            </View>
          </FadeInView>

          <FadeInView delay={70} duration={360}>
            <View style={[styles.tabsWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <View style={styles.segmentRow}>
                {APP_TABS.map((tab) => (
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
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>변환 설정</Text>

                  <View style={styles.segmentRow}>
                    {TRANSCRIPTION_TYPES.map((item) => (
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
                    <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>파일 선택</Text>
                  </NmPressable>

                  <Text style={[styles.fileInfo, { color: activeTheme.textPrimary }]}>
                    {pickedFile
                      ? `${pickedFile.name} (${Math.max(1, Math.round((pickedFile.size || 0) / 1024))} KB · ${pickedFile.mimeType})`
                      : "선택된 파일 없음"}
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
                    <Text style={styles.primaryButtonText}>{submitting ? "변환 중..." : "변환 시작"}</Text>
                  </NmPressable>

                  <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>{selectedTypeHint}</Text>
                  {taskStateText ? <Text style={[styles.taskStateText, { color: activeTheme.accent }]}>{taskStateText}</Text> : null}
                </View>
              </FadeInView>

              {result ? (
                <FadeInView key="transcribe-result" delay={100}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>변환 결과</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>작업 ID: {result.task_id}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>유형: {result.transcription_type || transcriptionType}</Text>
                    <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>문자 수: {result.characters || 0}</Text>

                    <Text style={styles.sectionTitle}>교정 텍스트</Text>
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
                      <Text style={[styles.secondaryButtonText, { color: activeTheme.textPrimary }]}>{summaryLoading ? "요약 생성 중..." : "설교 요약 생성"}</Text>
                    </NmPressable>

                    {result.summary ? (
                      <View style={[styles.summaryBox, { backgroundColor: activeTheme.noticeBg }]}>
                        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>요약</Text>
                        <Text selectable style={[styles.resultText, { color: activeTheme.textPrimary }]}>{result.summary}</Text>
                      </View>
                    ) : null}
                  </View>
                </FadeInView>
              ) : null}

              {result ? (
                <FadeInView key="transcribe-records" delay={200}>
                  <View style={[styles.card, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>기록본 생성 및 저장</Text>

                    {RECORD_CATEGORIES.map((category) => (
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
                                {draftLoadingCategory === category.key ? "생성 중" : "초안"}
                              </Text>
                            </NmPressable>
                            <NmPressable
                              style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                              onPress={() => handleSaveRecord(category.key)}
                              disabled={!!draftLoadingCategory || !!savingCategory}
                            >
                              <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                                {savingCategory === category.key ? "저장 중" : "저장"}
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
                          placeholder={`${category.label} 내용을 여기에 편집하세요`}
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
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>최근 변환 기록</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => fetchHistory(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{historyLoading ? "로딩..." : "새로고침"}</Text>
                    </NmPressable>
                  </View>

                  {history.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>변환 기록이 없습니다.</Text>
                  ) : (
                    history.map((item) => (
                      <View key={item.task_id} style={[styles.listItem, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
                        <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.transcription_type || "sermon"} · {item.status}</Text>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{formatDate(item.created_at)}</Text>
                        <Text numberOfLines={2} style={[styles.previewText, { color: activeTheme.textPrimary }]}>{item.summary_preview || ""}</Text>
                        <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => handleLoadHistoryItem(item.task_id)}>
                          <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>불러오기</Text>
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
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>저장 기록본</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]} onPress={() => fetchRecords(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{recordsLoading ? "로딩..." : "새로고침"}</Text>
                    </NmPressable>
                  </View>

                  {records.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>저장된 기록본이 없습니다.</Text>
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

      {!privacyAccepted ? (
        <View style={[styles.privacyOverlay, { backgroundColor: "rgba(5, 12, 24, 0.58)" }]}>
          <FadeInView duration={260}>
            <View style={[styles.privacyModal, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}>
              <Text style={[styles.privacyTitle, { color: activeTheme.textPrimary }]}>개인정보처리방침 동의</Text>
              <Text style={[styles.privacyBody, { color: activeTheme.textSecondary }]}>
                mallog24 이용 전 개인정보 처리 내용을 확인해주세요. 동의 후 로그인 및 음성 변환 기능을 사용할 수 있습니다.
              </Text>

              <View style={[styles.privacySummaryBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                  • 원본 음성 파일: 변환 처리 후 임시 저장소에서 지체 없이 삭제
                </Text>
                <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                  • 변환 텍스트/기록본: 히스토리 및 기록 기능 제공 목적 범위 내 보관
                </Text>
                <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                  • 처리 위탁: Supabase, OpenAI, Google(Gemini)
                </Text>
                <Text style={[styles.privacySummaryItem, { color: activeTheme.textPrimary }]}>
                  • 소셜 로그인: Google/Kakao 계정 정보(이메일, 프로필, UID)
                </Text>
              </View>

              <NmPressable
                style={[styles.privacyLinkButton, { backgroundColor: activeTheme.surface, borderColor: activeTheme.inputBorder }]}
                onPress={openPrivacyPolicy}
              >
                <Text style={[styles.privacyLinkText, { color: activeTheme.accent }]}>개인정보처리방침 전문 보기</Text>
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
                  개인정보처리방침을 확인했고 동의합니다.
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
                  {privacyConsentSaving ? "저장 중..." : "동의하고 시작하기"}
                </Text>
              </NmPressable>
            </View>
          </FadeInView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NM.bg,
    position: "relative",
    overflow: "hidden",
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
    paddingBottom: 28,
    justifyContent: "flex-start",
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
    minWidth: 68,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  authIntro: {
    color: NM.textPrimary,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 4,
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
  },
  privacyModal: {
    width: "100%",
    maxWidth: 640,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 11,
    shadowColor: NM.shadowTint,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 8,
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
