"use client";

import { useEffect, useState, use as usePromise, useCallback } from "react";
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

interface Barcode {
  id: string;
  code: string;
  isInternal: boolean;
}

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  stock: string;
  avgCost: string;
  category: { name: string } | null;
  units: ProductUnit[];
  barcodes: Barcode[];
}

interface Category {
  id: string;
  name: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newBarcode, setNewBarcode] = useState("");
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [unitBusyId, setUnitBusyId] = useState<string | null>(null);
  const [removingUnit, setRemovingUnit] = useState<ProductUnit | null>(null);
  const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);

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

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

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

  async function removeUnit(unitId: string) {
    setUnitBusyId(unitId);
    try {
      await api.delete(`/product-units/${unitId}`);
      setRemovingUnit(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setUnitBusyId(null);
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
      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="font-condensed text-2xl font-bold">{product.name}</h1>
        <button
          onClick={() => setShowEdit(true)}
          className="h-9 px-3 border border-divider text-sm"
        >
          Tahrirlash
        </button>
      </div>
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
              <th className="px-4 py-2 font-medium w-44">Amallar</th>
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
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingUnit(u)}
                      disabled={unitBusyId === u.id}
                      className="text-accent hover:underline disabled:opacity-30"
                    >
                      Narxni tahrirlash
                    </button>
                    {!u.isBase && (
                      <button
                        onClick={() => setRemovingUnit(u)}
                        disabled={unitBusyId === u.id}
                        className="text-[color:var(--color-error-text)] hover:underline disabled:opacity-30"
                      >
                        O&apos;chirish
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() => setShowAddUnit(true)}
          className="mt-3 h-9 px-3 border border-divider text-sm"
        >
          + Yangi birlik qo&apos;shish
        </button>
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

      {showAddUnit && (
        <AddUnitModal
          productId={id}
          onClose={() => setShowAddUnit(false)}
          onAdded={() => {
            setShowAddUnit(false);
            load();
          }}
        />
      )}

      {removingUnit && (
        <ConfirmRemoveUnitModal
          unit={removingUnit}
          busy={unitBusyId === removingUnit.id}
          onCancel={() => setRemovingUnit(null)}
          onConfirm={() => removeUnit(removingUnit.id)}
        />
      )}

      {editingUnit && (
        <EditUnitPriceModal
          unit={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSaved={() => {
            setEditingUnit(null);
            load();
          }}
        />
      )}

      {showEdit && (
        <EditProductModal
          product={product}
          categories={categories}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: ProductDetail;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/products/${product.id}`, {
        name,
        categoryId: categoryId || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-divider w-full max-w-md p-6">
        <h2 className="font-condensed text-xl font-bold mb-4">Tovarni tahrirlash</h2>

        <label className="block text-sm mb-1 text-text/70">SKU</label>
        <input
          value={product.sku}
          disabled
          className="w-full h-10 px-3 border border-divider mb-3 bg-black/[.03] text-text/50"
        />

        <label className="block text-sm mb-1 text-text/70">Nomi</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Kategoriya</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full h-10 px-3 border border-divider mb-4"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

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

function AddUnitModal({
  productId,
  onClose,
  onAdded,
}: {
  productId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [factor, setFactor] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/units`, {
        label,
        factor: Number(factor),
        price: parseMoney(price),
      });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-divider w-full max-w-sm p-6">
        <h2 className="font-condensed text-xl font-bold mb-1">Yangi birlik</h2>
        <p className="text-sm text-text/60 mb-4">Masalan: karobka, pachka, quti.</p>

        <label className="block text-sm mb-1 text-text/70">Nomi</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="karobka"
          required
          autoFocus
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Baza birlikka nisbatan koeffitsient</label>
        <input
          type="number"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
          placeholder="Masalan: 12 (1 karobka = 12 dona)"
          required
          min={0.000001}
          step="any"
          className="w-full h-10 px-3 border border-divider mb-3 outline-none focus:border-accent"
        />

        <label className="block text-sm mb-1 text-text/70">Narxi (so&apos;m)</label>
        <input
          type="text"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(formatMoneyInput(e.target.value))}
          placeholder="0"
          required
          className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
        />

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

function ConfirmRemoveUnitModal({
  unit,
  busy,
  onCancel,
  onConfirm,
}: {
  unit: ProductUnit;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-divider w-full max-w-sm p-6">
        <h2 className="font-condensed text-xl font-bold mb-1">&quot;{unit.label}&quot; birligini o&apos;chirish</h2>
        <p className="text-sm text-text/60 mb-4">Bu birlikni o&apos;chirishni tasdiqlaysizmi?</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="h-10 px-4 border border-divider text-sm">
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="font-condensed h-10 px-4 bg-[color:var(--color-error-text)] text-white font-semibold text-sm disabled:opacity-50"
          >
            O&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUnitPriceModal({
  unit,
  onClose,
  onSaved,
}: {
  unit: ProductUnit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(formatMoneyInput(unit.price));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/product-units/${unit.id}`, { price: parseMoney(price) });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-divider w-full max-w-sm p-6">
        <h2 className="font-condensed text-xl font-bold mb-4">&quot;{unit.label}&quot; narxi</h2>

        <label className="block text-sm mb-1 text-text/70">Narxi (so&apos;m)</label>
        <input
          type="text"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(formatMoneyInput(e.target.value))}
          placeholder="0"
          required
          autoFocus
          className="w-full h-10 px-3 border border-divider mb-4 outline-none focus:border-accent"
        />

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
