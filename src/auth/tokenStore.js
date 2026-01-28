const KEY = "ragnarok_user_token";

export function getToken() {
  return sessionStorage.getItem(KEY) || "";
}

export function setToken(token) {
  sessionStorage.setItem(KEY, (token || "").trim());
}

export function clearToken() {
  sessionStorage.removeItem(KEY);
}
