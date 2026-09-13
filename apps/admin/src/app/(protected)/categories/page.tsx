"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

interface CategoryRow {
  id: string;
  name: string;
  _count: { products: number };
}

export default function CategoriesPage() {
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await api.get<CategoryRow[]>("/categories");
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

  function startEdit(c: CategoryRow) {
    setRowError(null);
    setEditingId(c.id);
    setEditingName(c.name);
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) return;
    setBusyId(editingId);
    setRowError(null);
    try {
      await api.patch(`/categories/${editingId}`, { name: editingName.trim() });
      setEditingId(null);
      load();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: CategoryRow) {
    setBusyId(c.id);
    setRowError(null);
    try {
      await api.delete(`/categories/${c.id}`);
      setDeletingCategory(null);
      load();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-condensed text-2xl font-bold">Kategoriyalar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="font-condensed h-10 px-4 bg-accent text-white font-semibold text-sm"
        >
          + Yangi kategoriya
        </button>
      </div>

      {rowError && (
        <div className="mb-4 border border-[color:var(--color-error-border)] bg-[color:var(--color-error-bg)] px-3 py-2 text-sm text-[color:var(--color-error-text)]">
          {rowError}
        </div>
      )}

      <div className="border border-divider bg-white max-w-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-left text-text/60">
              <th className="px-4 py-2.5 font-medium">Nomi</th>
              <th className="px-4 py-2.5 font-medium">Tovarlar soni</th>
              <th className="px-4 py-2.5 font-medium w-40">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-divider">
                  <td colSpan={3} className="px-4 py-3">
                    <div className="h-4 bg-black/[.05] animate-pulse w-full" />
                  </td>
                </tr>
              ))}
            {status === "empty" && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-text/50">
                  Kategoriyalar topilmadi
                </td>
              </tr>
            )}
            {status === "error" && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center">
                  <span className="text-[color:var(--color-error-text)]">{error}</span>{" "}
                  <button onClick={load} className="text-accent underline ml-2">
                    Qayta urinish
                  </button>
                </td>
              </tr>
            )}
            {status === "ok" &&
              items.map((c) => (
                <tr key={c.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5">
                    {editingId === c.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-8 px-2 border border-accent outline-none w-full"
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text/70">{c._count.products}</td>
                  <td className="px-4 py-2.5">
                    {editingId === c.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={busyId === c.id}
                          className="text-accent hover:underline disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-text/60 hover:underline">
                          Bekor
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => startEdit(c)} className="text-accent hover:underline">
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => setDeletingCategory(c)}
                          disabled={c._count.products > 0 || busyId === c.id}
                          title={c._count.products > 0 ? "Bu kategoriyada tovarlar bor" : undefined}
                          className="text-[color:var(--color-error-text)] hover:underline disabled:opacity-30 disabled:no-underline"
                        >
                          O&apos;chirish
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateCategoryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {deletingCategory && (
        <ConfirmDeleteModal
          category={deletingCategory}
          busy={busyId === deletingCategory.id}
          onCancel={() => setDeletingCategory(null)}
          onConfirm={() => remove(deletingCategory)}
        />
      )}
    </div>
  );
}

function ConfirmDeleteModal({
  category,
  busy,
  onCancel,
  onConfirm,
}: {
  category: CategoryRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-divider w-full max-w-sm p-6">
        <h2 className="font-condensed text-xl font-bold mb-1">Kategoriyani o&apos;chirish</h2>
        <p className="text-sm text-text/60 mb-4">
          &quot;{category.name}&quot; kategoriyasini o&apos;chirishni tasdiqlaysizmi?
        </p>
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

function CreateCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/categories", { name });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-divider w-full max-w-sm p-6">
        <h2 className="font-condensed text-xl font-bold mb-4">Yangi kategoriya</h2>

        <label className="block text-sm mb-1 text-text/70">Nomi</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
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
