import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";
import * as ExpoLinking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTH_REQUEST_TIMEOUT_MS,
  AUTH_SESSION_EXPIRES_AT_KEY,
  AUTH_TOKEN_KEY,
  FREE_MONTHLY_LIMIT_SECONDS,
  OURS_URL,
  PRICING_URL,
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
  const [billingStatus, setBillingStatus] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState("");

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

  const fetchBillingStatus = useCallback(async (token = authToken, { quiet = false } = {}) => {
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
    } catch (error) {
      if (!quiet) {
        setError(error.message || copy.errors.billingStatusReadFailed);
      }
      return null;
    } finally {
      setBillingLoading(false);
    }
  }, [authToken, copy.errors.billingStatusReadFailed, setError]);

  const refreshUsageAndBilling = useCallback(async (token = authToken, { showNotice = false } = {}) => {
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
  }, [authToken, copy.errors.billingStatusReadFailed, copy.errors.usageReadFailed, copy.notices.usageLoaded, fetchBillingStatus, fetchUsage, setError, setNotice]);

  const clearAuthState = useCallback(async (message = "") => {
    setAuthToken("");
    setAuthUser(null);
    setSessionExpiresAtMs(0);
    setSessionNowMs(Date.now());
    setUsage(null);
    setBillingStatus(null);
    setBillingActionLoading("");
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
      subscription?.remove?.();
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

      const supported = await Linking.canOpenURL(oauthUrl);
      if (!supported) throw new Error(copy.errors.openLoginUrl);

      await Linking.openURL(oauthUrl);
      setSocialLoading("");
    } catch (error) {
      const rawMessage = error?.message || copy.errors.socialStartFailed;
      const withHint = shouldShowOauthConfigHint(rawMessage)
        ? `${rawMessage}\n(Config check required: backend OAUTH_REDIRECT_ALLOW_SCHEMES / Supabase Redirect URL, not a paid-plan issue)`
        : rawMessage;
      setError(withHint);
      setSocialLoading("");
    }
  }, [clearMessages, copy.errors.oauthUrlCreate, copy.errors.openLoginUrl, copy.errors.socialStartFailed, setError, socialLoading]);

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

  const handleOpenPricing = useCallback(async () => {
    try {
      await openExternalUrl(PRICING_URL, copy.errors.openExternalFailed);
    } catch (error) {
      setError(error.message || copy.errors.openExternalFailed);
    }
  }, [copy.errors.openExternalFailed, openExternalUrl, setError]);

  const handleOpenOurs = useCallback(async () => {
    try {
      await openExternalUrl(OURS_URL, copy.errors.openExternalFailed);
    } catch (error) {
      setError(error.message || copy.errors.openExternalFailed);
    }
  }, [copy.errors.openExternalFailed, openExternalUrl, setError]);

  const handleBillingCheckout = useCallback(async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    const billingCheckoutSupported = Boolean(billingStatus?.checkout_supported);
    if (!billingCheckoutSupported) {
      setNotice(copy.billingUnsupported);
      await handleOpenPricing();
      return;
    }

    setBillingActionLoading("checkout");
    try {
      const normalizedPricingBase = String(PRICING_URL || "").trim().replace(/\/+$/, "");
      const locale = language === "en" ? "en" : "ko";
      const localePricingPath = locale === "en" ? "pricing-en" : "pricing";
      const pricingPath = normalizedPricingBase.endsWith("/pricing") || normalizedPricingBase.endsWith("/pricing-en")
        ? normalizedPricingBase
        : `${normalizedPricingBase}/${localePricingPath}`;
      const successUrl = `${pricingPath}${pricingPath.includes("?") ? "&" : "?"}checkout=success`;
      const cancelUrl = `${pricingPath}${pricingPath.includes("?") ? "&" : "?"}checkout=cancel`;

      const data = await requestApi("/api/billing/checkout", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({
          locale,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });
      if (!data?.checkout_url) {
        throw new Error(copy.errors.billingCheckoutFailed);
      }
      await openExternalUrl(data.checkout_url, copy.errors.billingCheckoutFailed);
      setNotice(copy.notices.checkoutOpened);
      fetchBillingStatus(authToken, { quiet: true }).catch(() => {});
    } catch (error) {
      setError(error.message || copy.errors.billingCheckoutFailed);
    } finally {
      setBillingActionLoading("");
    }
  }, [authToken, billingStatus, clearMessages, copy, fetchBillingStatus, handleOpenPricing, isLoggedIn, language, openExternalUrl, setError, setNotice]);

  const handleBillingPortal = useCallback(async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    const billingPortalSupported = Boolean(billingStatus?.portal_supported);
    const billingManageSupported = Boolean(billingStatus?.can_manage_subscription);
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
      await openExternalUrl(data.portal_url, copy.errors.billingPortalFailed);
      setNotice(copy.notices.portalOpened);
    } catch (error) {
      setError(error.message || copy.errors.billingPortalFailed);
    } finally {
      setBillingActionLoading("");
    }
  }, [authToken, billingStatus, clearMessages, copy, isLoggedIn, openExternalUrl, setError, setNotice]);

  const handleBillingCancel = useCallback(async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    setBillingActionLoading("cancel");
    try {
      const data = await requestApi("/api/billing/cancel", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({
          immediate: false,
          reason: "user_requested_from_mobile_app",
        }),
      });
      setNotice(data?.message || copy.notices.subscriptionCancelDone);
      await fetchBillingStatus(authToken, { quiet: true });
      await fetchUsage(authToken, { quiet: true });
    } catch (error) {
      setError(error.message || copy.errors.billingCancelFailed);
    } finally {
      setBillingActionLoading("");
    }
  }, [authToken, clearMessages, copy, fetchBillingStatus, fetchUsage, isLoggedIn, setError, setNotice]);

  const handleBillingRefund = useCallback(async () => {
    clearMessages();
    if (!isLoggedIn) {
      setError(copy.errors.authRequired);
      return;
    }

    setBillingActionLoading("refund");
    try {
      const data = await requestApi("/api/billing/refund", {
        method: "POST",
        token: authToken,
        body: JSON.stringify({
          reason: "user_requested_from_mobile_app",
        }),
      });
      setNotice(data?.message || copy.notices.refundRequestDone);
      await fetchBillingStatus(authToken, { quiet: true });
      await fetchUsage(authToken, { quiet: true });
    } catch (error) {
      setError(error.message || copy.errors.billingRefundFailed);
    } finally {
      setBillingActionLoading("");
    }
  }, [authToken, clearMessages, copy, fetchBillingStatus, fetchUsage, isLoggedIn, setError, setNotice]);

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
    clearAuthState,
  };
}
