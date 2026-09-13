"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatSom, formatQty } from "@/lib/format";

interface ProductUnit {
  id: string;
  label: string;
  factor: string;
  price: string;
  isBase: boolean;
}

interface Barcode {
  id: string;
  code: string;
  isInternal: boolean;
}

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  stock: string;
  avgCost: string;
  category: { name: string } | null;
  units: ProductUnit[];
  barcodes: Barcode[];
}

interface Movement {
  occurredAt: string;
  type: "RECEIPT" | "SALE" | "RETURN" | "COUNT_ADJUST";
  qtyDelta: string;
  balanceAfter: string;
  refType: string;
  refId: string;
}

const TYPE_LABEL: Record<Movement["type"], string> = {
  RECEIPT: "Kirim",
  SALE: "Sotuv",
  RETURN: "Qaytarish",
  COUNT_ADJUST: "Inventarizatsiya",
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newBarcode, setNewBarcode] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        api.get<ProductDetail>(`/products/${id}`),
        api.get<Movement[]>(`/products/${id}/movements`),
      ]);
      setProduct(p);
      setMovements(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addBarcode(e: React.FormEvent) {
    e.preventDefault();
    if (!newBarcode) return;
    try {
      await api.post(`/products/${id}/barcodes`, { code: newBarcode });
      setNewBarcode("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  async function generateBarcode() {
    try {
      await api.post(`/products/${id}/barcodes/generate`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <span className="text-[color:var(--color-error-text)]">{error}</span>
      </div>
    );
  }
  if (!product) {
    return <div className="p-6 text-text/50">Yuklanmoqda...</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/products" className="text-accent text-sm hover:underline">
        ← Tovarlar ro&apos;yxati
      </Link>
      <h1 className="font-condensed text-2xl font-bold mt-2 mb-1">{product.name}</h1>
      <p className="text-text/60 text-sm mb-6">
        SKU: {product.sku} · {product.category?.name ?? "Kategoriyasiz"}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatBlock label="Qoldiq" value={formatQty(product.stock)} />
        <StatBlock label="O'rtacha tannarx" value={formatSom(product.avgCost)} />
        <StatBlock
          label="Sotuv narxi"
          value={formatSom(product.units.find((u) => u.isBase)?.price ?? 0)}
        />
      </div>

      <Section title="O'lchov birliklari">
        <table className="w-full text-sm border border-divider bg-white">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2 font-medium">Birlik</th>
              <th className="px-4 py-2 font-medium">Koeffitsient</th>
              <th className="px-4 py-2 font-medium">Narxi</th>
            </tr>
          </thead>
          <tbody>
            {product.units.map((u) => (
              <tr key={u.id} className="border-b border-divider last:border-0">
                <td className="px-4 py-2">
                  {u.label} {u.isBase && <span className="text-text/50">(baza)</span>}
                </td>
                <td className="px-4 py-2">{u.isBase ? "asosiy birlik" : `= ${formatQty(u.factor)} dona`}</td>
                <td className="px-4 py-2">{formatSom(u.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Shtrix-kodlar">
        <div className="flex flex-wrap gap-2 mb-3">
          {product.barcodes.length === 0 && <span className="text-text/50 text-sm">Yo&apos;q</span>}
          {product.barcodes.map((b) => (
            <span
              key={b.id}
              className="border border-divider bg-white px-2.5 py-1 text-sm font-mono"
              title={b.isInternal ? "Ichki generatsiya" : undefined}
            >
              {b.code}
            </span>
          ))}
        </div>
        <form onSubmit={addBarcode} className="flex gap-2">
          <input
            value={newBarcode}
            onChange={(e) => setNewBarcode(e.target.value)}
            placeholder="Yangi barcode"
            className="h-9 px-3 border border-divider text-sm outline-none focus:border-accent"
          />
          <button type="submit" className="h-9 px-3 border border-divider text-sm">
            Qo&apos;shish
          </button>
          <button type="button" onClick={generateBarcode} className="h-9 px-3 border border-divider text-sm">
            Ichki generatsiya
          </button>
        </form>
      </Section>

      <Section title="Harakatlar tarixi">
        <table className="w-full text-sm border border-divider bg-white">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2 font-medium">Sana</th>
              <th className="px-4 py-2 font-medium">Turi</th>
              <th className="px-4 py-2 font-medium">Miqdor</th>
              <th className="px-4 py-2 font-medium">Qoldiq keyin</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-text/50">
                  Harakatlar yo&apos;q
                </td>
              </tr>
            )}
            {movements.map((m, i) => {
              const qty = Number(m.qtyDelta);
              return (
                <tr key={i} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2">{new Date(m.occurredAt).toLocaleString("uz-UZ")}</td>
                  <td className="px-4 py-2">{TYPE_LABEL[m.type]}</td>
                  <td
                    className={`px-4 py-2 ${qty >= 0 ? "text-[color:var(--color-success-text)]" : "text-[color:var(--color-error-text)]"}`}
                  >
                    {qty >= 0 ? "+" : ""}
                    {formatQty(qty)}
                  </td>
                  <td className="px-4 py-2">{formatQty(m.balanceAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-divider bg-surface p-4">
      <div className="text-xs text-text/60 mb-1">{label}</div>
      <div className="font-condensed text-xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-condensed text-lg font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}
