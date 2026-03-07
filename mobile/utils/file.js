import { MIME_BY_EXT } from "../config";

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

export {
  normalizeMimeType,
  getExtension,
  inferMimeFromAsset,
};
