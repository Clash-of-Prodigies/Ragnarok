import { getToken } from "../auth/tokenStore";
import { normalizeErrorMessage } from "./errors";

const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, init) {
  if (!BASE) throw new Error("VITE_RAGNAROK_BASE_URL is not set");

  const token = getToken();
  const headers = {
    Accept: "application/json",
    ...(init?.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, normalizeErrorMessage(body), body);
  }
  return body;
}

export const api = {
  listMatches: () => request("/matches"),
  getMatch: (matchId) => request(`/matches/${encodeURIComponent(matchId)}`),

  getCurrentQuestion: (matchId) =>
    request(`/matches/${encodeURIComponent(matchId)}/current-question`),

  submitAnswer: (matchId, selectedOption) =>
    request(`/matches/${encodeURIComponent(matchId)}`, {
      method: "POST",
      body: JSON.stringify({ selected_option: selectedOption }),
    }),

  verifyAnswers: (matchId, questionId) =>
    request(
      `/matches/${encodeURIComponent(matchId)}/verify-answers?id=${encodeURIComponent(questionId)}`
    ),
};
