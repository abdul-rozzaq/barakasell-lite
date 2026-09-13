import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react';
import { api, ApiError, getToken, setToken } from '../lib/api';
import { clearCart, countQueuedSales, enqueueSale, loadCart, saveCart } from '../lib/db';
import { setupAutoSync } from '../lib/offline-sync';
import { newIdempotencyKey } from '../lib/idempotency';
import type {
  CartLine,
  Customer,
  SalePayload,
  SaleResult,
  Screen,
  ShiftSummary,
  TenderDraft,
  TenderType,
} from './types';

interface AppState {
  booting: boolean;
  screen: Screen;
  cashierId: string | null;
  cashierName: string | null;
  shift: ShiftSummary | null;
  cart: CartLine[];
  customer: Customer | null;
  saleResult: SaleResult | null;
  pendingCount: number;
  returnPrefillCode: string | null;
}

const initialState: AppState = {
  booting: true,
  screen: 'login',
  cashierId: null,
  cashierName: null,
  shift: null,
  cart: [],
  customer: null,
  saleResult: null,
  pendingCount: 0,
  returnPrefillCode: null,
};

function reducer(state: AppState, patch: Partial<AppState>): AppState {
  return { ...state, ...patch };
}

interface RawSale {
  id: string;
  code: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  tenders: { type: TenderType; amount: string }[];
}

interface AppContextValue {
  state: AppState;
  login: (cashierId: string, pin: string) => Promise<void>;
  logout: () => void;
  openShift: (openingCash: number) => Promise<void>;
  refreshShift: () => Promise<void>;
  addToCart: (line: CartLine) => void;
  updateCartLineQty: (index: number, qtyInUnit: number) => void;
  removeCartLine: (index: number) => void;
  setCustomer: (customer: Customer | null) => void;
  checkout: (tenders: TenderDraft[]) => Promise<void>;
  startNewSale: () => void;
  goToPayment: () => void;
  backToSale: () => void;
  goTo: (screen: Screen) => void;
  openReturnsFor: (saleCode: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function persistCart(cart: CartLine[], customer: Customer | null) {
  void saveCart(cart, customer?.id ?? null);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    void bootstrap();

    async function bootstrap() {
      const token = getToken();
      const cartRecord = await loadCart();
      const pendingCount = await countQueuedSales();

      if (!token) {
        dispatch({ booting: false, cart: cartRecord?.lines ?? [], pendingCount });
        return;
      }

      try {
        const me = await api.get<{ id: string; name: string; role: string }>('/auth/me');
        if (me.role !== 'CASHIER') throw new ApiError('Kassir emas', 403);

        const shift = await api.get<ShiftSummary | null>('/shifts/current');
        let customer: Customer | null = null;
        if (cartRecord?.customerId) {
          customer = await api.get<Customer>(`/customers/${cartRecord.customerId}`).catch(() => null);
        }

        dispatch({
          booting: false,
          cashierId: me.id,
          cashierName: me.name,
          shift: shift ?? null,
          screen: shift ? 'sale' : 'shiftOpen',
          cart: cartRecord?.lines ?? [],
          customer,
          pendingCount,
        });

        setupAutoSync(() => {
          void countQueuedSales().then((count) => dispatch({ pendingCount: count }));
        });
      } catch {
        setToken(null);
        dispatch({ booting: false, screen: 'login' });
      }
    }
  }, []);

  const login = useCallback(async (cashierId: string, pin: string) => {
    const res = await api.post<{ accessToken: string; role: string }>('/auth/pin-login', {
      userId: cashierId,
      pin,
    });
    setToken(res.accessToken);

    const [me, shift] = await Promise.all([
      api.get<{ id: string; name: string }>('/auth/me'),
      api.get<ShiftSummary | null>('/shifts/current'),
    ]);

    dispatch({
      cashierId: me.id,
      cashierName: me.name,
      shift: shift ?? null,
      screen: shift ? 'sale' : 'shiftOpen',
    });

    setupAutoSync(() => {
      void countQueuedSales().then((count) => dispatch({ pendingCount: count }));
    });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    dispatch({
      screen: 'login',
      cashierId: null,
      cashierName: null,
      shift: null,
      customer: null,
      saleResult: null,
      returnPrefillCode: null,
    });
  }, []);

  // Re-reads expectedCash etc without touching navigation — used after a
  // return / cash movement / credit payment that affects the shift's cash
  // math. Login/bootstrap decide screen separately, on their own shift read.
  const refreshShift = useCallback(async () => {
    const shift = await api.get<ShiftSummary | null>('/shifts/current');
    dispatch({ shift: shift ?? null });
  }, []);

