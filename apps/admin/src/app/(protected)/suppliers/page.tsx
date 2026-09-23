"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSom } from "@/lib/format";

interface SupplierRow {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  lastReceiptAt: string | null;
  totalPurchase: string;
}

export default function SuppliersPage() {
  const [items, setItems] = useState<SupplierRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await api.get<SupplierRow[]>("/suppliers");
      setItems(res);
      setStatus(res.length === 0 ? "empty" : "ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-condensed text-2xl font-bold">Yetkazib beruvchilar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm"
        >
          + Yangi
        </button>
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Nomi</th>
              <th className="px-4 py-2.5 font-medium">Mas&apos;ul shaxs</th>
              <th className="px-4 py-2.5 font-medium">Telefon</th>
              <th className="px-4 py-2.5 font-medium">Oxirgi kirim sanasi</th>
              <th className="px-4 py-2.5 font-medium">Jami xarid summasi</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-divider">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-black/5 animate-pulse w-full" />
                  </td>
                </tr>
              ))}
            {status === "empty" && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text/50">
                  Yetkazib beruvchilar topilmadi
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <span className="text-error-text">{error}</span>{" "}
                  <button onClick={load} className="text-accent underline ml-2">
                    Qayta urinish
                  </button>
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((s) => (
                <tr key={s.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-text/70">{s.contactPerson ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text/70">{s.phone ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {s.lastReceiptAt ? new Date(s.lastReceiptAt).toLocaleDateString("uz-UZ") : "—"}
                  </td>
                  <td className="px-4 py-2.5">{formatSom(s.totalPurchase)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateSupplierModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/suppliers", {
        name,
        contactPerson: contactPerson || undefined,
        phone: phone || undefined,
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
        <h2 className="font-condensed text-xl font-bold mb-4">Yangi yetkazib beruvchi</h2>

        <label className="block text-sm mb-1 text-text/70">Nomi</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Mas&apos;ul shaxs</label>
        <input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Telefon</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
        />

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
