// src/api.ts
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Non-JSON response: " + text);
  }
}