  const openShift = useCallback(async (openingCash: number) => {
    const shift = await api.post<ShiftSummary>('/shifts/open', { openingCash });
    dispatch({ shift, screen: 'sale' });
  }, []);

  const addToCart = useCallback(
    (line: CartLine) => {
      const existingIndex = state.cart.findIndex(
        (l) => l.productId === line.productId && l.unitLabel === line.unitLabel,
      );
      const next =
        existingIndex >= 0
          ? state.cart.map((l, i) =>
              i === existingIndex ? { ...l, qtyInUnit: l.qtyInUnit + line.qtyInUnit } : l,
            )
          : [...state.cart, line];
      dispatch({ cart: next });
      persistCart(next, state.customer);
    },
    [state.cart, state.customer],
  );

  const updateCartLineQty = useCallback(
    (index: number, qtyInUnit: number) => {
      const next = state.cart
        .map((l, i) => (i === index ? { ...l, qtyInUnit } : l))
        .filter((l) => l.qtyInUnit > 0);
      dispatch({ cart: next });
      persistCart(next, state.customer);
    },
    [state.cart, state.customer],
  );

  const removeCartLine = useCallback(
    (index: number) => {
      const next = state.cart.filter((_, i) => i !== index);
      dispatch({ cart: next });
      persistCart(next, state.customer);
    },
    [state.cart, state.customer],
  );

  const setCustomer = useCallback(
    (customer: Customer | null) => {
      dispatch({ customer });
      persistCart(state.cart, customer);
    },
    [state.cart],
  );

  const checkout = useCallback(
    async (tenders: TenderDraft[]) => {
      const payload: SalePayload = {
        lines: state.cart.map((l) => ({
          productId: l.productId,
          unitLabel: l.unitLabel,
          qtyInUnit: l.qtyInUnit,
          unitPrice: l.unitPrice,
        })),
        tenders,
        customerId: state.customer?.id,
      };
      const idempotencyKey = newIdempotencyKey();

      if (navigator.onLine) {
        try {
          const sale = await api.post<RawSale>('/sales', payload, {
            'Idempotency-Key': idempotencyKey,
          });
          await finishSale({
            id: sale.id,
            code: sale.code,
            total: sale.total,
            paidAmount: sale.paidAmount,
            changeAmount: sale.changeAmount,
            tenders: sale.tenders,
            pending: false,
          });
          return;
        } catch (err) {
          // A server-side rejection (bad request, insufficient stock, no open
          // shift, ...) must surface to the cashier, not silently queue.
          if (err instanceof ApiError) throw err;
          // Otherwise this was a network-level failure — fall through to the
          // offline queue below.
        }
      }

      await enqueueSale({ idempotencyKey, payload, createdAt: Date.now() });
      const pendingCount = await countQueuedSales();
      const total = tenders.reduce((acc, t) => acc + t.amount, 0);
      await finishSale({
        id: idempotencyKey,
        code: `#kutilmoqda-${idempotencyKey.slice(0, 8)}`,
        total: String(total),
        paidAmount: String(total),
        changeAmount: '0',
        tenders: tenders.map((t) => ({ type: t.type, amount: String(t.amount) })),
        pending: true,
      });
      dispatch({ pendingCount });

      async function finishSale(result: SaleResult) {
        await clearCart();
        dispatch({ cart: [], customer: null, saleResult: result, screen: 'saleComplete' });
      }
    },
    [state.cart, state.customer],
  );

  const startNewSale = useCallback(() => {
    dispatch({ saleResult: null, screen: 'sale' });
  }, []);

  const goToPayment = useCallback(() => {
    dispatch({ screen: 'payment' });
  }, []);

  const backToSale = useCallback(() => {
    dispatch({ screen: 'sale' });
  }, []);

  const goTo = useCallback((screen: Screen) => {
    dispatch({ screen });
  }, []);

  const openReturnsFor = useCallback((saleCode: string | null) => {
    dispatch({ returnPrefillCode: saleCode, screen: 'returns' });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        login,
        logout,
        openShift,
        refreshShift,
        addToCart,
        updateCartLineQty,
        removeCartLine,
        setCustomer,
        checkout,
        startNewSale,
        goToPayment,
        backToSale,
        goTo,
        openReturnsFor,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp AppProvider ichida ishlatilishi kerak');
  return ctx;
}
