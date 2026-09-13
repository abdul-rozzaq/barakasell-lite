import { useState } from 'react';
import { Modal } from './Modal';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
}

export function NumericKeypad({ value, onChange, allowDecimal = true }: NumericKeypadProps) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }
    onChange(`${value}${key}`);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="h-14 text-xl font-condensed font-semibold bg-surface active:bg-divider"
        >
          {key}
        </button>
      ))}
    </div>
  );
}

interface NumericPadModalProps {
  title: string;
  initialValue?: number;
  allowDecimal?: boolean;
  confirmLabel?: string;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}

// Reusable modal used for cart qty edits and payment tender amounts — the
// numeric-entry gate for every money/qty field per the design handoff
// ("never rely on the OS keyboard for money/qty fields").
export function NumericPadModal({
  title,
  initialValue,
  allowDecimal = false,
  confirmLabel = 'Tasdiqlash',
  onConfirm,
  onCancel,
}: NumericPadModalProps) {
  const [value, setValue] = useState(initialValue !== undefined && initialValue > 0 ? String(initialValue) : '');

  return (
    <Modal onClose={onCancel}>
      <div className="font-condensed text-lg font-semibold mb-3">{title}</div>
      <div className="text-right text-3xl font-condensed font-bold mb-4 h-10 truncate">{value || '0'}</div>
      <NumericKeypad value={value} onChange={setValue} allowDecimal={allowDecimal} />
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 h-11 border border-divider text-sm">
          Bekor qilish
        </button>
        <button
          type="button"
          onClick={() => onConfirm(Number(value) || 0)}
          className="flex-1 h-11 bg-accent text-white font-condensed font-semibold text-sm"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
