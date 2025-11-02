"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/csrf";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetchWithCsrf(`${API}/auth/supabase-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Login failed");
      }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'session.profile',
            JSON.stringify({ user: data.user, role: data.role, expiresAt: data.expiresAt ?? null })
          );
          window.dispatchEvent(
            new CustomEvent('session:login', {
              detail: { user: data.user, role: data.role, expiresAt: data.expiresAt ?? null },
            })
          );
        }
      } catch (err) {
        console.warn('[LoginPage] Failed to cache session profile', err);
      }
      router.push("/");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1d] text-white p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-[#232326] p-6 rounded-2xl shadow">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <div className="space-y-2">
          <label className="block text-sm">Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg bg-black/30 border border-white/10 p-2 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Password</label>
          <div className="flex gap-2">
            <input
              type={showPw ? "text" : "password"}
              required
              className="w-full rounded-lg bg-black/30 border border-white/10 p-2 outline-none"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="px-3 rounded-lg bg-black/30 border border-white/10 text-sm"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-white text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          )}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
