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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 rounded-2xl shadow" style={{ backgroundColor: 'rgb(var(--card))', color: 'rgb(var(--foreground))' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Sign in</h1>
        <div className="space-y-2">
          <label className="block text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg p-2 outline-none"
            style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', border: '1px solid' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>Password</label>
          <div className="flex gap-2">
            <input
              type={showPw ? "text" : "password"}
              required
              className="w-full rounded-lg p-2 outline-none"
              style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', border: '1px solid' }}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="px-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))', border: '1px solid' }}
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
          className="w-full py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: 'rgb(var(--foreground))', color: 'rgb(var(--background))' }}
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(var(--background))', borderTopColor: 'transparent' }}></div>
          )}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
