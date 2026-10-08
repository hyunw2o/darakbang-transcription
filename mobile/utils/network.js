import { Platform } from "react-native";
import { API_FALLBACK_URLS, API_URL } from "../config";
import { sessionEndedError } from "./session";

function assertNotAborted(signal) {
  if (signal?.aborted) throw sessionEndedError();
}

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
  const authErrors = copy?.authErrors || {};

  if (normalized.includes("invalid login credentials")) {
    return authErrors.invalidCredentials;
  }
  if (normalized.includes("email not confirmed")) {
    return authErrors.emailNotConfirmed;
  }
  if (isTimeoutErrorMessage(normalized)) {
    return authErrors.timeout;
  }
  return raw || authErrors.default || "Authentication failed";
}

async function requestApi(
  path,
  {
    method = "GET",
    token = "",
    body = undefined,
    bodyFactory = null,
    timeoutMs = 20000,
    headers: customHeaders = {},
    signal,
    totalTimeoutMs = 0,
    baseUrl: selectedBaseUrl = "",
  } = {}
) {
  const headers = { ...customHeaders };
  headers["X-Mallog24-Client-Platform"] = Platform.OS;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const baseCandidates = [API_URL, ...API_FALLBACK_URLS]
    .filter(Boolean)
    .filter((value, idx, arr) => arr.indexOf(value) === idx)
    .filter(value => !selectedBaseUrl || value === selectedBaseUrl);
  if (!baseCandidates.length) throw new Error("Unknown API server.");

  let lastError = null;
  const deadline = totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : 0;

  for (let idx = 0; idx < baseCandidates.length; idx += 1) {
    assertNotAborted(signal);
    const remainingMs = deadline ? deadline - Date.now() : timeoutMs;
    if (remainingMs <= 0) throw new Error("Request timed out. Please check server status.");
    const baseUrl = baseCandidates[idx];
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(timeoutMs, remainingMs));
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: typeof bodyFactory === "function" ? bodyFactory() : body,
        signal: controller.signal,
      });

      const rawText = await response.text();
      assertNotAborted(signal);
      if (timedOut || (deadline && Date.now() >= deadline)) throw new Error("Request timed out. Please check server status.");
      const data = parseResponseText(rawText);

      if (!response.ok) {
        const requestError = new Error(data?.detail || data?.message || `Request failed (${response.status})`);
        requestError.status = response.status;
        const retryAfter = Number(response.headers?.get?.("retry-after"));
        requestError.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(30000, retryAfter * 1000) : 0;
        throw requestError;
      }

      return data;
    } catch (error) {
      assertNotAborted(signal);
      lastError = error;
      const isTimeout = timedOut || error?.name === "AbortError" || isTimeoutErrorMessage(error?.message);
      const canFallback = idx < baseCandidates.length - 1 && (isTimeout || isNetworkFetchError(error));
      if (!canFallback) {
        if (isTimeout) {
          throw new Error("Request timed out. Please check server status.");
        }
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    }
  }

  if (lastError?.name === "AbortError" || isTimeoutErrorMessage(lastError?.message)) {
    throw new Error("Request timed out. Please check server status.");
  }
  throw lastError || new Error("Request failed.");
}

// Only public readiness checks are retried. The caller sends credentials once
// to the server that actually answered, avoiding duplicate login sessions.
async function waitForAuthServer({ signal, timeoutMs = 90000, attemptTimeoutMs = 15000, retryDelayMs = 1000 } = {}) {
  const bases = [API_URL, ...API_FALLBACK_URLS].filter(Boolean).filter((value, idx, arr) => arr.indexOf(value) === idx);
  if (!bases.length) throw new Error("Unknown API server.");
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    assertNotAborted(signal);
    const requestBudget = deadline - Date.now();
    if (requestBudget <= 0) break;
    const baseUrl = bases[attempt++ % bases.length];
    let retryAfterMs = retryDelayMs;
    try {
      const data = await requestApi("/health", {
        baseUrl, signal, timeoutMs: Math.min(attemptTimeoutMs, requestBudget),
        totalTimeoutMs: requestBudget,
      });
      assertNotAborted(signal);
      if (data?.status !== "healthy") throw new Error("Server is not ready.");
      return baseUrl;
    } catch (error) {
      assertNotAborted(signal);
      const retryable = isTimeoutErrorMessage(error.message) || isNetworkFetchError(error)
        || [408, 425, 429, 500, 502, 503, 504].includes(Number(error.status));
      if (!retryable) throw error;
      retryAfterMs = error.retryAfterMs || retryDelayMs;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(sessionEndedError()); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, Math.min(retryAfterMs, remaining));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  assertNotAborted(signal);
  throw new Error("Server startup timed out.");
}

async function requestApiWithNetworkRetry(
  path,
  options = {},
  { maxAttempts = 3, retryDelayMs = 1500, onRetry } = {}
) {
  const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
  const attempts = Math.max(1, Number(maxAttempts) || 1);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    assertNotAborted(options.signal);
    try {
      return await requestApi(path, options);
    } catch (error) {
      assertNotAborted(options.signal);
      lastError = error;
      const retryable = (
        isTimeoutErrorMessage(error?.message || "") ||
        isNetworkFetchError(error) ||
        retryableStatuses.has(Number(error?.status))
      );
      if (!retryable || attempt >= attempts) {
        throw error;
      }

      onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, error });
      const delay = Math.min(10000, retryDelayMs * (2 ** Math.max(0, attempt - 1)));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Request failed.");
}

async function requestApiWithTimeoutRetry(path, options = {}, retryDelayMs = 1200) {
  const initialTimeoutMs = Math.max(10000, Number(options?.timeoutMs) || 20000);
  try {
    return await requestApi(path, { ...options, timeoutMs: initialTimeoutMs });
  } catch (error) {
    assertNotAborted(options.signal);
    const retryable = isTimeoutErrorMessage(error?.message || "") || isNetworkFetchError(error);
    if (!retryable) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    const retryTimeoutMs = Math.max(initialTimeoutMs, Math.round(initialTimeoutMs * 1.5));
    return requestApi(path, { ...options, timeoutMs: retryTimeoutMs });
  }
}

export {
  parseResponseText,
  isTimeoutErrorMessage,
  isNetworkFetchError,
  getFriendlyAuthError,
  requestApi,
  requestApiWithTimeoutRetry,
  requestApiWithNetworkRetry,
  waitForAuthServer,
};
