import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as ExpoLinking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://darakbang-transcription-backend.onrender.com";
const AUTH_TOKEN_KEY = "mallog24_access_token";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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

function SegmentButton({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}>
      <Text style={[styles.segmentButtonText, active ? styles.segmentButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function Banner({ type = "notice", text }) {
  if (!text) return null;
  return (
    <View style={[styles.banner, type === "error" ? styles.bannerError : styles.bannerNotice]}>
      <Text style={[styles.bannerText, type === "error" ? styles.bannerTextError : styles.bannerTextNotice]}>
        {text}
      </Text>
    </View>
  );
}

function App() {
  const pollRef = useRef(null);

  const [bootLoading, setBootLoading] = useState(true);

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

  if (bootLoading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>앱 초기화 중...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      <Banner type="error" text={error} />
      <Banner type="notice" text={notice} />

      {!isLoggedIn ? (
        <ScrollView contentContainerStyle={styles.authScrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, styles.authCard]}>
            <Text style={styles.authLabel}>회원 인증</Text>

            <View style={styles.segmentRow}>
              <SegmentButton label="로그인" active={authMode === "login"} onPress={() => setAuthMode("login")} />
              <SegmentButton label="회원가입" active={authMode === "signup"} onPress={() => setAuthMode("signup")} />
            </View>

            {authMode === "signup" ? (
              <TextInput
                style={styles.input}
                value={authName}
                onChangeText={setAuthName}
                placeholder="이름"
                autoCapitalize="none"
              />
            ) : null}

            <TextInput
              style={styles.input}
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="이메일"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              value={authPassword}
              onChangeText={setAuthPassword}
              placeholder="비밀번호"
              secureTextEntry
            />

            <Pressable style={[styles.primaryButton, authLoading ? styles.buttonDisabled : null]} onPress={handleAuthSubmit} disabled={authLoading}>
              <Text style={styles.primaryButtonText}>
                {authLoading
                  ? "처리 중..."
                  : authMode === "signup"
                    ? "회원가입"
                    : "로그인"}
              </Text>
            </Pressable>

            <Text style={styles.orText}>또는 소셜 로그인</Text>

            <View style={styles.socialRow}>
              <Pressable
                style={[styles.socialButton, socialLoading ? styles.buttonDisabled : null]}
                onPress={() => handleSocialLogin("google")}
                disabled={!!socialLoading}
              >
                <Text style={styles.socialButtonText}>{socialLoading === "google" ? "연결 중..." : "Google"}</Text>
              </Pressable>

              <Pressable
                style={[styles.socialButton, socialLoading ? styles.buttonDisabled : null]}
                onPress={() => handleSocialLogin("kakao")}
                disabled={!!socialLoading}
              >
                <Text style={styles.socialButtonText}>{socialLoading === "kakao" ? "연결 중..." : "Kakao"}</Text>
              </Pressable>
            </View>

            <Text style={styles.helpText}>
              소셜 로그인은 앱 리다이렉트 URL/공급자 설정이 맞아야 동작합니다.
            </Text>
            <Text style={styles.authSubLabel}>로그인 후 파일 변환과 기록본 저장 기능을 사용할 수 있습니다.</Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.workspaceContainer}>
          <View style={styles.userBar}>
            <View style={styles.userInfo}>
              <Text style={styles.userEmail}>{authUser?.email || "로그인 사용자"}</Text>
              <Text style={styles.userName}>{authUser?.user_metadata?.full_name || authUser?.id || ""}</Text>
            </View>
            <Pressable style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>로그아웃</Text>
            </Pressable>
          </View>

          <View style={styles.tabsWrap}>
            <View style={styles.segmentRow}>
              {APP_TABS.map((tab) => (
                <SegmentButton
                  key={tab.key}
                  label={tab.label}
                  active={activeTab === tab.key}
                  onPress={() => setActiveTab(tab.key)}
                />
              ))}
            </View>
          </View>

          {activeTab === "transcribe" ? (
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                <Text style={styles.cardTitle}>변환 설정</Text>
                <View style={styles.segmentRow}>
                  <SegmentButton label="한국어" active={language === "ko"} onPress={() => setLanguage("ko")} />
                  <SegmentButton label="English" active={language === "en"} onPress={() => setLanguage("en")} />
                </View>

                <View style={styles.segmentRow}>
                  {TRANSCRIPTION_TYPES.map((item) => (
                    <SegmentButton
                      key={item.key}
                      label={item.label}
                      active={transcriptionType === item.key}
                      onPress={() => setTranscriptionType(item.key)}
                    />
                  ))}
                </View>

                <Pressable style={styles.secondaryButton} onPress={pickAudioFile}>
                  <Text style={styles.secondaryButtonText}>파일 선택</Text>
                </Pressable>

                <Text style={styles.fileInfo}>
                  {pickedFile
                    ? `${pickedFile.name} (${Math.max(1, Math.round((pickedFile.size || 0) / 1024))} KB · ${pickedFile.mimeType})`
                    : "선택된 파일 없음"}
                </Text>

                <Pressable
                  style={[styles.primaryButton, submitting ? styles.buttonDisabled : null]}
                  onPress={handleTranscribe}
                  disabled={submitting}
                >
                  <Text style={styles.primaryButtonText}>{submitting ? "변환 중..." : "변환 시작"}</Text>
                </Pressable>

                <Text style={styles.helpText}>{selectedTypeHint}</Text>
                {taskStateText ? <Text style={styles.taskStateText}>{taskStateText}</Text> : null}
              </View>

              {result ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>변환 결과</Text>
                  <Text style={styles.metaText}>작업 ID: {result.task_id}</Text>
                  <Text style={styles.metaText}>유형: {result.transcription_type || transcriptionType}</Text>
                  <Text style={styles.metaText}>문자 수: {result.characters || 0}</Text>

                  <Text style={styles.sectionTitle}>교정 텍스트</Text>
                  <View style={styles.resultBox}>
                    <Text selectable style={styles.resultText}>
                      {result.corrected_text || result.raw_text || ""}
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.secondaryButton, summaryLoading ? styles.buttonDisabled : null]}
                    onPress={handleSummarize}
                    disabled={summaryLoading}
                  >
                    <Text style={styles.secondaryButtonText}>{summaryLoading ? "요약 생성 중..." : "설교 요약 생성"}</Text>
                  </Pressable>

                  {result.summary ? (
                    <View style={styles.summaryBox}>
                      <Text style={styles.sectionTitle}>요약</Text>
                      <Text selectable style={styles.resultText}>{result.summary}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {result ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>기록본 생성 및 저장</Text>

                  {RECORD_CATEGORIES.map((category) => (
                    <View key={category.key} style={styles.recordBlock}>
                      <View style={styles.recordHeader}>
                        <Text style={styles.sectionTitle}>{category.label}</Text>
                        <View style={styles.recordActionRow}>
                          <Pressable
                            style={styles.tinyButton}
                            onPress={() => handleGenerateRecordDraft(category.key)}
                            disabled={!!draftLoadingCategory || !!savingCategory}
                          >
                            <Text style={styles.tinyButtonText}>
                              {draftLoadingCategory === category.key ? "생성 중" : "초안"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={styles.tinyButton}
                            onPress={() => handleSaveRecord(category.key)}
                            disabled={!!draftLoadingCategory || !!savingCategory}
                          >
                            <Text style={styles.tinyButtonText}>
                              {savingCategory === category.key ? "저장 중" : "저장"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <TextInput
                        style={styles.recordEditor}
                        multiline
                        value={recordDrafts[category.key] || ""}
                        onChangeText={(text) =>
                          setRecordDrafts((prev) => ({ ...prev, [category.key]: text }))
                        }
                        placeholder={`${category.label} 내용을 여기에 편집하세요`}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {activeTab === "history" ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.card}>
                <View style={styles.inlineBetween}>
                  <Text style={styles.cardTitle}>최근 변환 기록</Text>
                  <Pressable style={styles.tinyButton} onPress={() => fetchHistory(authToken)}>
                    <Text style={styles.tinyButtonText}>{historyLoading ? "로딩..." : "새로고침"}</Text>
                  </Pressable>
                </View>

                {history.length === 0 ? (
                  <Text style={styles.emptyText}>변환 기록이 없습니다.</Text>
                ) : (
                  history.map((item) => (
                    <View key={item.task_id} style={styles.listItem}>
                      <Text style={styles.listTitle}>{item.transcription_type || "sermon"} · {item.status}</Text>
                      <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
                      <Text numberOfLines={2} style={styles.previewText}>{item.summary_preview || ""}</Text>
                      <Pressable style={styles.tinyButton} onPress={() => handleLoadHistoryItem(item.task_id)}>
                        <Text style={styles.tinyButtonText}>불러오기</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : null}

          {activeTab === "records" ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.card}>
                <View style={styles.inlineBetween}>
                  <Text style={styles.cardTitle}>저장 기록본</Text>
                  <Pressable style={styles.tinyButton} onPress={() => fetchRecords(authToken)}>
                    <Text style={styles.tinyButtonText}>{recordsLoading ? "로딩..." : "새로고침"}</Text>
                  </Pressable>
                </View>

                {records.length === 0 ? (
                  <Text style={styles.emptyText}>저장된 기록본이 없습니다.</Text>
                ) : (
                  records.map((item) => (
                    <View key={item.id || `${item.category}-${item.created_at}`} style={styles.listItem}>
                      <Text style={styles.listTitle}>{item.title || item.category}</Text>
                      <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
                      <Text selectable style={styles.previewText}>{item.content || ""}</Text>
                    </View>
                  ))
                )}
              </View>
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
    backgroundColor: "#edf2fb",
  },
  centerScreen: {
    flex: 1,
    backgroundColor: "#eef4ff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  workspaceContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 14,
  },
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    justifyContent: "flex-start",
  },
  authCard: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  authLabel: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  authSubLabel: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  banner: {
    marginHorizontal: 14,
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  bannerNotice: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  bannerTextError: {
    color: "#b91c1c",
  },
  bannerTextNotice: {
    color: "#1d4ed8",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#dbe4f0",
    gap: 11,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  tabsWrap: {
    marginHorizontal: 14,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4f0",
    backgroundColor: "#ffffff",
    padding: 6,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4dce8",
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f8fbff",
  },
  segmentButtonActive: {
    backgroundColor: "#e7f1ff",
    borderColor: "#93c5fd",
  },
  segmentButtonText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "700",
  },
  segmentButtonTextActive: {
    color: "#1d4ed8",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4dce8",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#ffffff",
    fontSize: 14,
    color: "#0f172a",
  },
  primaryButton: {
    borderRadius: 11,
    backgroundColor: "#1d4ed8",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#d4dce8",
    backgroundColor: "#f8fbff",
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 13,
  },
  tinyButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d4dce8",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tinyButtonText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  orText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4dce8",
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  socialButtonText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
  },
  helpText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  userBar: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe4f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 13,
  },
  userName: {
    marginTop: 2,
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 11,
  },
  logoutButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutButtonText: {
    color: "#be123c",
    fontWeight: "700",
    fontSize: 11,
  },
  fileInfo: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  taskStateText: {
    color: "#0369a1",
    fontWeight: "700",
    fontSize: 12,
  },
  metaText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
  resultBox: {
    borderWidth: 1,
    borderColor: "#d4dce8",
    borderRadius: 11,
    backgroundColor: "#f8fbff",
    padding: 11,
    maxHeight: 260,
  },
  summaryBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    padding: 10,
    gap: 6,
  },
  resultText: {
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 19,
  },
  recordBlock: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#dbe4f0",
    borderRadius: 11,
    padding: 10,
    gap: 8,
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
    borderWidth: 1,
    borderColor: "#d4dce8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 12,
    lineHeight: 18,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  listItem: {
    borderWidth: 1,
    borderColor: "#dbe4f0",
    borderRadius: 11,
    padding: 10,
    gap: 6,
  },
  listTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
  previewText: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 18,
  },
});
