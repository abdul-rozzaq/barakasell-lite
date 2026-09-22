export type Screen =
  | 'login'
  | 'shiftOpen'
  | 'sale'
  | 'payment'
  | 'saleComplete'
  | 'salesToday'
  | 'returns'
  | 'cashMovement'
  | 'shiftClose'
  | 'creditCustomers';

export interface Cashier {
  id: string;
  name: string;
}

export interface ProductUnit {
  id: string;
  label: string;
  factor: string;
  price: string;
  discountAmount: string;
  isBase: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  baseUnitLabel: string;
  stock: string;
  categoryId: string | null;
  units: ProductUnit[];
}

export interface Category {
  id: string;
  name: string;
}

export interface CartLine {
  productId: string;
  productName: string;
  unitLabel: string;
  unitFactor: number;
  qtyInUnit: number;
  unitPrice: number;
  discountAmount: number;
}

export type TenderType = 'CASH' | 'CARD' | 'CLICK' | 'CREDIT';

export interface TenderDraft {
  type: TenderType;
  amount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  debtBalance: string;
  cardCode?: string | null;
  pointsBalance?: number;
}

export interface ShiftSummary {
  id: string;
  openingCash: string;
  expectedCash: string;
}

export interface CashMovementEntry {
  id: string;
  type: 'IN' | 'OUT';
  amount: string;
  reason: string;
  createdAt: string;
}

export interface ShiftDetail extends ShiftSummary {
  cashMoves: CashMovementEntry[];
}

export interface SaleLineDetail {
  id: string;
  productId: string;
  productName: string;
  unitLabel: string;
  qtyBase: string;
  unitPrice: string;
  unitDiscountAmount: string;
  lineTotal: string;
  returnedQtyBase: string;
}

export interface SaleDetail {
  id: string;
  code: string;
  soldAt: string;
  total: string;
  subtotal: string;
  discountAmount: string;
  lines: SaleLineDetail[];
  tenders: { type: TenderType; amount: string }[];
}

export interface SaleLinePayload {
  productId: string;
  unitLabel: string;
  qtyInUnit: number;
  unitPrice: number;
}

export interface SalePayload {
  lines: SaleLinePayload[];
  tenders: TenderDraft[];
  customerId?: string;
  discountAmount?: number;
}

export interface SaleResult {
  id: string;
  code: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  tenders: { type: TenderType; amount: string }[];
  pending: boolean;
}
