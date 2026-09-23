"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface UserRow {
  id: string;
  name: string;
  login: string | null;
  role: "ADMIN" | "CASHIER";
  status: "ACTIVE" | "BLOCKED";
}

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await api.get<UserRow[]>("/users");
      setItems(res);
      setStatus("ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(user: UserRow) {
    const next = user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    await api.patch(`/users/${user.id}/status`, { status: next });
    load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-condensed text-2xl font-bold">Foydalanuvchilar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm"
        >
          + Yangi foydalanuvchi
        </button>
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Ism</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">PIN</th>
              <th className="px-4 py-2.5 font-medium">Holat</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text/50">
                  Yuklanmoqda...
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-error-text">
                  {error}
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((u) => (
                <tr key={u.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5">{u.name}</td>
                  <td className="px-4 py-2.5">{u.role === "ADMIN" ? "Admin" : "Kassir"}</td>
                  <td className="px-4 py-2.5 font-mono">{u.role === "CASHIER" ? "••••" : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 text-xs border ${
                        u.status === "ACTIVE"
                          ? "border-success-border text-success-text"
                          : "border-error-border bg-error-bg text-error-text"
                      }`}
                    >
                      {u.status === "ACTIVE" ? "Faol" : "Bloklangan"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-3 justify-end">
                      {u.role === "CASHIER" && (
                        <button onClick={() => setResetTarget(u)} className="text-accent hover:underline">
                          PIN&apos;ni tiklash
                        </button>
                      )}
                      <button onClick={() => toggleStatus(u)} className="text-accent hover:underline">
                        {u.status === "ACTIVE" ? "Bloklash" : "Faollashtirish"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {resetTarget && <ResetPinModal user={resetTarget} onClose={() => setResetTarget(null)} onDone={load} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CASHIER">("CASHIER");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/users", {
        name,
        role,
        login: role === "ADMIN" ? login : undefined,
        password: role === "ADMIN" ? password : undefined,
        pin: role === "CASHIER" ? pin : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-divider w-full max-w-md p-6">
        <h2 className="font-condensed text-xl font-bold mb-4">Yangi foydalanuvchi</h2>

        <label className="block text-sm mb-1 text-text/70">Ism</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Rol</label>
        <div className="flex border border-divider mb-3 w-fit">
          <button
            type="button"
            onClick={() => setRole("CASHIER")}
            className={`h-9 px-3 text-sm ${role === "CASHIER" ? "bg-accent text-white" : "bg-white"}`}
          >
            Kassir
          </button>
          <button
            type="button"
            onClick={() => setRole("ADMIN")}
            className={`h-9 px-3 text-sm ${role === "ADMIN" ? "bg-accent text-white" : "bg-white"}`}
          >
            Admin
          </button>
        </div>

        {role === "ADMIN" ? (
          <>
            <label className="block text-sm mb-1 text-text/70">Login</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
            />
            <label className="block text-sm mb-1 text-text/70">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
            />
          </>
        ) : (
          <>
            <label className="block text-sm mb-1 text-text/70">PIN (4 xona)</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              minLength={4}
              maxLength={4}
              pattern="\d{4}"
              className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
            />
          </>
        )}

        {error && (
          <div className="mb-4 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-10 px-4 border border-divider text-sm">
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm disabled:opacity-50"
          >
            Saqlash
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPinModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"confirm" | "newPin">("confirm");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ confirmationToken: string }>("/auth/confirm-pin", { pin: adminPassword });
      setConfirmationToken(res.confirmationToken);
      setStep("newPin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Parol noto'g'ri");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/users/${user.id}/pin`, { pin: newPin }, { "X-Pin-Confirmation": confirmationToken });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={step === "confirm" ? handleConfirm : handleSetPin}
        className="bg-white border border-divider w-full max-w-sm p-6"
      >
        <h2 className="font-condensed text-xl font-bold mb-1">{user.name} — PIN&apos;ni tiklash</h2>
        <p className="text-sm text-text/60 mb-4">
          {step === "confirm" ? "Davom etish uchun o'z parolingizni tasdiqlang." : "Yangi 4 xonali PIN kiriting."}
        </p>

        {step === "confirm" ? (
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Parolingiz"
            required
            className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
          />
        ) : (
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="Yangi PIN"
            required
            minLength={4}
            maxLength={4}
            pattern="\d{4}"
            className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
          />
        )}

        {error && (
          <div className="mb-4 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-10 px-4 border border-divider text-sm">
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm disabled:opacity-50"
          >
            {step === "confirm" ? "Tasdiqlash" : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}
