"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSom } from "@/lib/format";

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  debtBalance: string;
  note: string | null;
  cardCode: string | null;
  pointsBalance: number;
}

interface DebtEntry {
  id: string;
  type: "CREDIT_SALE" | "PAYMENT" | "RETURN_CREDIT" | "ADJUSTMENT";
  amount: string;
  balanceAfter: string;
  tender: string | null;
  occurredAt: string;
  note: string | null;
}

interface CustomerDetail extends CustomerRow {
  entries: DebtEntry[];
}

const ENTRY_LABEL: Record<DebtEntry["type"], string> = {
  CREDIT_SALE: "Nasiya sotuv",
  PAYMENT: "To'lov",
  RETURN_CREDIT: "Qaytarish (nasiya)",
  ADJUSTMENT: "Tuzatish",
};

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [creatingCard, setCreatingCard] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await api.get<CustomerRow[]>(`/customers?${params.toString()}`);
      setItems(res);
      setStatus(res.length === 0 ? "empty" : "ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const loadDetail = useCallback((id: string) => {
    api
      .get<CustomerDetail>(`/customers/${id}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function createCard() {
    if (!detail) return;
    setCreatingCard(true);
    try {
      await api.post(`/customers/${detail.id}/loyalty/card`);
      loadDetail(detail.id);
    } catch {
      // silently ignore — the card panel just stays in its "yaratish" state
    } finally {
      setCreatingCard(false);
    }
  }

  return (
    <div className="p-6 flex gap-6">
      <div className="w-80 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-condensed text-2xl font-bold">Mijozlar</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="font-condensed h-9 px-3 bg-accent text-white font-semibold text-sm"
          >
            + Yangi
          </button>
        </div>
        <input
          placeholder="Qidirish..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full h-10 px-3 border border-divider bg-white text-sm mb-3 outline-none focus:border-accent"
        />
        <div className="border border-divider bg-white">
          {status === "loading" && (
            <div className="px-4 py-6 text-center text-text/50 text-sm">Yuklanmoqda...</div>
          )}
          {status === "empty" && (
            <div className="px-4 py-6 text-center text-text/50 text-sm">Mijoz topilmadi</div>
          )}
          {status === "error" && (
            <div className="px-4 py-6 text-center text-sm text-error-text">{error}</div>
          )}
          {status === "ok" &&
            items.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-center justify-between px-4 py-3 border-b border-divider last:border-0 text-left text-sm ${
                  selectedId === c.id ? "bg-accent-tint-bg" : "hover:bg-black/2"
                }`}
              >
                <span>{c.name}</span>
                <span className={Number(c.debtBalance) > 0 ? "text-error-text" : "text-text/50"}>
                  {formatSom(c.debtBalance)}
                </span>
              </button>
            ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!detail ? (
          <div className="h-40 flex items-center justify-center text-text/50 text-sm">
            Mijozni tanlang
          </div>
        ) : (
          <div>
            <h2 className="font-condensed text-2xl font-bold mb-1">{detail.name}</h2>
            <div className="text-sm text-text/60 mb-5">
              {detail.phone ?? "Telefon kiritilmagan"}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
              <div className="p-4 bg-surface">
                <div className="text-sm text-text/60">Joriy qarz</div>
                <div
                  className={`font-condensed text-2xl font-bold mt-1 ${
                    Number(detail.debtBalance) > 0 ? "text-error-text" : ""
                  }`}
                >
                  {formatSom(detail.debtBalance)}
                </div>
              </div>
              <div className="p-4 bg-surface">
                <div className="text-sm text-text/60">Loyalty ball</div>
                <div className="font-condensed text-2xl font-bold mt-1">{detail.pointsBalance}</div>
              </div>
            </div>

            <div className="p-4 bg-surface mb-6 max-w-md flex items-center justify-between">
              {detail.cardCode ? (
                <div>
                  <div className="text-sm text-text/60">Karta kodi</div>
                  <div className="font-condensed text-lg font-bold tracking-wider">
                    {detail.cardCode}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text/60">Karta hali yaratilmagan</div>
              )}
              {!detail.cardCode && (
                <button
                  onClick={createCard}
                  disabled={creatingCard}
                  className="h-9 px-3 bg-accent text-white text-sm font-condensed font-semibold disabled:opacity-50"
                >
                  Karta yaratish
                </button>
              )}
            </div>

            <h3 className="font-condensed text-lg font-semibold mb-2">To&apos;lov tarixi</h3>
            <div className="border border-divider bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider text-left text-text/60">
                    <th className="px-4 py-2.5 font-medium">Sana</th>
                    <th className="px-4 py-2.5 font-medium">Turi</th>
                    <th className="px-4 py-2.5 font-medium">Miqdor</th>
                    <th className="px-4 py-2.5 font-medium">Qoldiq</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-text/50">
                        Tarix yo&apos;q
                      </td>
                    </tr>
                  ) : (
                    detail.entries.map((e) => (
                      <tr key={e.id} className="border-b border-divider last:border-0">
                        <td className="px-4 py-2.5">
                          {new Date(e.occurredAt).toLocaleString("uz-UZ")}
                        </td>
                        <td className="px-4 py-2.5">{ENTRY_LABEL[e.type]}</td>
                        <td
                          className={`px-4 py-2.5 ${
                            Number(e.amount) < 0 ? "text-success-text" : "text-error-text"
                          }`}
                        >
                          {Number(e.amount) > 0 ? "+" : ""}
                          {formatSom(e.amount)}
                        </td>
                        <td className="px-4 py-2.5">{formatSom(e.balanceAfter)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCustomerModal
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

function CreateCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/customers", { name, phone: phone || undefined });
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
        <h2 className="font-condensed text-xl font-bold mb-4">Yangi mijoz</h2>

        <label className="block text-sm mb-1 text-text/70">Ism</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
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
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 border border-divider text-sm"
          >
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
