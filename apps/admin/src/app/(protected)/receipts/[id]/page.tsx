"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { formatSom, formatQty, formatMoneyInput, parseMoney } from "@/lib/format";
import { ProductSelect, type ProductOption } from "@/components/ProductSelect";

interface Supplier {
  id: string;
  name: string;
}

interface DraftLine {
  productId: string;
  productName: string;
  unitLabel: string;
  qtyInUnit: string;
  unitCostPack: string;
}

interface ReceiptLine {
  id: string;
  productId: string;
  unitLabel: string;
  qtyInUnit: string;
  unitCostPack: string;
  lineTotal: string;
}

interface ReceiptDetail {
  id: string;
  code: string;
  status: "DRAFT" | "POSTED" | "VOIDED";
  supplierId: string | null;
  supplier: Supplier | null;
  note: string | null;
  lines: ReceiptLine[];
}

export default function ReceiptDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const isNew = id === "new";
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleProductsLoaded = useCallback((newProducts: ProductOption[]) => {
    setProducts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const filtered = newProducts.filter((p) => !existingIds.has(p.id));
      return [...prev, ...filtered];
    });
  }, []);

  const load = useCallback(async () => {
    const [sup, prod] = await Promise.all([
      api.get<Supplier[]>("/suppliers"),
      api.get<{ items: ProductOption[] }>("/products?take=50"),
    ]);
    setSuppliers(sup);
    let allProducts = prod.items;
    setProducts(allProducts);

    if (!isNew) {
      const r = await api.get<ReceiptDetail>(`/receipts/${id}`);
      setReceipt(r);
      setSupplierId(r.supplierId ?? "");
      setNote(r.note ?? "");

      // If any product from existing receipt lines is missing from first page, fetch it
      const missingIds = r.lines
        .map((l) => l.productId)
        .filter((pid) => pid && !allProducts.some((p) => p.id === pid));

      if (missingIds.length > 0) {
        const fetched = await Promise.all(
          missingIds.map((pid) =>
            api.get<ProductOption>(`/products/${pid}`).catch(() => null),
          ),
        );
        const validFetched = fetched.filter((p): p is ProductOption => p !== null);
        allProducts = [...allProducts, ...validFetched];
        setProducts(allProducts);
      }

      setLines(
        r.lines.map((l) => ({
          productId: l.productId,
          productName: allProducts.find((p) => p.id === l.productId)?.name ?? l.productId,
          unitLabel: l.unitLabel,
          qtyInUnit: l.qtyInUnit,
          unitCostPack: formatMoneyInput(l.unitCostPack),
        })),
      );
    }
  }, [id, isNew]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi"));
  }, [load]);

  function addLine() {
    if (products.length === 0) {
      setLines((prev) => [
        ...prev,
        {
          productId: "",
          productName: "",
          unitLabel: "",
          qtyInUnit: "",
          unitCostPack: "",
        },
      ]);
      return;
    }
    const first = products[0];
    const firstUnit = first.units[0];
    setLines((prev) => [
      ...prev,
      {
        productId: first.id,
        productName: first.name,
        unitLabel: firstUnit?.label ?? "",
        qtyInUnit: "",
        unitCostPack: "",
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function unitsFor(productId: string) {
    return products.find((p) => p.id === productId)?.units ?? [];
  }

  async function saveDraft() {
    setError(null);
    setSaving(true);
    try {
      const validLines = lines.filter((l) => l.productId);
      if (validLines.length === 0) {
        setError("Kamida bitta tovar tanlangan bo'lishi kerak");
        setSaving(false);
        return;
      }
      const payload = {
        supplierId: supplierId || undefined,
        note: note || undefined,
        lines: validLines.map((l) => ({
          productId: l.productId,
          unitLabel: l.unitLabel,
          qtyInUnit: Number(l.qtyInUnit),
          unitCostPack: parseMoney(l.unitCostPack),
        })),
      };
      if (isNew) {
        const created = await api.post<{ id: string }>("/receipts", payload);
        router.push(`/receipts/${created.id}`);
      } else {
        await api.patch(`/receipts/${id}`, payload);
        load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function post() {
    setError(null);
    setSaving(true);
    try {
      await api.post(`/receipts/${id}/post`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  const total = lines.reduce(
    (acc, l) => acc + Number(l.qtyInUnit || 0) * parseMoney(l.unitCostPack || 0),
    0,
  );
  const isDraft = isNew || receipt?.status === "DRAFT";
  const isPosted = receipt?.status === "POSTED";

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/receipts" className="text-accent text-sm hover:underline">
        ← Kirimlar ro&apos;yxati
      </Link>
      <h1 className="font-condensed text-2xl font-bold mt-2 mb-6">
        {isNew ? "Yangi kirim hujjati" : receipt?.code}
      </h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1 text-text/70">Yetkazib beruvchi</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={!isDraft}
            className="w-full h-10 px-3 border border-divider bg-white disabled:bg-surface"
          >
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-text/70">Izoh</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!isDraft}
            className="w-full h-10 px-3 border border-divider bg-white disabled:bg-surface"
          />
        </div>
      </div>

      <table className="w-full text-sm border border-divider bg-white mb-3">
        <thead>
          <tr className="border-b border-divider text-left text-text/60">
            <th className="px-3 py-2 font-medium">Tovar</th>
            <th className="px-3 py-2 font-medium">Birlik</th>
            <th className="px-3 py-2 font-medium">Miqdor</th>
            <th className="px-3 py-2 font-medium">Xarid narxi</th>
            <th className="px-3 py-2 font-medium">Jami</th>
            {isDraft && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-text/50">
                Qatorlar yo&apos;q
              </td>
            </tr>
          )}
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-divider last:border-0">
              <td className="px-3 py-2 min-w-55">
                {isDraft ? (
                  <ProductSelect
                    value={line.productId}
                    selectedName={line.productName}
                    onChange={(product) => {
                      updateLine(i, {
                        productId: product.id,
                        productName: product.name,
                        unitLabel: product.units[0]?.label ?? "",
                      });
                    }}
                    onProductsLoaded={handleProductsLoaded}
                  />
                ) : (
                  line.productName
                )}
              </td>
              <td className="px-3 py-2">
                {isDraft ? (
                  <select
                    value={line.unitLabel}
                    onChange={(e) => updateLine(i, { unitLabel: e.target.value })}
                    className="h-9 px-2 border border-divider"
                  >
                    {unitsFor(line.productId).map((u) => (
                      <option key={u.label} value={u.label}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  line.unitLabel
                )}
              </td>
              <td className="px-3 py-2">
                {isDraft ? (
                  <input
                    type="number"
                    value={line.qtyInUnit}
                    onChange={(e) => updateLine(i, { qtyInUnit: e.target.value })}
                    className="h-9 px-2 border border-divider w-24"
                    min={0}
                  />
                ) : (
                  formatQty(line.qtyInUnit)
                )}
              </td>
              <td className="px-3 py-2">
                {isDraft ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={line.unitCostPack}
                    onChange={(e) =>
                      updateLine(i, { unitCostPack: formatMoneyInput(e.target.value) })
                    }
                    placeholder="0"
                    className="h-9 px-2 border border-divider w-28"
                  />
                ) : (
                  formatSom(parseMoney(line.unitCostPack))
                )}
              </td>
              <td className="px-3 py-2">
                {formatSom(Number(line.qtyInUnit || 0) * parseMoney(line.unitCostPack || 0))}
              </td>
              {isDraft && (
                <td className="px-3 py-2">
                  <button onClick={() => removeLine(i)} className="text-error-text">
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isDraft && (
        <button onClick={addLine} className="text-accent text-sm mb-6 hover:underline">
          + Qator qo&apos;shish
        </button>
      )}

      <div className="font-condensed text-lg font-bold mb-6">Jami: {formatSom(total)}</div>

      {error && (
        <div className="mb-4 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {isDraft && (
          <button
            onClick={saveDraft}
            disabled={saving || lines.length === 0}
            className="h-10 px-4 border border-divider text-sm disabled:opacity-50"
          >
            Qoralama saqlash
          </button>
        )}
        {!isNew && isDraft && (
          <button
            onClick={post}
            disabled={saving || lines.length === 0}
            className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm disabled:opacity-50"
          >
            Tasdiqlash
          </button>
        )}
        {isPosted && <span className="text-success-text text-sm self-center">Tasdiqlangan</span>}
      </div>
    </div>
  );
}
