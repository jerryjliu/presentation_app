/**
 * Session management for frontend persistence.
 */

import type { SessionState } from "@/types";

const STORAGE_KEY_PREFIX = "presentation_app_";

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get session ID from URL query parameter.
 */
export function getSessionFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("session");
}

/**
 * Set session ID in URL without page reload.
 */
export function setSessionInUrl(sessionId: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState({}, "", url.toString());
}

/**
 * Save session state to localStorage.
 */
export function saveSessionToStorage(state: SessionState): void {
  if (typeof window === "undefined") return;

  const key = `${STORAGE_KEY_PREFIX}${state.userSessionId}`;
  const data = {
    userSessionId: state.userSessionId,
    agentSessionId: state.agentSessionId,
    messages: state.messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
      agentLog: msg.agentLog?.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
    })),
    // Don't save presentation - fetch from backend
  };

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save session to storage:", e);
  }
}

/**
 * Load session state from localStorage.
 */
export function loadSessionFromStorage(
  userSessionId: string
): Partial<SessionState> | null {
  if (typeof window === "undefined") return null;

  const key = `${STORAGE_KEY_PREFIX}${userSessionId}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      userSessionId: parsed.userSessionId,
      agentSessionId: parsed.agentSessionId,
      messages: parsed.messages.map(
        (msg: { timestamp: string; agentLog?: { timestamp: string }[] }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          agentLog: msg.agentLog?.map(
            (log: { timestamp: string }) => ({
              ...log,
              timestamp: new Date(log.timestamp),
            })
          ),
        })
      ),
    };
  } catch (e) {
    console.error("Failed to load session from storage:", e);
    return null;
  }
}

/**
 * Clear session from localStorage.
 */
export function clearSessionFromStorage(userSessionId: string): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_KEY_PREFIX}${userSessionId}`;
  localStorage.removeItem(key);
}

/**
 * Get all session IDs from localStorage.
 */
export function getAllStoredSessionIds(): string[] {
  if (typeof window === "undefined") return [];

  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      ids.push(key.replace(STORAGE_KEY_PREFIX, ""));
    }
  }
  return ids;
}
