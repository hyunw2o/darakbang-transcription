import { SUPABASE_URL } from "../config";

function parseAuthParamsFromUrl(url) {
  if (!url) return { accessToken: "", oauthError: "", expiresInSeconds: 0 };

  const parts = url.split("#");
  const beforeHash = parts[0] || "";
  const hash = parts[1] || "";
  const query = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";

  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  const accessToken = hashParams.get("access_token") || queryParams.get("access_token") || "";
  const oauthError =
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error_description") ||
    queryParams.get("error") ||
    "";
  const expiresInRaw = hashParams.get("expires_in") || queryParams.get("expires_in") || "";
  const expiresInSeconds = Math.max(0, parseInt(expiresInRaw, 10) || 0);

  return { accessToken, oauthError, expiresInSeconds };
}

function buildDirectOauthUrl(provider, redirectTo) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (!SUPABASE_URL || !redirectTo || !["google", "kakao", "apple"].includes(normalizedProvider)) {
    return "";
  }
  const query = new URLSearchParams({
    provider: normalizedProvider,
    redirect_to: redirectTo,
  });
  return `${SUPABASE_URL}/auth/v1/authorize?${query.toString()}`;
}

function shouldShowOauthConfigHint(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("redirect_to") ||
    normalized.includes("redirect uri") ||
    normalized.includes("redirect_uri") ||
    normalized.includes("redirect url") ||
    normalized.includes("허용되지 않은 redirect") ||
    normalized.includes("지원하지 않는 소셜 로그인") ||
    normalized.includes("koe205") ||
    normalized.includes("koe206")
  );
}

function buildOauthFallbackUser() {
  return {
    id: "oauth_user",
    email: "",
    user_metadata: {},
  };
}

function parseJwtExpMs(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

    let decodedText = "";
    if (typeof globalThis?.atob === "function") {
      decodedText = globalThis.atob(padded);
    } else if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
      decodedText = Buffer.from(padded, "base64").toString("utf-8");
    } else {
      return 0;
    }

    const parsed = JSON.parse(decodedText);
    const exp = Number(parsed?.exp) || 0;
    if (!exp) return 0;
    return exp * 1000;
  } catch {
    return 0;
  }
}

export {
  parseAuthParamsFromUrl,
  buildDirectOauthUrl,
  shouldShowOauthConfigHint,
  buildOauthFallbackUser,
  parseJwtExpMs,
};
