"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginValue, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kirishda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border border-divider bg-surface p-8"
      >
        <h1 className="font-condensed text-2xl font-bold text-text mb-1">BarakaSELL</h1>
        <p className="text-sm text-text/60 mb-6">Admin panelga kirish</p>

        <label className="block text-sm mb-1 text-text/70">Login</label>
        <input
          className="w-full border border-divider bg-white px-3 h-11 mb-4 text-text outline-none focus:border-accent"
          value={loginValue}
          onChange={(e) => setLoginValue(e.target.value)}
          autoFocus
          required
        />

        <label className="block text-sm mb-1 text-text/70">Parol</label>
        <input
          type="password"
          className="w-full border border-divider bg-white px-3 h-11 mb-6 text-text outline-none focus:border-accent"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="mb-4 border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] px-3 py-2 text-sm text-[color:var(--color-error-text)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="font-condensed w-full h-11 bg-accent text-white font-semibold disabled:opacity-50"
        >
          {submitting ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>
    </div>
  );
}
