import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/app-context';
import { api } from '../lib/api';
import { formatSom, formatQty } from '../lib/format';
import { OfflinePill } from '../components/OfflinePill';
import { NumericPadModal } from '../components/NumericPad';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { Drawer } from '../components/Drawer';
import type { Category, Product, ProductUnit } from '../state/types';

const LOW_STOCK_THRESHOLD = 10;

export function SaleScreen() {
  const { state, addToCart, updateCartLineQty, removeCartLine, goToPayment } = useApp();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [unitPickerFor, setUnitPickerFor] = useState<Product | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [stockNotice, setStockNotice] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (categoryId) params.set('categoryId', categoryId);
      params.set('take', '60');
      api
        .get<{ items: Product[] }>(`/products?${params.toString()}`)
        .then((res) => {
          setProducts(res.items);
          const trimmed = query.trim();
          const skuMatch = trimmed
            ? res.items.find((p) => p.sku.toLowerCase() === trimmed.toLowerCase())
            : undefined;
          if (skuMatch) {
            handleTileClick(skuMatch);
            setQuery('');
          }
        })
        .catch(() => setProducts([]));

      const trimmed = query.trim();
      if (/^\d{6,}$/.test(trimmed)) {
        api
          .get<Product>(`/products/lookup/${trimmed}`)
          .then((product) => {
            handleTileClick(product);
            setQuery('');
          })
          .catch(() => {
            // not a known barcode — the name-search grid above still applies
          });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryId]);

  function handleSearchEnter() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const skuMatch = products.find((p) => p.sku.toLowerCase() === trimmed.toLowerCase());
    if (skuMatch) {
      handleTileClick(skuMatch);
      setQuery('');
      return;
    }
    const params = new URLSearchParams();
    params.set('q', trimmed);
    params.set('take', '60');
    api
      .get<{ items: Product[] }>(`/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.items);
        const match = res.items.find((p) => p.sku.toLowerCase() === trimmed.toLowerCase());
        if (match) {
          handleTileClick(match);
          setQuery('');
        }
      })
      .catch(() => {});
  }

  const subtotal = useMemo(
    () => state.cart.reduce((acc, l) => acc + l.qtyInUnit * l.unitPrice, 0),
    [state.cart],
  );

  function handleTileClick(product: Product) {
    if (Number(product.stock) <= 0) setStockNotice(true);
    if (product.units.length === 1) {
      addUnitToCart(product, product.units[0]);
    } else {
      setUnitPickerFor(product);
    }
  }

  function addUnitToCart(product: Product, unit: ProductUnit) {
    addToCart({
      productId: product.id,
      productName: product.name,
      unitLabel: unit.label,
      unitFactor: Number(unit.factor),
      qtyInUnit: 1,
      unitPrice: Number(unit.price),
    });
    setUnitPickerFor(null);
  }

  return (
    <div className="h-full flex flex-col">
      <header className="h-11 flex items-center gap-3 px-4 border-b border-divider shrink-0">
        <button type="button" onClick={() => setDrawerOpen(true)} className="text-xl leading-none px-1" aria-label="Menyu">
          ☰
        </button>
        <span className="font-condensed font-bold">BarakaSELL</span>
        <OfflinePill pendingCount={state.pendingCount} />
        <span className="ml-auto text-sm text-text/70">{state.cashierName}</span>
      </header>

      {drawerOpen && <Drawer onClose={() => setDrawerOpen(false)} />}

      {stockNotice && (
        <div className="flex items-center justify-between px-4 py-2 bg-error-bg text-error-text text-sm border-b border-error-border">
          <span>Tovar qoldig'i tugagan — sotuv davom etadi.</span>
          <button type="button" onClick={() => setStockNotice(false)} className="font-bold px-2">
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchEnter();
            }}
            placeholder="Tovar nomi yoki shtrix-kod..."
            className="h-12 px-3 border border-divider bg-white"
          />
          <div className="flex gap-2 overflow-x-auto shrink-0 pb-1">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={`h-9 px-3 shrink-0 text-sm font-condensed font-semibold ${categoryId === null ? 'bg-accent text-white' : 'bg-surface'}`}
            >
              Hammasi
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`h-9 px-3 shrink-0 text-sm font-condensed font-semibold ${categoryId === c.id ? 'bg-accent text-white' : 'bg-surface'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 content-start">
            {products.map((product) => {
              const stock = Number(product.stock);
              const baseUnit = product.units.find((u) => u.isBase) ?? product.units[0];
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleTileClick(product)}
                  className="flex flex-col items-start gap-1 p-3 bg-surface text-left h-28"
                >
                  <span className="font-medium text-sm line-clamp-2">{product.name}</span>
                  {stock <= 0 ? (
                    <span className="text-xs border border-error-border text-error-text px-1">Tugagan · sotiladi</span>
                  ) : stock < LOW_STOCK_THRESHOLD ? (
                    <span className="text-xs border border-warning-border text-warning-text px-1">Kam qoldi</span>
                  ) : null}
                  <span className="mt-auto font-condensed font-bold">{baseUnit ? formatSom(baseUnit.price) : ''}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-[380px] shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-divider bg-white">
          <div className="flex-1 overflow-y-auto">
            {state.cart.length === 0 ? (
              <div className="p-6 text-center text-sm text-text/60">Savat bo'sh</div>
            ) : (
              state.cart.map((line, index) => (
                <div key={`${line.productId}-${line.unitLabel}`} className="flex items-center gap-2 px-3 py-2 border-b border-divider">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{line.productName}</div>
                    <div className="text-xs text-text/60">{line.unitLabel}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartLineQty(index, line.qtyInUnit - 1)}
                      className="h-8 w-8 bg-surface font-condensed font-bold"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLineIndex(index)}
                      className="min-w-10 text-center font-condensed font-semibold"
                    >
                      {formatQty(line.qtyInUnit)}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCartLineQty(index, line.qtyInUnit + 1)}
                      className="h-8 w-8 bg-surface font-condensed font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-20 text-right font-condensed font-semibold text-sm shrink-0">
                    {formatSom(line.qtyInUnit * line.unitPrice)}
                  </div>
                  <button type="button" onClick={() => removeCartLine(index)} className="text-error-text px-1 shrink-0">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-divider shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-condensed text-lg">JAMI</span>
              <span className="font-condensed text-2xl font-bold">{formatSom(subtotal)}</span>
            </div>
            <button
              type="button"
              disabled={state.cart.length === 0}
              onClick={goToPayment}
              className="w-full h-14 bg-accent text-white font-condensed font-semibold disabled:opacity-40"
            >
              TO'LOV
            </button>
          </div>
        </div>
      </div>

      {unitPickerFor && (
        <UnitPickerSheet
          product={unitPickerFor}
          onSelect={(unit) => addUnitToCart(unitPickerFor, unit)}
          onClose={() => setUnitPickerFor(null)}
        />
      )}

      {editingLineIndex !== null && (
        <NumericPadModal
          title="Miqdorni kiriting"
          initialValue={state.cart[editingLineIndex]?.qtyInUnit}
          allowDecimal
          onConfirm={(value) => {
            updateCartLineQty(editingLineIndex, value);
            setEditingLineIndex(null);
          }}
          onCancel={() => setEditingLineIndex(null)}
        />
      )}
    </div>
  );
}
