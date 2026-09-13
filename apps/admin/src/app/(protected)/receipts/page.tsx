"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

interface ReceiptRow {
  id: string;
  code: string;
  status: "DRAFT" | "POSTED" | "VOIDED";
  createdAt: string;
  supplier: { name: string } | null;
}

const STATUS_LABEL: Record<ReceiptRow["status"], string> = {
  DRAFT: "Qoralama",
  POSTED: "Tasdiqlangan",
  VOIDED: "Bekor qilingan",
};

export default function ReceiptsPage() {
  const [items, setItems] = useState<ReceiptRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReceiptRow[]>("/receipts")
      .then((res) => {
        setItems(res);
        setStatus(res.length === 0 ? "empty" : "ok");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
        setStatus("error");
      });
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-condensed text-2xl font-bold">Kirimlar ro&apos;yxati</h1>
        <Link
          href="/receipts/new"
          className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm flex items-center"
        >
          + Yangi hujjat
        </Link>
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Kod</th>
              <th className="px-4 py-2.5 font-medium">Sana</th>
              <th className="px-4 py-2.5 font-medium">Yetkazib beruvchi</th>
              <th className="px-4 py-2.5 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" && (
              <tr>
                <td colSpan={4} className="px-4 py-3">
                  <div className="h-4 bg-black/[.05] animate-pulse w-full" />
                </td>
              </tr>
            )}
            {status === "empty" && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-text/50">
                  Hujjatlar yo&apos;q
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[color:var(--color-error-text)]">
                  {error}
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((r) => (
                <tr key={r.id} className="border-b border-divider last:border-0 hover:bg-black/[.02]">
                  <td className="px-4 py-2.5">
                    <Link href={`/receipts/${r.id}`} className="text-accent-dark hover:underline font-medium">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-text/70">{new Date(r.createdAt).toLocaleDateString("uz-UZ")}</td>
                  <td className="px-4 py-2.5">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 text-xs border ${
                        r.status === "POSTED"
                          ? "border-[color:var(--color-success-border)] text-[color:var(--color-success-text)]"
                          : r.status === "DRAFT"
                            ? "border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning-text)]"
                            : "border-divider text-text/50"
                      }`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
