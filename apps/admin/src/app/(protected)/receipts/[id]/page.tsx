"use client";

import { useEffect, useState, use as usePromise, useCallback, useMemo, useRef } from "react";
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

type OcrStatus = "matched" | "uncertain" | "unmatched";

interface OcrCandidate {
  productId: string;
  name: string;
  sku: string;
  score: number;
}

interface OcrLine {
  rawName: string;
  qty: number;
  productId: string | null;
  productName: string | null;
  unitLabel: string;
  unitCostPack: number;
  status: OcrStatus;
  candidates: OcrCandidate[];
  warnings: string[];
}

interface OcrResult {
  supplierName: string | null;
  supplierId: string | null;
  lines: OcrLine[];
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
  const [showOcrModal, setShowOcrModal] = useState(false);

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
        <div className="flex items-center gap-4 mb-6">
          <button onClick={addLine} className="text-accent text-sm hover:underline">
            + Qator qo&apos;shish
          </button>
          <button onClick={() => setShowOcrModal(true)} className="text-accent text-sm hover:underline">
            Rasmdan to&apos;ldirish
          </button>
        </div>
      )}

      {showOcrModal && (
        <OcrModal
          onClose={() => setShowOcrModal(false)}
          onApply={(newLines, matchedSupplierId, fetchedProducts) => {
            handleProductsLoaded(fetchedProducts);
            setLines((prev) => [...prev, ...newLines]);
            if (matchedSupplierId && !supplierId) setSupplierId(matchedSupplierId);
            setShowOcrModal(false);
          }}
        />
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

interface OcrDraftRow {
  include: boolean;
  rawName: string;
  productId: string;
  productName: string;
  unitLabel: string;
  qtyInUnit: string;
  unitCostPack: string;
  status: OcrStatus;
  warnings: string[];
}

const STATUS_LABEL: Record<OcrStatus, string> = {
  matched: "Topildi",
  uncertain: "Noaniq",
  unmatched: "Topilmadi",
};

const STATUS_CLASS: Record<OcrStatus, string> = {
  matched: "text-success-text border border-success-border",
  uncertain: "text-warning-text bg-warning-bg",
  unmatched: "text-error-text bg-error-bg",
};

const MAX_OCR_FILES = 10;

function OcrModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (lines: DraftLine[], supplierId: string | null, products: ProductOption[]) => void;
}) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [rows, setRows] = useState<OcrDraftRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setFiles((prev) => [...prev, ...images].slice(0, MAX_OCR_FILES));
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  // Lets the owner paste a screenshot or an image copied from Telegram
  // Desktop (Ctrl+C on a photo there, Ctrl+V here) straight in — no need
  // to save it to disk and click through a file picker first.
  useEffect(() => {
    if (step !== "upload") return;
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length > 0) {
        e.preventDefault();
        addFiles(pasted);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [step, addFiles]);

  async function analyze() {
    if (files.length === 0) return;
    setError(null);
    setAnalyzing(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const result = await api.postForm<OcrResult>("/receipts/ocr", form);
      setSupplierId(result.supplierId);
      setSupplierName(result.supplierName);
      setRows(
        result.lines.map((l) => ({
          include: l.status !== "unmatched",
          rawName: l.rawName,
          productId: l.productId ?? "",
          productName: l.productName ?? "",
          unitLabel: l.unitLabel,
          qtyInUnit: String(l.qty),
          unitCostPack: formatMoneyInput(l.unitCostPack),
          status: l.status,
          warnings: l.warnings,
        })),
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rasmni tahlil qilishda xatolik");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateRow(index: number, patch: Partial<OcrDraftRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function apply() {
    const selected = rows.filter((r) => r.include && r.productId);
    const draftLines: DraftLine[] = selected.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      unitLabel: r.unitLabel,
      qtyInUnit: r.qtyInUnit,
      unitCostPack: r.unitCostPack,
    }));

    setError(null);
    setApplying(true);
    try {
      // The OCR-matched products were never opened in their row's
      // ProductSelect dropdown, so they never reached the page's own
      // `products` list (ProductSelect only reports what it has loaded) —
      // without this, the "Birlik" select on the main table has no options
      // for these lines because `unitsFor()` can't find them. Fetch full
      // unit data directly, same as `load()` does for missing line products.
      const uniqueIds = [...new Set(draftLines.map((l) => l.productId))];
      const fetched = await Promise.all(
        uniqueIds.map((pid) => api.get<ProductOption>(`/products/${pid}`).catch(() => null)),
      );
      const fetchedProducts = fetched.filter((p): p is ProductOption => p !== null);
      onApply(draftLines, supplierId, fetchedProducts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tovar ma'lumotlarini yuklashda xatolik");
    } finally {
      setApplying(false);
    }
  }

  const includedCount = rows.filter((r) => r.include && r.productId).length;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-divider w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-condensed text-xl font-bold mb-1">Rasmdan to&apos;ldirish</h2>
        <p className="text-sm text-text/60 mb-4">
          {step === "upload"
            ? "Faktura yoki накладной rasmini yuklang — AI tovarlarni o'qib, mos keladigan tovarlarni topishga harakat qiladi."
            : "Har bir qatorni tekshiring. Noaniq yoki topilmagan qatorlar uchun tovarni qo'lda tanlang, keyin qo'shing."}
        </p>

        {step === "upload" && (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-6 text-center cursor-pointer mb-4 transition-colors ${
                dragActive ? "border-accent bg-accent-tint-bg" : "border-divider hover:border-accent"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
                className="hidden"
              />
              <p className="text-sm text-text/70">
                Rasmlarni shu yerga tashlang, <span className="text-accent underline">fayl tanlash</span> uchun
                bosing, yoki nusxalab <span className="font-medium">Ctrl+V</span> qiling.
              </p>
              <p className="text-xs text-text/40 mt-1">
                Faktura bir necha sahifadan iborat bo&apos;lsa, barchasini birga qo&apos;shing.
              </p>
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {previews.map((p, i) => (
                  <div key={i} className="relative">
                    <img
                      src={p.url}
                      alt={p.file.name}
                      className="w-16 h-16 object-cover border border-divider"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-error-text text-white text-[10px] leading-4 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="h-10 px-4 border border-divider text-sm">
                Bekor qilish
              </button>
              <button
                onClick={analyze}
                disabled={files.length === 0 || analyzing}
                className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2"
              >
                {analyzing && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Tahlil qilish{files.length > 1 ? ` (${files.length})` : ""}
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div>
            {supplierName && (
              <div className="text-sm text-text/70 mb-3">
                Yetkazib beruvchi: <span className="font-medium text-text">{supplierName}</span>
                {!supplierId && " (mos yozuv topilmadi, qo'lda tanlang)"}
              </div>
            )}

            <table className="w-full text-sm border border-divider mb-3">
              <thead>
                <tr className="border-b border-divider text-left text-text/60">
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2 font-medium">Xom matn / Tovar</th>
                  <th className="px-2 py-2 font-medium">Miqdor</th>
                  <th className="px-2 py-2 font-medium">Narx</th>
                  <th className="px-2 py-2 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-divider last:border-0 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) => updateRow(i, { include: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-55">
                      <div className="text-xs text-text/50 mb-1 truncate">{row.rawName}</div>
                      <ProductSelect
                        value={row.productId}
                        selectedName={row.productName}
                        onChange={(product) =>
                          updateRow(i, {
                            productId: product.id,
                            productName: product.name,
                            unitLabel: product.units[0]?.label ?? "",
                          })
                        }
                      />
                      {row.warnings.length > 0 && (
                        <div className="mt-1 text-[11px] text-warning-text">
                          {row.warnings.map((w, wi) => (
                            <div key={wi}>⚠ {w}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={row.qtyInUnit}
                        onChange={(e) => updateRow(i, { qtyInUnit: e.target.value })}
                        className="h-9 px-2 border border-divider w-20"
                        min={0}
                      />
                      <div className="text-[11px] text-text/50 mt-1">{row.unitLabel}</div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.unitCostPack}
                        onChange={(e) => updateRow(i, { unitCostPack: formatMoneyInput(e.target.value) })}
                        className="h-9 px-2 border border-divider w-28"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-block px-2 py-0.5 text-[11px] ${STATUS_CLASS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {error && (
              <div className="mb-4 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="h-10 px-4 border border-divider text-sm">
                Bekor qilish
              </button>
              <button
                onClick={apply}
                disabled={includedCount === 0 || applying}
                className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm disabled:opacity-50 inline-flex items-center gap-2"
              >
                {applying && (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Qo&apos;shish ({includedCount})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
