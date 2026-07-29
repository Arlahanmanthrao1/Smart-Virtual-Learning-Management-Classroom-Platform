const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("lms_token");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error("Incorrect email or password");
  }
  return res.json();
}

export async function register(payload) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail);
  }
  return res.json();
}