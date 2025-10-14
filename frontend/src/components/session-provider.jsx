"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SessionCtx = createContext(null);

const STORAGE_KEY = 'session.profile';

function readCachedProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn('[SessionProvider] Failed to read cached profile', err);
    return null;
  }
}

function writeCachedProfile(profile) {
  if (typeof window === 'undefined') return;
  try {
    if (!profile) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn('[SessionProvider] Failed to write cached profile', err);
  }
}

export function SessionProvider({ children }) {
  const router = useRouter();
  const cachedProfile = useMemo(() => readCachedProfile(), []);
  const [state, setState] = useState({
    loading: true,
    user: null,
    role: null,
  });

  // Development mode can be toggled through env, default off
  const DEV_MODE = String(process.env.NEXT_PUBLIC_DEV_MODE ?? '').toLowerCase() === 'true';

  const load = async (reason = 'manual') => {
    console.info('[SessionProvider] load triggered', { reason, devMode: DEV_MODE });
    if (DEV_MODE) {
      // Mock user data for development
      setTimeout(() => {
        const devState = {
          loading: false,
          user: { id: 1, name: "Dev User", email: "dev@example.com" },
          role: { id: 1, label: "Developer", name: "developer" }
        };
        console.info('[SessionProvider] Dev mode login:', devState.user, 'reason:', reason);
        writeCachedProfile({ user: devState.user, role: devState.role });
        setState(devState);
      }, 1000); // Simulate loading time
      return;
    }

    try {
      if (!(cachedProfile && reason === 'initial')) {
        setState(prev => ({ ...prev, loading: true }));
      }
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/auth/me", {
        credentials: "include",
      });
      if (res.status === 401) {
        console.warn('[SessionProvider] Session expired (401). Logging out.', { reason });
        setState({ loading: false, user: null, role: null });
        writeCachedProfile(null);
        router.replace("/login");
        return;
      }
      const data = await res.json();
      console.info('[SessionProvider] Authenticated user fetched from API:', data.user, { reason });
      writeCachedProfile({ user: data.user, role: data.role, expiresAt: data.expiresAt ?? null });
      setState({ loading: false, user: data.user, role: data.role });
    } catch (err) {
      console.error('[SessionProvider] Failed to refresh session.', { reason, error: err });
      const fallback = readCachedProfile();
      if (fallback?.user) {
        console.info('[SessionProvider] Falling back to cached user after refresh failure');
        setState({ loading: false, user: fallback.user, role: fallback.role ?? null });
      } else {
        setState({ loading: false, user: null, role: null });
      }
    }
  };

  useEffect(() => {
    if (cachedProfile) {
      setState({ loading: false, user: cachedProfile.user ?? null, role: cachedProfile.role ?? null });
      console.info('[SessionProvider] Loaded user from localStorage:', cachedProfile.user, {
        role: cachedProfile.role,
      });
    }
    load('initial');
    // keep-alive ping every 5 minutes (resets idle timer while active)
    if (!DEV_MODE) {
      const id = setInterval(() => load('keepalive'), 5 * 60 * 1000);
      return () => clearInterval(id);
    }
  }, []);

  useEffect(() => {
    if (state.loading) return;
    console.info('[SessionProvider] Session state updated', {
      user: state.user,
      role: state.role,
    });
    writeCachedProfile(
      state.user
        ? { user: state.user, role: state.role }
        : null
    );
  }, [state.loading, state.user, state.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSessionLogin = (event) => {
      const payload = event.detail;
      if (!payload || !payload.user) return;
      writeCachedProfile(payload);
      setState({ loading: false, user: payload.user, role: payload.role ?? null });
    };
    window.addEventListener('session:login', handleSessionLogin);
    return () => window.removeEventListener('session:login', handleSessionLogin);
  }, []);

  const contextValue = useMemo(() => state, [state.loading, state.user, state.role]);

 return <SessionCtx.Provider value={contextValue}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
