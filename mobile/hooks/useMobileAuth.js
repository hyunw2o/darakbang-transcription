import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTH_REQUEST_TIMEOUT_MS,
  AUTH_SESSION_EXPIRES_AT_KEY,
  AUTH_TOKEN_KEY,
  FREE_MONTHLY_LIMIT_SECONDS,
  OURS_URL,
} from "../config";
import {
  buildDirectOauthUrl,
  buildOauthFallbackUser,
  parseAuthParamsFromUrl,
  parseJwtExpMs,
  shouldShowOauthConfigHint,
} from "../utils/auth";
import {
  getFriendlyAuthError,
  isNetworkFetchError,
  isTimeoutErrorMessage,
  requestApi,
  requestApiWithTimeoutRetry,
} from "../utils/network";
import { formatSecondsToHourMinuteSecond } from "../utils/format";

WebBrowser.maybeCompleteAuthSession?.();

function formatAppleFullName(fullName) {
  if (!fullName) return "";
  return [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].filter(Boolean).join(" ").trim();
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default function useMobileAuth({
  copy,
  language,
  clearMessages,
  setNotice,
  setError,
  onSessionReady,
  onSessionCleared,
}) {
  const [bootLoading, setBootLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState(0);
  const [sessionNowMs, setSessionNowMs] = useState(Date.now());
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const copyRef = useLatestRef(copy);
  const setNoticeRef = useLatestRef(setNotice);
  const setErrorRef = useLatestRef(setError);
  const onSessionReadyRef = useLatestRef(onSessionReady);
  const onSessionClearedRef = useLatestRef(onSessionCleared);

  const isLoggedIn = !!authToken && !!authUser;
  const sessionRemainingSeconds = sessionExpiresAtMs
    ? Math.max(0, Math.floor((sessionExpiresAtMs - sessionNowMs) / 1000))
    : 0;
  const sessionRemainingLabel = useMemo(() => {
    if (!sessionExpiresAtMs) return copy.sessionChecking;
    if (sessionRemainingSeconds <= 0) return copy.sessionExpired;
    return formatSecondsToHourMinuteSecond(sessionRemainingSeconds);
  }, [copy.sessionChecking, copy.sessionExpired, sessionExpiresAtMs, sessionRemainingSeconds]);

  useEffect(() => {
    if (!isLoggedIn || !sessionExpiresAtMs) return undefined;
    const intervalId = setInterval(() => {
      setSessionNowMs(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isLoggedIn, sessionExpiresAtMs]);

  const warmUpBackend = useCallback(() => {
    requestApi("/health", { timeoutMs: 15000 }).catch(() => {});
  }, []);

  const fetchUsage = useCallback(async (token = authToken, { quiet = false } = {}) => {
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
    } catch (error) {
      if (!quiet) {
        setError(error.message || copy.errors.usageReadFailed);
      }
      return null;
    } finally {
      setUsageLoading(false);
    }
  }, [authToken, copy.errors.usageReadFailed, setError]);

  const clearAuthState = useCallback(async (message = "") => {
    setAuthToken("");
    setAuthUser(null);
    setSessionExpiresAtMs(0);
    setSessionNowMs(Date.now());
    setUsage(null);
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_SESSION_EXPIRES_AT_KEY]);
    await onSessionClearedRef.current?.();
    if (message) {
      setNoticeRef.current?.(message);
    }
  }, [onSessionClearedRef, setNoticeRef]);

  const hydrateWithToken = useCallback(async (
    token,
    {
      successMessage = "",
      userHint = null,
      verifyUser = true,
      loadWorkspace = false,
      sessionHintSeconds = 0,
      sessionHintExpiresAtMs = 0,
    } = {}
  ) => {
    try {
      const shouldVerifyUser = verifyUser || !userHint;
      const userData = shouldVerifyUser
        ? (await requestApiWithTimeoutRetry("/api/auth/me", { token, timeoutMs: AUTH_REQUEST_TIMEOUT_MS }))?.user || null
        : (userHint || null);

      setAuthToken(token);
      setAuthUser(userData);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);

      const normalizedHintExpiresAtMs = Math.max(0, Number(sessionHintExpiresAtMs) || 0);
      const normalizedHintSeconds = Math.max(0, Number(sessionHintSeconds) || 0);
      const tokenExpMs = parseJwtExpMs(token);
      const resolvedSessionExpiresAtMs = normalizedHintExpiresAtMs || tokenExpMs || (
        normalizedHintSeconds > 0 ? Date.now() + (normalizedHintSeconds * 1000) : 0
      );
      if (resolvedSessionExpiresAtMs > 0) {
        setSessionExpiresAtMs(resolvedSessionExpiresAtMs);
        setSessionNowMs(Date.now());
        await AsyncStorage.setItem(
          AUTH_SESSION_EXPIRES_AT_KEY,
          String(Math.floor(resolvedSessionExpiresAtMs))
        );
      }

      if (loadWorkspace) {
        await onSessionReadyRef.current?.(token);
      }

      if (successMessage) setNoticeRef.current?.(successMessage);
      setErrorRef.current?.("");
    } catch (error) {
      await clearAuthState("");
      throw error;
    }
  }, [clearAuthState, onSessionReadyRef, setErrorRef, setNoticeRef]);

  const handleDeepLink = useCallback(async (url) => {
    const activeCopy = copyRef.current;
    const { accessToken, oauthError, expiresInSeconds } = parseAuthParamsFromUrl(url);

    if (oauthError) {
      setErrorRef.current?.(`${activeCopy.errors.socialFailedPrefix}: ${oauthError}`);
      setSocialLoading("");
      return;
    }

    if (!accessToken) return;

    try {
      const userHint = buildOauthFallbackUser();
      await hydrateWithToken(accessToken, {
        successMessage: activeCopy.notices.socialLoginDone,
        userHint,
        verifyUser: false,
        loadWorkspace: true,
        sessionHintSeconds: expiresInSeconds,
      });
    } catch (error) {
      setErrorRef.current?.(error.message || activeCopy.errors.socialSessionFailed);
    } finally {
      setSocialLoading("");
    }
  }, [copyRef, hydrateWithToken, setErrorRef]);

  useEffect(() => {
    let active = true;
    warmUpBackend();

    const urlListener = Linking.addEventListener("url", ({ url }) => {
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
          const savedSessionExpiresAt = await AsyncStorage.getItem(AUTH_SESSION_EXPIRES_AT_KEY);
          const parsedSavedSessionExpiresAt = Math.max(
            0,
            parseInt(String(savedSessionExpiresAt || ""), 10) || 0
          );
          if (parsedSavedSessionExpiresAt > 0) {
            setSessionExpiresAtMs(parsedSavedSessionExpiresAt);
            setSessionNowMs(Date.now());
          }
          if (savedToken) {
            await hydrateWithToken(savedToken, {
              verifyUser: true,
              loadWorkspace: true,
              sessionHintExpiresAtMs: parsedSavedSessionExpiresAt,
            });
          }
        }
      } catch {
        await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_SESSION_EXPIRES_AT_KEY]);
      } finally {
        if (active) setBootLoading(false);
      }
    })();

    return () => {
      active = false;
      urlListener?.remove?.();
    };
  }, [handleDeepLink, hydrateWithToken, warmUpBackend]);

  const handleAuthSubmit = useCallback(async () => {
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
        await onSessionClearedRef.current?.();
        await hydrateWithToken(data.access_token, {
          successMessage: authMode === "signup" ? copy.notices.authDoneSignup : copy.notices.authDoneLogin,
          userHint: data?.user || null,
          verifyUser: false,
          loadWorkspace: true,
          sessionHintSeconds: Number(data?.expires_in) || 0,
        });
      } else {
        setNotice(data?.message || copy.notices.signupDone);
      }

      setAuthPassword("");
      if (authMode === "signup") setAuthMode("login");
    } catch (error) {
      setError(getFriendlyAuthError(error.message, copy));
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authMode, authName, authPassword, clearMessages, copy, hydrateWithToken, onSessionClearedRef, setError, setNotice]);

  const handleSocialLogin = useCallback(async (provider) => {
    if (socialLoading) return;

    clearMessages();
    setSocialLoading(provider);

    try {
      if (provider === "apple" && Platform.OS === "ios") {
        const available = await AppleAuthentication.isAvailableAsync();
        if (!available) throw new Error("Sign in with Apple is not available on this device.");

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential?.identityToken) {
          throw new Error("Apple identity token was not returned.");
        }

        const data = await requestApiWithTimeoutRetry("/api/auth/apple", {
          method: "POST",
          body: JSON.stringify({
            identity_token: credential.identityToken,
            authorization_code: credential.authorizationCode || "",
            user_identifier: credential.user || "",
            email: credential.email || "",
            full_name: formatAppleFullName(credential.fullName),
          }),
          timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
        });

        const token = data?.access_token || "";
        if (!token) throw new Error(copy.errors.socialSessionFailed);

        await onSessionClearedRef.current?.();
        await hydrateWithToken(token, {
          successMessage: copy.notices.socialLoginDone,
          userHint: data?.user || null,
          verifyUser: false,
          loadWorkspace: true,
          sessionHintSeconds: data?.expires_in || 0,
        });
        setSocialLoading("");
        return;
      }

      const redirectTo = ExpoLinking.createURL("auth-callback");
      const path = `/api/auth/oauth-url?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
      const directOauthUrl = buildDirectOauthUrl(provider, redirectTo);
      let oauthUrl = "";
      try {
        const data = await requestApiWithTimeoutRetry(path, { timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
        oauthUrl = data?.auth_url || "";
      } catch (oauthUrlError) {
        if (
          directOauthUrl &&
          (isTimeoutErrorMessage(oauthUrlError?.message || "") || isNetworkFetchError(oauthUrlError))
        ) {
          oauthUrl = directOauthUrl;
        } else {
          throw oauthUrlError;
        }
      }
      if (!oauthUrl) throw new Error(copy.errors.oauthUrlCreate);

      const authResult = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectTo, {
        preferEphemeralSession: false,
      });
      if (authResult?.type === "success" && authResult?.url) {
        await handleDeepLink(authResult.url);
      } else if (authResult?.type === "cancel" || authResult?.type === "dismiss") {
        setSocialLoading("");
      } else {
        throw new Error(copy.errors.openLoginUrl);
      }
      setSocialLoading("");
    } catch (error) {
      if (provider === "apple" && error?.code === "ERR_REQUEST_CANCELED") {
        setSocialLoading("");
        return;
      }
      const rawMessage = error?.message || copy.errors.socialStartFailed;
      const withHint = shouldShowOauthConfigHint(rawMessage)
        ? `${rawMessage}\n(Config check required: backend OAUTH_REDIRECT_ALLOW_SCHEMES / Supabase Redirect URL)`
        : rawMessage;
      setError(withHint);
      setSocialLoading("");
    }
  }, [
    clearMessages,
    copy.errors.oauthUrlCreate,
    copy.errors.openLoginUrl,
    copy.errors.socialSessionFailed,
    copy.errors.socialStartFailed,
    copy.notices.socialLoginDone,
    handleDeepLink,
    hydrateWithToken,
    onSessionClearedRef,
    setError,
    socialLoading,
  ]);

  const handleLogout = useCallback(async () => {
    clearMessages();
    await clearAuthState(copy.notices.loggedOut);
  }, [clearAuthState, clearMessages, copy.notices.loggedOut]);

  const openExternalUrl = useCallback(async (url, fallbackMessage) => {
    if (!url) throw new Error(fallbackMessage || copy.errors.openExternalFailed);
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error(fallbackMessage || copy.errors.openExternalFailed);
    await Linking.openURL(url);
  }, [copy.errors.openExternalFailed]);

  const handleOpenOurs = useCallback(async () => {
    try {
      await openExternalUrl(OURS_URL, copy.errors.openExternalFailed);
    } catch (error) {
      setError(error.message || copy.errors.openExternalFailed);
    }
  }, [copy.errors.openExternalFailed, openExternalUrl, setError]);

  const handleDeleteAccount = useCallback(async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    setAuthLoading(true);
    try {
      const data = await requestApi("/api/auth/account", {
        method: "DELETE",
        token: authToken,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      });
      await clearAuthState(data?.message || copy.notices.accountDeleted);
    } catch (error) {
      setError(error.message || copy.errors.accountDeleteFailed);
    } finally {
      setAuthLoading(false);
    }
  }, [
    authToken,
    clearAuthState,
    clearMessages,
    copy.errors.accountDeleteFailed,
    copy.errors.authRequired,
    copy.notices.accountDeleted,
    isLoggedIn,
    setError,
  ]);

  return {
    bootLoading,
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
    sessionExpiresAtMs,
    sessionRemainingLabel,
    usage,
    usageLoading,
    fetchUsage,
    handleAuthSubmit,
    handleSocialLogin,
    handleLogout,
    handleOpenOurs,
    handleDeleteAccount,
    clearAuthState,
  };
}
