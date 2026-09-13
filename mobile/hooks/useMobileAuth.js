import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AUTH_REQUEST_TIMEOUT_MS, AUTH_SESSION_EXPIRES_AT_KEY, AUTH_TOKEN_KEY, OURS_URL, SITE_URL } from "../config";
import { buildDirectOauthUrl, parseAuthParamsFromUrl, parseJwtExpMs, shouldShowOauthConfigHint } from "../utils/auth";
import { getFriendlyAuthError, isNetworkFetchError, isTimeoutErrorMessage, requestApi, requestApiWithTimeoutRetry } from "../utils/network";
import { createSessionScope, sessionEndedError } from "../utils/session";
import { formatSecondsToHourMinuteSecond } from "../utils/format";

WebBrowser.maybeCompleteAuthSession?.();

export default function useMobileAuth({ copy, language, clearMessages, setNotice, setError }) {
  const [status, setStatus] = useState("restoring");
  const [session, setSession] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [sessionNowMs, setSessionNowMs] = useState(Date.now());
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);
  const latest = useRef({});
  latest.current = { copy, language, clearMessages, setNotice, setError };
  const scopeRef = useRef(null);
  const recoveryRef = useRef(null);
  const attemptRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const storageQueue = useRef(Promise.resolve());
  const callbackRef = useRef("");

  // Serialize storage writes: an older login must never overwrite a later logout.
  const persist = useCallback((operation) => {
    const next = storageQueue.current.catch(() => {}).then(operation);
    storageQueue.current = next;
    return next;
  }, []);
  const isCurrent = useCallback((attempt) => mountedRef.current && attemptRef.current === attempt, []);

  const clearAuthState = useCallback((message = "") => {
    attemptRef.current += 1;
    scopeRef.current?.invalidate();
    scopeRef.current = null;
    recoveryRef.current = null;
    busyRef.current = false;
    setSession(null);
    setStatus("signedOut");
    setSessionKey((key) => key + 1);
    setAuthMode("login");
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthLoading(false);
    setSocialLoading("");
    setUsage(null);
    setUsageLoaded(false);
    setUsageLoading(false);
    latest.current.clearMessages();
    if (message) latest.current.setNotice(message);
    return persist(() => AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_SESSION_EXPIRES_AT_KEY])).catch(() => {
      latest.current.setError(latest.current.copy.errors.sessionStorageFailed);
    });
  }, [persist]);

  const expireSession = useCallback(() => {
    clearAuthState(latest.current.copy.sessionExpiredNotice);
  }, [clearAuthState]);

  const hydrateWithToken = useCallback(async (token, attempt, hintSeconds = 0, hintExpiresAt = 0) => {
    if (!isCurrent(attempt)) throw sessionEndedError();
    const hints = [parseJwtExpMs(token), Number(hintExpiresAt), hintSeconds > 0 ? Date.now() + hintSeconds * 1000 : 0].filter((n) => n > 0);
    const expiresAt = hints.length ? Math.min(...hints) : 0;
    if (!expiresAt || expiresAt <= Date.now()) throw new Error(latest.current.copy.sessionExpiredNotice);
    const data = await requestApiWithTimeoutRetry("/api/auth/me", { token, timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
    if (!isCurrent(attempt)) throw sessionEndedError();
    if (!data?.user?.id) throw new Error(latest.current.copy.errors.socialSessionFailed);
    if (expiresAt <= Date.now()) throw new Error(latest.current.copy.sessionExpiredNotice);
    await persist(() => AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, token], [AUTH_SESSION_EXPIRES_AT_KEY, String(expiresAt)],
    ]));
    if (!isCurrent(attempt)) throw sessionEndedError();
    const scope = createSessionScope({ token, expiresAt, onExpired: expireSession });
    scopeRef.current = scope;
    setSession({ token, user: data.user, expiresAt, scope });
    setSessionNowMs(Date.now());
    setSessionKey((key) => key + 1);
    setStatus("authenticated");
    setAuthPassword("");
    latest.current.setError("");
  }, [expireSession, isCurrent, persist]);

  const handleDeepLink = useCallback(async (url) => {
    const params = parseAuthParamsFromUrl(url);
    if (!params.accessToken && !params.oauthError && !params.isRecovery) return false;
    // Linking and openAuthSessionAsync may deliver the same callback twice.
    if (callbackRef.current === url) return true;
    callbackRef.current = url;
    const cleared = clearAuthState();
    const attempt = attemptRef.current;
    await cleared;
    if (!isCurrent(attempt)) return true;
    if (params.isRecovery) {
      recoveryRef.current = params.accessToken ? {
        token: params.accessToken,
        expiresAt: parseJwtExpMs(params.accessToken) || (params.expiresInSeconds > 0 ? Date.now() + params.expiresInSeconds * 1000 : 0),
      } : null;
      setAuthMode(params.accessToken ? "recovery" : "resetRequest");
      setStatus("recovery");
      if (params.oauthError) latest.current.setError(params.oauthError);
      else latest.current.setNotice(params.accessToken ? latest.current.copy.recoveryReady : latest.current.copy.recoveryRequestHint);
      return true;
    }
    if (params.oauthError) {
      latest.current.setError(params.oauthError);
      return true;
    }
    setStatus("verifying");
    try {
      await hydrateWithToken(params.accessToken, attempt, params.expiresInSeconds);
      if (isCurrent(attempt)) latest.current.setNotice(latest.current.copy.notices.socialLoginDone);
    } catch (error) {
      if (isCurrent(attempt)) {
        await clearAuthState();
        latest.current.setError(error.message || latest.current.copy.errors.socialSessionFailed);
      }
    }
    return true;
  }, [clearAuthState, hydrateWithToken, isCurrent]);

  useEffect(() => {
    mountedRef.current = true;
    const attempt = attemptRef.current;
    const listener = Linking.addEventListener("url", ({ url }) => { handleDeepLink(url).catch(() => {}); });
    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (!isCurrent(attempt)) return;
        if (initialUrl && await handleDeepLink(initialUrl)) return;
        const entries = await AsyncStorage.multiGet([AUTH_TOKEN_KEY, AUTH_SESSION_EXPIRES_AT_KEY]);
        if (!isCurrent(attempt)) return;
        const token = entries[0][1];
        if (token) await hydrateWithToken(token, attempt, 0, Number(entries[1][1]));
        else setStatus("signedOut");
      } catch (error) {
        if (isCurrent(attempt)) {
          await clearAuthState();
          latest.current.setError(error.message || latest.current.copy.errors.socialSessionFailed);
        }
      }
    })();
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      scopeRef.current?.invalidate();
      listener.remove();
    };
  }, [clearAuthState, handleDeepLink, hydrateWithToken, isCurrent]);

  useEffect(() => {
    if (!session) return undefined;
    const check = () => {
      if (session.scope.isActive()) setSessionNowMs(Date.now());
    };
    const timer = setInterval(check, 1000);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !session.scope.isActive()) return;
      check();
      session.scope.request(requestApi, "/api/auth/me").catch(() => {});
    });
    return () => { clearInterval(timer); foreground.remove(); };
  }, [session]);

  const fetchUsage = useCallback(async (token = scopeRef.current?.token, { quiet = false } = {}) => {
    const scope = scopeRef.current;
    if (!scope?.isActive() || token !== scope.token) return null;
    setUsageLoading(true);
    try {
      const data = await scope.request(requestApi, "/api/usage");
      setUsage(data);
      return data;
    } catch (error) {
      if (scope.isActive() && !quiet) latest.current.setError(error.message || latest.current.copy.errors.usageReadFailed);
      return null;
    } finally {
      if (scope.isActive()) { setUsageLoaded(true); setUsageLoading(false); }
    }
  }, []);

  const handleAuthSubmit = useCallback(async () => {
    if (busyRef.current || !["login", "signup"].includes(authMode)) return;
    clearMessages();
    if (!authEmail.trim() || !authPassword) { setError(copy.errors.authInputRequired); return; }
    if (authMode === "signup" && authPassword.length < 8) { setError(copy.errors.passwordMin); return; }
    busyRef.current = true;
    const attempt = ++attemptRef.current;
    setAuthLoading(true);
    try {
      const body = new FormData();
      body.append("email", authEmail.trim());
      body.append("password", authPassword);
      if (authMode === "signup" && authName.trim()) body.append("full_name", authName.trim());
      const data = await requestApiWithTimeoutRetry(authMode === "signup" ? "/api/auth/signup" : "/api/auth/login", { method: "POST", body, timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
      if (!isCurrent(attempt)) return;
      if (data?.access_token) {
        setStatus("verifying");
        await hydrateWithToken(data.access_token, attempt, Number(data.expires_in) || 0);
        if (isCurrent(attempt)) setNotice(authMode === "signup" ? copy.notices.authDoneSignup : copy.notices.authDoneLogin);
      } else {
        setNotice(data?.message || copy.notices.signupDone);
      }
      if (isCurrent(attempt)) { setAuthPassword(""); setAuthMode("login"); }
    } catch (error) {
      if (isCurrent(attempt)) {
        await clearAuthState();
        setError(getFriendlyAuthError(error.message, copy));
      }
    } finally {
      if (isCurrent(attempt)) { busyRef.current = false; setAuthLoading(false); }
    }
  }, [authEmail, authMode, authName, authPassword, clearAuthState, clearMessages, copy, hydrateWithToken, isCurrent, setError, setNotice]);

  const handlePasswordResetRequest = useCallback(async () => {
    if (busyRef.current) return;
    clearMessages();
    if (!authEmail.trim()) { setError(copy.errors.recoveryEmailRequired); return; }
    const attempt = ++attemptRef.current;
    busyRef.current = true;
    setAuthLoading(true);
    try {
      const body = new FormData();
      body.append("email", authEmail.trim());
      body.append("redirect_to", language === "en" ? SITE_URL + "/en/recover" : SITE_URL + "/recover");
      await requestApiWithTimeoutRetry("/api/auth/password-reset/request", { method: "POST", body, timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
      if (isCurrent(attempt)) setNotice(copy.notices.passwordResetRequested);
    } catch (error) {
      if (isCurrent(attempt)) setError(error.message || copy.errors.passwordResetFailed);
    } finally {
      if (isCurrent(attempt)) { busyRef.current = false; setAuthLoading(false); }
    }
  }, [authEmail, clearMessages, copy, isCurrent, language, setError, setNotice]);

  const handlePasswordRecovery = useCallback(async () => {
    if (busyRef.current) return;
    clearMessages();
    const recovery = recoveryRef.current;
    if (!recovery?.token || !recovery.expiresAt || recovery.expiresAt <= Date.now()) {
      recoveryRef.current = null;
      setAuthMode("resetRequest");
      setError(copy.sessionExpiredNotice);
      return;
    }
    if (authPassword.length < 8) { setError(copy.errors.passwordMin); return; }
    if (authPassword !== authPasswordConfirm) { setError(copy.passwordMismatch); return; }
    const attempt = ++attemptRef.current;
    busyRef.current = true;
    setAuthLoading(true);
    try {
      const body = new FormData();
      body.append("new_password", authPassword);
      await requestApi("/api/auth/password-reset/confirm", { method: "POST", token: recovery.token, body, timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
      // Recovery credentials never become a workspace session, even if the API returns a token.
      if (isCurrent(attempt)) await clearAuthState(copy.recoveryComplete);
    } catch (error) {
      if (isCurrent(attempt)) setError(error.message || copy.errors.passwordResetFailed);
    } finally {
      if (isCurrent(attempt)) { busyRef.current = false; setAuthLoading(false); }
    }
  }, [authPassword, authPasswordConfirm, clearAuthState, clearMessages, copy, isCurrent, setError]);

  const changeAuthMode = useCallback((mode) => {
    if (busyRef.current) return;
    recoveryRef.current = null;
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthMode(mode);
    setStatus("signedOut");
    clearMessages();
  }, [clearMessages]);

  const handleSocialLogin = useCallback(async (provider) => {
    if (busyRef.current || !["login", "signup"].includes(authMode)) return;
    clearMessages();
    const attempt = ++attemptRef.current;
    busyRef.current = true;
    setSocialLoading(provider);
    callbackRef.current = "";
    try {
      if (provider === "apple" && Platform.OS === "ios") {
        if (!(await AppleAuthentication.isAvailableAsync())) throw new Error(copy.errors.socialStartFailed);
        if (!isCurrent(attempt)) return;
        const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
        if (!isCurrent(attempt)) return;
        if (!credential?.identityToken) throw new Error(copy.errors.socialSessionFailed);
        const fullName = credential.fullName || {};
        const data = await requestApiWithTimeoutRetry("/api/auth/apple", {
          method: "POST", timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
          body: JSON.stringify({ identity_token: credential.identityToken, authorization_code: credential.authorizationCode || "", user_identifier: credential.user || "", email: credential.email || "", full_name: [fullName.givenName, fullName.middleName, fullName.familyName].filter(Boolean).join(" ") }),
        });
        if (!isCurrent(attempt)) return;
        setStatus("verifying");
        await hydrateWithToken(data?.access_token, attempt, Number(data?.expires_in) || 0);
        if (isCurrent(attempt)) setNotice(copy.notices.socialLoginDone);
        return;
      }
      const redirectTo = ExpoLinking.createURL("auth-callback");
      let oauthUrl = "";
      try {
        const data = await requestApiWithTimeoutRetry("/api/auth/oauth-url?provider=" + encodeURIComponent(provider) + "&redirect_to=" + encodeURIComponent(redirectTo), { timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
        oauthUrl = data?.auth_url || "";
      } catch (error) {
        const fallback = buildDirectOauthUrl(provider, redirectTo);
        if (fallback && (isTimeoutErrorMessage(error.message) || isNetworkFetchError(error))) oauthUrl = fallback;
        else throw error;
      }
      if (!isCurrent(attempt)) return;
      if (!oauthUrl) throw new Error(copy.errors.oauthUrlCreate);
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectTo, { preferEphemeralSession: false });
      if (isCurrent(attempt) && result?.type === "success" && result.url) await handleDeepLink(result.url);
    } catch (error) {
      if (isCurrent(attempt) && error?.code !== "ERR_REQUEST_CANCELED") {
        await clearAuthState();
        const message = error.message || copy.errors.socialStartFailed;
        setError(shouldShowOauthConfigHint(message) ? message + "\n(Config check: OAuth redirect allowlist)" : message);
      }
    } finally {
      if (isCurrent(attempt)) { busyRef.current = false; setSocialLoading(""); }
    }
  }, [authMode, clearAuthState, clearMessages, copy, handleDeepLink, hydrateWithToken, isCurrent, setError, setNotice]);

  const handleDeleteAccount = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope?.isActive() || busyRef.current) return;
    busyRef.current = true;
    setAuthLoading(true);
    try {
      await scope.request(requestApi, "/api/auth/account", { method: "DELETE", timeoutMs: AUTH_REQUEST_TIMEOUT_MS });
      await clearAuthState(latest.current.copy.notices.accountDeleted);
    } catch (error) {
      if (scope.isActive()) latest.current.setError(error.message || latest.current.copy.errors.accountDeleteFailed);
    } finally {
      if (scope.isActive()) { busyRef.current = false; setAuthLoading(false); }
    }
  }, [clearAuthState]);

  const handleOpenOurs = useCallback(async () => {
    try { await Linking.openURL(OURS_URL); }
    catch (error) { setError(error.message || copy.errors.openExternalFailed); }
  }, [copy.errors.openExternalFailed, setError]);

  return {
    status, sessionKey, sessionScope: session?.scope || null,
    bootLoading: status === "restoring" || status === "verifying",
    authMode, setAuthMode: changeAuthMode, authName, setAuthName, authEmail, setAuthEmail,
    authPassword, setAuthPassword, authPasswordConfirm, setAuthPasswordConfirm, authLoading, socialLoading,
    authToken: session?.token || "", authUser: session?.user || null,
    isLoggedIn: status === "authenticated" && Boolean(session),
    sessionExpiresAtMs: session?.expiresAt || 0,
    sessionRemainingLabel: session ? formatSecondsToHourMinuteSecond(Math.max(0, Math.floor((session.expiresAt - sessionNowMs) / 1000))) : copy.sessionChecking,
    usage, usageLoading, usageLoaded, fetchUsage, handleAuthSubmit, handlePasswordResetRequest,
    handlePasswordRecovery, handleSocialLogin, handleDeleteAccount, handleOpenOurs, clearAuthState,
    handleLogout: () => clearAuthState(copy.notices.loggedOut),
  };
}
