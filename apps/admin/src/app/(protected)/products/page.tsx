"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatSom, formatQty, formatMoneyInput, parseMoney } from "@/lib/format";

interface ProductUnit {
  id: string;
  label: string;
  factor: string;
  price: string;
  isBase: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  stock: string;
  avgCost: string;
  category: { name: string } | null;
  units: ProductUnit[];
}

interface Category {
  id: string;
  name: string;
}

type StockFilter = "all" | "low" | "out";

function stockBadge(stock: number) {
  if (stock <= 0) {
    return (
      <span className="border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] text-[color:var(--color-error-text)] px-2 py-0.5 text-xs">
        Tugagan
      </span>
    );
  }
  if (stock < 10) {
    return (
      <span className="border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning-text)] px-2 py-0.5 text-xs">
        Kam qoldi
      </span>
    );
  }
  return (
    <span className="border border-[color:var(--color-success-border)] text-[color:var(--color-success-text)] px-2 py-0.5 text-xs">
      Yetarli
    </span>
  );
}

interface ProductsResponse {
  items: ProductRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function getPaginationPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function ProductsPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (stockFilter !== "all") params.set("stockFilter", stockFilter);
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      const res = await api.get<ProductsResponse>(`/products?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total ?? res.items.length);
      setTotalPages(res.totalPages ?? Math.max(1, Math.ceil((res.total ?? res.items.length) / pageSize)));
      setStatus(res.items.length === 0 ? "empty" : "ok");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
      setStatus("error");
    }
  }, [q, categoryId, stockFilter, page, pageSize]);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, categoryId, stockFilter, pageSize]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-condensed text-2xl font-bold">Tovarlar ro&apos;yxati</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm"
        >
          + Yangi tovar
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          placeholder="Qidirish..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 px-3 border border-divider bg-white text-sm flex-1 max-w-xs outline-none focus:border-accent"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-10 px-3 border border-divider bg-white text-sm"
        >
          <option value="">Barcha kategoriyalar</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex border border-divider">
          {(["all", "low", "out"] as StockFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStockFilter(f)}
              className={`h-10 px-3 text-sm ${stockFilter === f ? "bg-accent text-white" : "bg-white text-text/70"}`}
            >
              {f === "all" ? "Hammasi" : f === "low" ? "Kam qoldi" : "Tugagan"}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-divider bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Nomi</th>
              <th className="px-4 py-2.5 font-medium">Kategoriya</th>
              <th className="px-4 py-2.5 font-medium">Qoldiq</th>
              <th className="px-4 py-2.5 font-medium">Sotuv narxi</th>
              <th className="px-4 py-2.5 font-medium">Tannarx</th>
              <th className="px-4 py-2.5 font-medium">Holat</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" &&
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-divider">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-black/[.05] animate-pulse w-full" />
                  </td>
                </tr>
              ))}
            {status === "empty" && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text/50">
                  Tovarlar topilmadi
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <span className="text-[color:var(--color-error-text)]">{error}</span>{" "}
                  <button onClick={load} className="text-accent underline ml-2">
                    Qayta urinish
                  </button>
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((p) => {
                const baseUnit = p.units.find((u) => u.isBase) ?? p.units[0];
                return (
                  <tr key={p.id} className="border-b border-divider last:border-0 hover:bg-black/[.02]">
                    <td className="px-4 py-2.5">
                      <Link href={`/products/${p.id}`} className="text-accent-dark hover:underline font-medium">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-text/70">{p.category?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{formatQty(p.stock)}</td>
                    <td className="px-4 py-2.5">{baseUnit ? formatSom(baseUnit.price) : "—"}</td>
                    <td className="px-4 py-2.5 text-text/70">{formatSom(p.avgCost)}</td>
                    <td className="px-4 py-2.5">{stockBadge(Number(p.stock))}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-1 text-xs">
        <div className="text-text/60">
          {total > 0 ? (
            <span>
              <strong className="text-text font-medium">{total.toLocaleString("ru-RU")}</strong> tadan{" "}
              <strong className="text-text font-medium">
                {from}–{to}
              </strong>{" "}
              ko&apos;rsatilmoqda
            </span>
          ) : (
            <span>Tovarlar topilmadi</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-text/60">
            <span>Qatorda:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 px-2 border border-divider bg-white text-xs text-text/80 outline-none"
            >
              <option value={25}>25 tadan</option>
              <option value={50}>50 tadan</option>
              <option value={100}>100 tadan</option>
            </select>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || status === "loading"}
                className="h-8 px-2.5 border border-divider font-condensed bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/[.03]"
              >
                ‹ Oldingi
              </button>
              {getPaginationPages(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-1 text-text/40">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={status === "loading"}
                    className={`h-8 min-w-8 px-2 font-condensed border ${
                      page === p
                        ? "border-accent bg-accent text-white font-bold"
                        : "border-divider bg-white text-text/80 hover:bg-black/[.03]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || status === "loading"}
                className="h-8 px-2.5 border border-divider font-condensed bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/[.03]"
              >
                Keyingi ›
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateProductModal
          categories={categories}
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

function CreateProductModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [baseLabel, setBaseLabel] = useState("dona");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/products", {
        sku,
        name,
        categoryId: categoryId || undefined,
        units: [{ label: baseLabel, factor: 1, price: parseMoney(basePrice), isBase: true }],
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
        <h2 className="font-condensed text-xl font-bold mb-4">Yangi tovar</h2>

        <label className="block text-sm mb-1 text-text/70">SKU</label>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Nomi</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Kategoriya</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full h-10 px-3 border border-divider mb-3"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-sm mb-1 text-text/70">Baza birlik</label>
            <input
              value={baseLabel}
              onChange={(e) => setBaseLabel(e.target.value)}
              required
              className="w-full h-10 px-3 border border-divider outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1 text-text/70">Narxi (so&apos;m)</label>
            <input
              type="text"
              inputMode="numeric"
              value={basePrice}
              onChange={(e) => setBasePrice(formatMoneyInput(e.target.value))}
              placeholder="0"
              required
              className="w-full h-10 px-3 border border-divider outline-none focus:border-accent"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] px-3 py-2 text-sm text-[color:var(--color-error-text)]">
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
