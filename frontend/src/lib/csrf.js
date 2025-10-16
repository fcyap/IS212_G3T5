// Centralized CSRF token management
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let cachedToken = null;
let tokenExpiry = null;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches a CSRF token from the backend
 * @returns {Promise<string>} The CSRF token
 */
export async function getCsrfToken({ forceRefresh = false } = {}) {
  // Return cached token if still valid
  if (!forceRefresh && cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/csrf-token`, {
      method: "GET",
      credentials: "include", // Send cookies with the request
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache the token
    cachedToken = data.csrfToken;
    tokenExpiry = Date.now() + TOKEN_CACHE_DURATION;

    return cachedToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}

/**
 * Clears the cached CSRF token (useful after logout or on token errors)
 */
export function clearCsrfToken() {
  cachedToken = null;
  tokenExpiry = null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

function ensureHeaders(options = {}) {
  return {
    ...(options.headers || {}),
  };
}

/**
 * Wrapper around fetch that automatically attaches the current CSRF token,
 * retries once when the backend reports a token error, and always sends credentials.
 * Only non-safe HTTP verbs will receive the CSRF header.
 */
export async function fetchWithCsrf(input, init = {}, { retryOnForbidden = true } = {}) {
  const opts = {
    credentials: 'include',
    ...init,
  };

  const method = (opts.method || 'GET').toUpperCase();
  const needsCsrf = !SAFE_METHODS.has(method);

  if (needsCsrf) {
    const token = await getCsrfToken();
    opts.headers = {
      ...ensureHeaders(opts),
      'x-csrf-token': token,
    };
  } else if (opts.headers) {
    opts.headers = ensureHeaders(opts);
  }

  let response = await fetch(input, opts);

  if (needsCsrf && retryOnForbidden && response.status === 403) {
    // Token could be stale. Clear the cache, fetch a fresh token, then retry once.
    clearCsrfToken();
    const freshToken = await getCsrfToken({ forceRefresh: true });
    const retryOpts = {
      ...opts,
      headers: {
        ...ensureHeaders(opts),
        'x-csrf-token': freshToken,
      },
    };
    response = await fetch(input, retryOpts);
  }

  return response;
}
