/**
 * Tab-Isolated Authentication Utilities
 * Manages unique tab identifiers and tab-scoped storage keys for UrPlaced.
 * Ensures that multiple tabs within the same browser origin maintain strictly
 * independent authentication sessions without cross-tab session contamination.
 */

const TAB_ID_KEY = "urplaced_tab_id";
const TAB_AUTH_PREFIX = "urplaced_auth_";

/**
 * Returns a persistent, unique identifier for the current browser tab.
 * Uses window.sessionStorage which is isolated to this specific tab lifecycle.
 */
export function getTabId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    let tabId = window.sessionStorage.getItem(TAB_ID_KEY);
    if (!tabId) {
      tabId = "tab_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
      window.sessionStorage.setItem(TAB_ID_KEY, tabId);
    }
    return tabId;
  } catch {
    return "tab_fallback";
  }
}

/**
 * Returns the tab-scoped storage key for Supabase Auth session persistence.
 */
export function getTabStorageKey(tabId?: string): string {
  const id = tabId || getTabId();
  return `${TAB_AUTH_PREFIX}${id}`;
}

/**
 * Tab-scoped storage adapter for Supabase Client.
 * Backed by window.sessionStorage so sessions are completely isolated per tab.
 */
export const tabSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Storage quota or security exception fallback
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage exception fallback
    }
  },
};
