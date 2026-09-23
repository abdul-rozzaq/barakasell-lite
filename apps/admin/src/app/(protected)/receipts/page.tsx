"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

interface ReceiptRow {
  id: string;
  code: string;
  status: "DRAFT" | "POSTED" | "VOIDED";
  createdAt: string;
  supplier: { name: string } | null;
}

interface ReceiptsResponse {
  items: ReceiptRow[];
  nextCursor: string | null;
}

const STATUS_LABEL: Record<ReceiptRow["status"], string> = {
  DRAFT: "Qoralama",
  POSTED: "Tasdiqlangan",
  VOIDED: "Bekor qilingan",
};

export default function ReceiptsPage() {
  const [items, setItems] = useState<ReceiptRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await api.get<ReceiptsResponse | ReceiptRow[]>("/receipts?take=30");
      if (Array.isArray(res)) {
        setItems(res);
        setNextCursor(null);
        setStatus(res.length === 0 ? "empty" : "ok");
      } else {
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setStatus(res.items.length === 0 ? "empty" : "ok");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get<ReceiptsResponse | ReceiptRow[]>(
        `/receipts?cursor=${encodeURIComponent(nextCursor)}&take=30`,
      );
      if (Array.isArray(res)) {
        setItems((prev) => [...prev, ...res]);
        setNextCursor(null);
      } else {
        setItems((prev) => [...prev, ...res.items]);
        setNextCursor(res.nextCursor);
      }
    } catch (err) {
      console.error("Keyingi sahifani yuklashda xatolik:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

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
                  <div className="h-4 bg-black/5 animate-pulse w-full" />
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
                <td colSpan={4} className="px-4 py-10 text-center text-error-text">
                  {error}
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((r) => (
                <tr key={r.id} className="border-b border-divider last:border-0 hover:bg-black/2">
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
                          ? "border-success-border text-success-text"
                          : r.status === "DRAFT"
                            ? "border-warning-border bg-warning-bg text-warning-text"
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

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="p-3 text-center text-xs text-text/60 border-t border-divider bg-black/2">
            Kirimlar yuklanmoqda...
          </div>
        )}

        {/* Intersection Sentinel element */}
        {nextCursor && (
          <div ref={sentinelRef} className="h-4 w-full" />
        )}
      </div>

      {/* Manual fallback button in case observer doesn't fire */}
      {nextCursor && !loadingMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            className="text-xs text-accent hover:underline py-1.5 px-3 border border-divider bg-white"
          >
            Yana yuklash
          </button>
        </div>
      )}
    </div>
  );
}
