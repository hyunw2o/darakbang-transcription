import { API_FALLBACK_URLS, API_URL } from "../config";

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
  if (normalized.includes("timeout")) {
    return authErrors.timeout;
  }
  return raw || authErrors.default || "Authentication failed";
}

async function requestApi(
  path,
  { method = "GET", token = "", body = undefined, timeoutMs = 20000, headers: customHeaders = {} } = {}
) {
  const headers = { ...customHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const baseCandidates = [API_URL, ...API_FALLBACK_URLS]
    .filter(Boolean)
    .filter((value, idx, arr) => arr.indexOf(value) === idx);

  let lastError = null;

  for (let idx = 0; idx < baseCandidates.length; idx += 1) {
    const baseUrl = baseCandidates[idx];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
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
    } catch (error) {
      lastError = error;
      const isTimeout = error?.name === "AbortError" || isTimeoutErrorMessage(error?.message);
      const canFallback = idx < baseCandidates.length - 1 && (isTimeout || isNetworkFetchError(error));
      if (!canFallback) {
        if (isTimeout) {
          throw new Error("Request timed out. Please check server status.");
        }
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError?.name === "AbortError" || isTimeoutErrorMessage(lastError?.message)) {
    throw new Error("Request timed out. Please check server status.");
  }
  throw lastError || new Error("Request failed.");
}

async function requestApiWithTimeoutRetry(path, options = {}, retryDelayMs = 1200) {
  const initialTimeoutMs = Math.max(10000, Number(options?.timeoutMs) || 20000);
  try {
    return await requestApi(path, { ...options, timeoutMs: initialTimeoutMs });
  } catch (error) {
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
};
