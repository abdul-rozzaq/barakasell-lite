"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatSom } from "@/lib/format";

interface SaleLine {
  id: string;
  productName: string;
  qtyInUnit: string;
  unitLabel: string;
  unitPrice: string;
  unitDiscountAmount: string;
  lineTotal: string;
}

interface SaleTender {
  type: "CASH" | "CARD" | "CLICK" | "CREDIT";
  amount: string;
}

interface SaleRow {
  id: string;
  code: string;
  status: "COMPLETED" | "VOIDED";
  subtotal: string;
  discountAmount: string;
  total: string;
  soldAt: string;
  voidedAt: string | null;
  cashier: { name: string } | null;
  lines: SaleLine[];
  tenders: SaleTender[];
}

const TENDER_LABEL: Record<SaleTender["type"], string> = {
  CASH: "Naqd",
  CARD: "Karta",
  CLICK: "Click",
  CREDIT: "Nasiya",
};

// ─── TOTP Modal ────────────────────────────────────────────────────────────
function TotpModal({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: (code: string) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("6 raqamli TOTP kodini kiriting");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="relative bg-white border border-divider w-full max-w-sm p-6"
      >
        {/* decorative corner marks */}
        <span className="absolute top-0 left-0 w-2.5 h-2.5 pointer-events-none" aria-hidden>
          <span className="block absolute inset-x-0 top-1/2 -translate-y-px h-px bg-text/55" />
          <span className="block absolute inset-y-0 left-1/2 -translate-x-px w-px bg-text/55" />
        </span>
        <span className="absolute top-0 right-0 w-2.5 h-2.5 pointer-events-none" aria-hidden>
          <span className="block absolute inset-x-0 top-1/2 -translate-y-px h-px bg-text/55" />
          <span className="block absolute inset-y-0 left-1/2 -translate-x-px w-px bg-text/55" />
        </span>
        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 pointer-events-none" aria-hidden>
          <span className="block absolute inset-x-0 top-1/2 -translate-y-px h-px bg-text/55" />
          <span className="block absolute inset-y-0 left-1/2 -translate-x-px w-px bg-text/55" />
        </span>
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 pointer-events-none" aria-hidden>
          <span className="block absolute inset-x-0 top-1/2 -translate-y-px h-px bg-text/55" />
          <span className="block absolute inset-y-0 left-1/2 -translate-x-px w-px bg-text/55" />
        </span>

        <h2 className="font-condensed text-xl font-bold mb-1">{title}</h2>
        <p className="text-sm text-text/60 mb-5">{description}</p>

        <label className="block text-sm mb-1 text-text/70">
          Autentifikator ilovasidagi 6 raqamli kod
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          autoFocus
          className="w-full h-12 px-3 border border-divider mb-4 outline-none focus:border-accent text-center font-condensed text-2xl tracking-widest"
        />

        {error && (
          <div className="mb-4 border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] px-3 py-2 text-sm text-[color:var(--color-error-text)]">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-4 border border-divider text-sm disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="font-condensed h-10 px-4 bg-[color:var(--color-error-text)] text-white font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "..." : "Tasdiqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function SalesPage() {
  const [items, setItems] = useState<SaleRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    api
      .get<SaleRow[]>("/sales?take=200")
      .then((res) => {
        setItems(res);
        setStatus(res.length === 0 ? "empty" : "ok");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVoid(code: string) {
    if (!voidTarget) return;
    setVoidingId(voidTarget.id);
    try {
      await api.delete(`/sales/${voidTarget.id}`, { "X-Totp-Code": code });
      setVoidTarget(null);
      load();
    } finally {
      setVoidingId(null);
    }
  }

  const completedCount = items.filter((s) => s.status === "COMPLETED").length;
  const voidedCount = items.filter((s) => s.status === "VOIDED").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-condensed text-2xl font-bold">Sotuvlar ro&apos;yxati</h1>
          {status === "ok" && (
            <p className="text-xs text-text/60 mt-0.5">
              {completedCount} ta aktiv · {voidedCount} ta bekor qilingan
            </p>
          )}
        </div>
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Kod</th>
              <th className="px-4 py-2.5 font-medium">Sana</th>
              <th className="px-4 py-2.5 font-medium">Kassir</th>
              <th className="px-4 py-2.5 font-medium">To&apos;lov turi</th>
              <th className="px-4 py-2.5 font-medium text-right">Jami</th>
              <th className="px-4 py-2.5 font-medium">Holat</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {status === "loading" &&
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-divider">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-black/[.05] animate-pulse w-full" />
                  </td>
                </tr>
              ))}
            {status === "empty" && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-text/50">
                  Sotuvlar topilmadi
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <span className="text-[color:var(--color-error-text)]">{error}</span>{" "}
                  <button onClick={load} className="text-accent underline ml-2">
                    Qayta urinish
                  </button>
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((sale) => (
                <Fragment key={sale.id}>
                  <tr
                    className={`border-b border-divider hover:bg-black/[.02] ${sale.status === "VOIDED" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setExpanded(expanded === sale.id ? null : sale.id)}
                        className="text-accent-dark hover:underline font-medium font-condensed"
                      >
                        {sale.code}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-text/70 whitespace-nowrap">
                      {new Date(sale.soldAt).toLocaleString("uz-UZ", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-text/70">{sale.cashier?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-text/70">
                      {sale.tenders.map((t) => TENDER_LABEL[t.type]).join(" + ")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-condensed font-medium">
                      {formatSom(sale.total)}
                      {Number(sale.discountAmount) > 0 && (
                        <div className="text-xs font-normal text-[color:var(--color-success-text)]">
                          -{formatSom(sale.discountAmount)} chegirma
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {sale.status === "COMPLETED" ? (
                        <span className="border border-[color:var(--color-success-border)] text-[color:var(--color-success-text)] px-2 py-0.5 text-xs">
                          Aktiv
                        </span>
                      ) : (
                        <span className="border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] text-[color:var(--color-error-text)] px-2 py-0.5 text-xs">
                          Bekor qilingan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {sale.status === "COMPLETED" && (
                        <button
                          onClick={() => setVoidTarget(sale)}
                          disabled={voidingId === sale.id}
                          className="h-8 px-3 border border-[color:var(--color-error-border)] text-[color:var(--color-error-text)] text-xs hover:bg-[color:var(--color-error-bg)] disabled:opacity-40"
                        >
                          Bekor qilish
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === sale.id && (
                    <tr key={`${sale.id}-detail`} className="border-b border-divider bg-black/[.01]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="text-xs text-text/60 mb-2 font-medium uppercase tracking-wide">
                          Tovarlar
                        </div>
                        <table className="w-full text-xs mb-3">
                          <thead>
                            <tr className="text-left text-text/50">
                              <th className="pb-1 font-medium">Nomi</th>
                              <th className="pb-1 font-medium text-right">Miqdor</th>
                              <th className="pb-1 font-medium text-right">Narxi</th>
                              <th className="pb-1 font-medium text-right">Jami</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.lines.map((line) => {
                              const unitDiscount = Number(line.unitDiscountAmount);
                              return (
                                <tr key={line.id}>
                                  <td className="py-0.5">
                                    {line.productName}
                                    {unitDiscount > 0 && (
                                      <span className="ml-1.5 text-[color:var(--color-success-text)]">
                                        (-{formatSom(unitDiscount)}/dona chegirma)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-0.5 text-right">
                                    {Number(line.qtyInUnit)} {line.unitLabel}
                                  </td>
                                  <td className="py-0.5 text-right">
                                    {unitDiscount > 0 ? (
                                      <>
                                        <span className="line-through text-text/40 mr-1">
                                          {formatSom(line.unitPrice)}
                                        </span>
                                        {formatSom(Number(line.unitPrice) - unitDiscount)}
                                      </>
                                    ) : (
                                      formatSom(line.unitPrice)
                                    )}
                                  </td>
                                  <td className="py-0.5 text-right font-medium">
                                    {formatSom(line.lineTotal)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="flex flex-col gap-1 text-xs text-text/60 mb-3 max-w-52">
                          <div className="flex justify-between">
                            <span>Oraliq jami</span>
                            <span>{formatSom(sale.subtotal)}</span>
                          </div>
                          {Number(sale.discountAmount) > 0 && (
                            <div className="flex justify-between text-[color:var(--color-success-text)]">
                              <span>Umumiy chegirma</span>
                              <span>-{formatSom(sale.discountAmount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium text-text">
                            <span>Jami</span>
                            <span>{formatSom(sale.total)}</span>
                          </div>
                        </div>
                        <div className="flex gap-6 text-xs text-text/60">
                          {sale.tenders.map((t, i) => (
                            <span key={i}>
                              {TENDER_LABEL[t.type]}:{" "}
                              <strong className="text-text">{formatSom(t.amount)}</strong>
                            </span>
                          ))}
                        </div>
                        {sale.status === "VOIDED" && sale.voidedAt && (
                          <div className="mt-2 text-xs text-[color:var(--color-error-text)]">
                            Bekor qilingan:{" "}
                            {new Date(sale.voidedAt).toLocaleString("uz-UZ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {/* TOTP Confirmation Modal */}
      {voidTarget && (
        <TotpModal
          title="Sotuvni bekor qilish"
          description={`"${voidTarget.code}" kodli ${formatSom(voidTarget.total)} lik sotuv to'liq bekor qilinadi. Qoldiqlar tiklangach, bu operatsiyani ortga qaytarib bo'lmaydi.`}
          onConfirm={handleVoid}
          onClose={() => setVoidTarget(null)}
        />
      )}
    </div>
  );
}
