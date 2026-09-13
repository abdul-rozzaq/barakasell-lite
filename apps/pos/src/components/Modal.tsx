import type { ReactNode } from 'react';
import { CornerMarks } from './CornerMarks';

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="relative bg-white p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CornerMarks />
        {children}
      </div>
    </div>
  );
}
