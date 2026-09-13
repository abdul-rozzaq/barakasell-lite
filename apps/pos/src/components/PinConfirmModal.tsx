import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { NumericKeypad } from './NumericPad';
import { api } from '../lib/api';

interface PinConfirmModalProps {
  title?: string;
  onConfirmed: (confirmationToken: string) => void;
  onCancel: () => void;
}

// The generic "re-enter your own PIN" gate before a sensitive action
// (return, cash movement) — see design handoff's PIN reconfirmation modal.
export function PinConfirmModal({ title = 'PIN tasdiqlang', onConfirmed, onCancel }: PinConfirmModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    api
      .post<{ confirmationToken: string }>('/auth/confirm-pin', { pin })
      .then((res) => onConfirmed(res.confirmationToken))
      .catch(() => {
        setError(true);
        setTimeout(() => {
          setError(false);
          setPin('');
        }, 450);
      })
      .finally(() => setBusy(false));
  }, [pin, busy, onConfirmed]);

  return (
    <Modal onClose={onCancel}>
      <div className="font-condensed text-lg font-semibold mb-3 text-center">{title}</div>
      <div className="flex justify-center gap-3 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 border border-divider ${i < pin.length ? 'bg-accent' : 'bg-white'}`} />
        ))}
      </div>
      <div className="h-5 text-sm text-error-text text-center">{error ? "Noto'g'ri PIN kod" : ''}</div>
      <NumericKeypad value={pin} onChange={(v) => setPin(v.slice(0, 4))} allowDecimal={false} />
      <button type="button" onClick={onCancel} className="w-full h-10 border border-divider text-sm mt-3">
        Bekor qilish
      </button>
    </Modal>
  );
}
