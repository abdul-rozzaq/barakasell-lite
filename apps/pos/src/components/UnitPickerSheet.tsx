import type { Product, ProductUnit } from '../state/types';
import { formatSom } from '../lib/format';

interface UnitPickerSheetProps {
  product: Product;
  onSelect: (unit: ProductUnit) => void;
  onClose: () => void;
}

export function UnitPickerSheet({ product, onSelect, onClose }: UnitPickerSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white w-full max-w-md p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-condensed text-lg font-semibold mb-3">{product.name}</div>
        <div className="flex flex-col gap-2">
          {product.units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => onSelect(unit)}
              className="flex items-center justify-between h-14 px-4 border border-divider text-left"
            >
              <span>{unit.label}</span>
              <span className="font-condensed font-semibold">{formatSom(unit.price)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
