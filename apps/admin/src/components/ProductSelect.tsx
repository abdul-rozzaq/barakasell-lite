"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";

export interface ProductUnit {
  label: string;
  factor: string;
  price: string;
  isBase?: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  sku?: string;
  units: ProductUnit[];
}

interface ProductsApiResponse {
  items: ProductOption[];
  nextCursor?: string | null;
  total?: number;
}

interface ProductSelectProps {
  value: string;
  selectedName?: string;
  onChange: (product: ProductOption) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onProductsLoaded?: (products: ProductOption[]) => void;
}

export function ProductSelect({
  value,
  selectedName,
  onChange,
  disabled = false,
  placeholder = "Tovarni tanlang...",
  className = "",
  onProductsLoaded,
}: ProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const nextCursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // Initial / Search / Infinite load
  const loadProducts = useCallback(
    async (query: string, reset = true) => {
      if (reset) {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
      } else {
        if (loadingMoreRef.current || loadingRef.current || !nextCursorRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();
        params.set("take", "30");
        if (query.trim()) params.set("q", query.trim());
        if (!reset && nextCursorRef.current) {
          params.set("cursor", nextCursorRef.current);
        }

        const res = await api.get<ProductsApiResponse>(`/products?${params.toString()}`);
        const newItems = res.items ?? [];
        const newCursor = res.nextCursor ?? null;

        nextCursorRef.current = newCursor;
        setHasMore(!!newCursor);

        if (reset) {
          setItems(newItems);
        } else {
          setItems((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const filtered = newItems.filter((p) => !existingIds.has(p.id));
            return [...prev, ...filtered];
          });
        }

        if (newItems.length > 0 && onProductsLoaded) {
          onProductsLoaded(newItems);
        }
      } catch (err) {
        console.error("Tovarlarni yuklashda xatolik:", err);
      } finally {
        if (reset) {
          loadingRef.current = false;
          setLoading(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [onProductsLoaded],
  );

  // Search debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      nextCursorRef.current = null;
      loadProducts(search, true);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, isOpen, loadProducts]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Infinite scroll on list container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      hasMore &&
      !loadingMoreRef.current &&
      !loadingRef.current
    ) {
      loadProducts(search, false);
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next && items.length === 0) {
        nextCursorRef.current = null;
        loadProducts(search, true);
      }
      return next;
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (product: ProductOption) => {
    onChange(product);
    setIsOpen(false);
  };

  const currentItem = items.find((p) => p.id === value);
  const displayLabel = currentItem?.name || selectedName || (value ? value : placeholder);

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-[200px] text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`w-full h-9 px-2.5 flex items-center justify-between border border-divider bg-white text-sm text-left transition-colors outline-none ${
          disabled ? "bg-surface cursor-not-allowed opacity-70" : "hover:border-accent focus:border-accent"
        }`}
      >
        <span className={`truncate mr-2 ${!value && !selectedName ? "text-text/40" : "text-text font-medium"}`}>
          {displayLabel}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-text/50 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] bg-white border border-divider shadow-lg z-50">
          {/* Search Input */}
          <div className="p-2 border-b border-divider bg-surface">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tovar qidirish..."
                className="w-full h-8 pl-7 pr-7 text-xs border border-divider bg-white outline-none focus:border-accent"
              />
              <svg
                className="absolute left-2 w-3.5 h-3.5 text-text/40 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-text/40 hover:text-text text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List with Infinite Scroll */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto divide-y divide-divider text-sm"
          >
            {loading && items.length === 0 && (
              <div className="p-4 text-center text-xs text-text/50">
                <div className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mb-1" />
                <div>Yuklanmoqda...</div>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="p-4 text-center text-xs text-text/50">
                Tovar topilmadi
              </div>
            )}

            {items.map((product) => {
              const isSelected = product.id === value;
              return (
                <div
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                    isSelected ? "bg-accent-tint-bg font-semibold text-accent-tint-text" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="block truncate">{product.name}</span>
                    {product.sku && <span className="text-[10px] text-text/50">SKU: {product.sku}</span>}
                  </div>
                  {product.units?.[0] && (
                    <span className="text-[11px] text-text/60 shrink-0">
                      {product.units[0].label}
                    </span>
                  )}
                </div>
              );
            })}

            {loadingMore && (
              <div className="p-2 text-center text-xs text-text/50 bg-surface">
                Yana yuklanmoqda...
              </div>
            )}

            {hasMore && !loadingMore && items.length > 0 && (
              <div
                onClick={() => loadProducts(search, false)}
                className="p-1.5 text-center text-[11px] text-accent hover:underline cursor-pointer bg-surface"
              >
                Ko&apos;proq yuklash
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
