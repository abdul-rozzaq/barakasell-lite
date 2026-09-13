// EAN-13 internal/in-store range starts with "20"-"29" per GS1 convention.
const INTERNAL_PREFIX = '29';

export function computeEan13CheckDigit(first12Digits: string): number {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new Error('EAN-13 checksum uchun aynan 12 raqam kerak');
  }
  const sum = first12Digits
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function generateInternalBarcode(): string {
  const body = Math.floor(Math.random() * 1e10)
    .toString()
    .padStart(10, '0');
  const first12 = INTERNAL_PREFIX + body;
  return first12 + computeEan13CheckDigit(first12);
}
