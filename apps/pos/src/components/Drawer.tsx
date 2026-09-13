import { useApp } from '../state/app-context';
import type { Screen } from '../state/types';

const ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'salesToday', label: 'Bugungi sotuvlar' },
  { screen: 'returns', label: 'Qaytarish' },
  { screen: 'cashMovement', label: 'Kassa harakati' },
  { screen: 'creditCustomers', label: 'Nasiya mijozlari' },
  { screen: 'shiftClose', label: 'Smenani yopish' },
];

export function Drawer({ onClose }: { onClose: () => void }) {
  const { goTo, openReturnsFor } = useApp();

  function select(screen: Screen) {
    if (screen === 'returns') openReturnsFor(null);
    else goTo(screen);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="w-72 bg-white h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-11 flex items-center px-4 border-b border-divider font-condensed font-bold">
          BarakaSELL
        </div>
        <nav className="flex-1">
          {ITEMS.map((item) => (
            <button
              key={item.screen}
              type="button"
              onClick={() => select(item.screen)}
              className="w-full text-left px-4 h-12 border-b border-divider hover:bg-surface"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 bg-black/40" />
    </div>
  );
}
