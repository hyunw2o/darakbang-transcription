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
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const MOBILE_THEME_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "aurora", label: "Aurora" },
  { key: "noir", label: "Noir" },
  { key: "sunset", label: "Sunset" },
];

const MOBILE_THEMES = {
  aurora: {
    bg: "#e8eefb",
    light: "#ffffff",
    dark: "#a3b1c6",
    accent: "#3b7dd8",
    accentSoft: "#5a9ae6",
    textPrimary: "#2d3748",
    textSecondary: "#64748b",
    inputBg: "#d6dbe4",
    inputBorder: "#c8ced8",
    errorBg: "#e8d5d5",
    errorText: "#b91c1c",
    noticeBg: "#d5dfe8",
    noticeText: "#1d4ed8",
    radius: 18,
    radiusSm: 14,
  },
  noir: {
    bg: "#e6e9ef",
    light: "#f9fbff",
    dark: "#a8b0c0",
    accent: "#35445f",
    accentSoft: "#4e6287",
    textPrimary: "#202636",
    textSecondary: "#606a80",
    inputBg: "#d7dce6",
    inputBorder: "#bec7d6",
    errorBg: "#e7d8d8",
    errorText: "#9b2634",
    noticeBg: "#dce2ea",
    noticeText: "#364b73",
    radius: 18,
    radiusSm: 14,
  },
  sunset: {
    bg: "#f8eee4",
    light: "#fff9f2",
    dark: "#d2bca6",
    accent: "#cf6e30",
    accentSoft: "#e08546",
    textPrimary: "#3b2d24",
    textSecondary: "#7a6050",
    inputBg: "#eadccf",
    inputBorder: "#dcc8b4",
    errorBg: "#f0d5cf",
    errorText: "#a7392f",
    noticeBg: "#f2e2d2",
    noticeText: "#a15b26",
    radius: 18,
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

  const isLoggedIn = !!authToken && !!authUser;
  const resolvedThemeKey =
    themeMode === "auto" ? (colorScheme === "dark" ? "noir" : "aurora") : themeKey;
  const activeTheme = MOBILE_THEMES[resolvedThemeKey] || MOBILE_THEMES.aurora;

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
        if (savedThemeMode === "manual" || savedThemeMode === "auto") {
          setThemeMode(savedThemeMode);
        }
        if (savedTheme && MOBILE_THEMES[savedTheme]) {
          setThemeKey(savedTheme);
        }

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

  const renderThemeSelector = () => (
    <View style={[styles.themeCard, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
      <Text style={[styles.themeLabel, { color: activeTheme.textSecondary }]}>테마 (Auto 추천)</Text>
      <View style={styles.themeRow}>
        {MOBILE_THEME_OPTIONS.map((themeOption) => {
          const active =
            themeOption.key === "auto"
              ? themeMode === "auto"
              : themeMode === "manual" && themeOption.key === themeKey;
          return (
            <NmPressable
              key={themeOption.key}
              style={[
                styles.themeOption,
                {
                  backgroundColor: active ? activeTheme.accent : activeTheme.inputBg,
                  borderColor: active ? activeTheme.accentSoft : activeTheme.inputBorder,
                },
              ]}
              onPress={() => {
                if (themeOption.key === "auto") {
                  setThemeMode("auto");
                  return;
                }
                setThemeMode("manual");
                setThemeKey(themeOption.key);
              }}
            >
              <Text
                style={[
                  styles.themeOptionText,
                  { color: active ? "#ffffff" : activeTheme.textPrimary },
                ]}
              >
                {themeOption.label}
              </Text>
            </NmPressable>
          );
        })}
      </View>
    </View>
  );

  if (bootLoading) {
    return (
      <SafeAreaView style={[styles.centerScreen, { backgroundColor: activeTheme.bg }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={activeTheme.accent} />
        <Text style={[styles.loadingText, { color: activeTheme.textPrimary }]}>앱 초기화 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: activeTheme.bg }]}>
      <StatusBar style="dark" />

      <Banner type="error" text={error} />
      <Banner type="notice" text={notice} />

      {!isLoggedIn ? (
        <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled">
          {renderThemeSelector()}
          <FadeInView duration={420}>
            <View style={[styles.card, styles.authCard, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
              <Text style={[styles.authLabel, { color: activeTheme.textPrimary }]}>회원 인증</Text>

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
                    { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder },
                    socialLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => handleSocialLogin("google")}
                  disabled={!!socialLoading}
                >
                  <Text style={[styles.socialButtonText, { color: activeTheme.textPrimary }]}>{socialLoading === "google" ? "연결 중..." : "Google"}</Text>
                </NmPressable>

                <NmPressable
                  style={[
                    styles.socialButton,
                    { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder },
                    socialLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => handleSocialLogin("kakao")}
                  disabled={!!socialLoading}
                >
                  <Text style={[styles.socialButtonText, { color: activeTheme.textPrimary }]}>{socialLoading === "kakao" ? "연결 중..." : "Kakao"}</Text>
                </NmPressable>
              </View>

              <Text style={[styles.helpText, { color: activeTheme.textSecondary }]}>
                소셜 로그인은 앱 리다이렉트 URL/공급자 설정이 맞아야 동작합니다.
              </Text>
              <Text style={[styles.authSubLabel, { color: activeTheme.textSecondary }]}>로그인 후 파일 변환과 기록본 저장 기능을 사용할 수 있습니다.</Text>
            </View>
          </FadeInView>
        </ScrollView>
      ) : (
        <View style={styles.workspaceContainer}>
          <FadeInView>
            {renderThemeSelector()}
          </FadeInView>

          <FadeInView>
            <View style={[styles.userBar, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
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
                <View style={[styles.card, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                  <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>변환 설정</Text>
                  <View style={styles.segmentRow}>
                    <SegmentButton label="한국어" active={language === "ko"} onPress={() => setLanguage("ko")} theme={activeTheme} />
                    <SegmentButton label="English" active={language === "en"} onPress={() => setLanguage("en")} theme={activeTheme} />
                  </View>

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

                  <NmPressable style={[styles.secondaryButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]} onPress={pickAudioFile}>
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
                  <View style={[styles.card, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
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
                        { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder },
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
                  <View style={[styles.card, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>기록본 생성 및 저장</Text>

                    {RECORD_CATEGORIES.map((category) => (
                      <View key={category.key} style={[styles.recordBlock, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                        <View style={styles.recordHeader}>
                          <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>{category.label}</Text>
                          <View style={styles.recordActionRow}>
                            <NmPressable
                              style={[styles.tinyButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}
                              onPress={() => handleGenerateRecordDraft(category.key)}
                              disabled={!!draftLoadingCategory || !!savingCategory}
                            >
                              <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>
                                {draftLoadingCategory === category.key ? "생성 중" : "초안"}
                              </Text>
                            </NmPressable>
                            <NmPressable
                              style={[styles.tinyButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}
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
                <View style={[styles.card, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                  <View style={styles.inlineBetween}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>최근 변환 기록</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]} onPress={() => fetchHistory(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{historyLoading ? "로딩..." : "새로고침"}</Text>
                    </NmPressable>
                  </View>

                  {history.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>변환 기록이 없습니다.</Text>
                  ) : (
                    history.map((item) => (
                      <View key={item.task_id} style={[styles.listItem, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                        <Text style={[styles.listTitle, { color: activeTheme.textPrimary }]}>{item.transcription_type || "sermon"} · {item.status}</Text>
                        <Text style={[styles.metaText, { color: activeTheme.textSecondary }]}>{formatDate(item.created_at)}</Text>
                        <Text numberOfLines={2} style={[styles.previewText, { color: activeTheme.textPrimary }]}>{item.summary_preview || ""}</Text>
                        <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]} onPress={() => handleLoadHistoryItem(item.task_id)}>
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
                <View style={[styles.card, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
                  <View style={styles.inlineBetween}>
                    <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>저장 기록본</Text>
                    <NmPressable style={[styles.tinyButton, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]} onPress={() => fetchRecords(authToken)}>
                      <Text style={[styles.tinyButtonText, { color: activeTheme.textPrimary }]}>{recordsLoading ? "로딩..." : "새로고침"}</Text>
                    </NmPressable>
                  </View>

                  {records.length === 0 ? (
                    <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>저장된 기록본이 없습니다.</Text>
                  ) : (
                    records.map((item) => (
                      <View key={item.id || `${item.category}-${item.created_at}`} style={[styles.listItem, { backgroundColor: activeTheme.bg, borderColor: activeTheme.inputBorder }]}>
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
    </SafeAreaView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NM.bg,
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
  workspaceContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 16,
  },
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    justifyContent: "flex-start",
  },
  themeCard: {
    marginBottom: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  themeLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  themeOptionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  authCard: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  authLabel: {
    color: NM.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  authSubLabel: {
    color: NM.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
    backgroundColor: NM.bg,
    borderRadius: NM.radius,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#edf2f8",
    shadowColor: NM.dark,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 9,
    elevation: 3,
  },
  cardTitle: {
    color: NM.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  tabsWrap: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: NM.radiusSm,
    backgroundColor: NM.inputBg,
    padding: 5,
    borderWidth: 1,
    borderColor: "#d0d7e1",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  segmentButtonActive: {
    backgroundColor: NM.bg,
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
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
    borderRadius: NM.radiusSm,
    backgroundColor: NM.accent,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4f8ce1",
    shadowColor: NM.dark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 7,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    borderRadius: NM.radiusSm,
    backgroundColor: NM.bg,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#edf2f8",
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryButtonText: {
    color: NM.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  tinyButton: {
    borderRadius: 10,
    backgroundColor: NM.bg,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#edf2f8",
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
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
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    borderRadius: NM.radiusSm,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: NM.bg,
    borderWidth: 1,
    borderColor: "#edf2f8",
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  socialButtonText: {
    color: NM.textPrimary,
    fontSize: 13,
    fontWeight: "700",
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
    backgroundColor: NM.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: NM.dark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#edf2f8",
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
    borderRadius: 10,
    backgroundColor: "#e0cece",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#ead5d5",
    shadowColor: "#b0a0a0",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
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
    backgroundColor: NM.bg,
    padding: 12,
    gap: 8,
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
    backgroundColor: NM.bg,
    padding: 12,
    gap: 6,
    shadowColor: NM.dark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
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
});
