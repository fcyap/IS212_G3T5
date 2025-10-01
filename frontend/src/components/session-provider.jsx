"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SessionCtx = createContext(null);

export function SessionProvider({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, user: null, role: null });

  // Development mode - set to false to use real backend authentication
  const DEV_MODE = false;

  const load = async () => {
    if (DEV_MODE) {
      // Mock user data for development
      setTimeout(() => {
        setState({
          loading: false,
          user: { id: 1, name: "Dev User", email: "dev@example.com" },
          role: { id: 1, label: "Developer", name: "developer" }
        });
      }, 1000); // Simulate loading time
      return;
    }

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/auth/me", {
        credentials: "include",
      });
      if (res.status === 401) {
        setState({ loading: false, user: null, role: null });
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setState({ loading: false, user: data.user, role: data.role });
    } catch {
      setState({ loading: false, user: null, role: null });
      router.replace("/login");
    }
  };

  useEffect(() => {
    load();
    // keep-alive ping every 5 minutes (resets idle timer while active)
    if (!DEV_MODE) {
      const id = setInterval(load, 5 * 60 * 1000);
      return () => clearInterval(id);
    }
  }, []);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1d]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">{DEV_MODE ? 'Loading (Dev Mode)...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }
  return <SessionCtx.Provider value={state}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}
