// Centralized CSRF token management
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let cachedToken = null;
let tokenExpiry = null;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches a CSRF token from the backend
 * @returns {Promise<string>} The CSRF token
 */
export async function getCsrfToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
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
