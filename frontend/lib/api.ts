/**
 * Unified API Client for TrailWeave Backend
 * Interacts with FastAPI endpoints configured in docs/API_SPEC.md.
 */

const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawBase.replace(/\/+$/, "").endsWith("/api/v1")
  ? rawBase.replace(/\/+$/, "")
  : `${rawBase.replace(/\/+$/, "")}/api/v1`;

export async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorDetail = "API request failed";
    try {
      const err = await res.json();
      errorDetail = err.detail || JSON.stringify(err);
    } catch {
      errorDetail = res.statusText;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}
