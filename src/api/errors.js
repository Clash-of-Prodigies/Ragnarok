export function extractTryAgainAt(text) {
  const s = (text || "").trim();
  const m = /Try again at (.+)$/.exec(s);
  return m?.[1]?.trim() || null;
}

export function normalizeErrorMessage(body) {
  if (!body) return "Unknown error";
  if (typeof body === "string") return body;
  return body.error || body.message || JSON.stringify(body);
}
