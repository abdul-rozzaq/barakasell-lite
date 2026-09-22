import { ApiClient } from '../../api/api.client.js';
import type { ToolSet } from '../tool.types.js';

// Read-only reporting proxies to ReportsService via /bot/reports/* — same
// numbers the admin dashboard shows, just phrased as a chat answer. No
// tool here can change a price, void a sale, or move stock.
export function ownerTools(api: ApiClient): ToolSet {
  const defs: ToolSet['defs'] = [
    {
      type: 'function',
      function: {
        name: 'sales_summary',
        description:
          "Sotuv/foyda xulosasi. Sana berilmasa bugungi kun (tushum, foyda, kassa farqi, ochiq smenalar) qaytariladi.",
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'ISO sana, masalan 2026-09-01' },
            to: { type: 'string', description: 'ISO sana' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'top_products',
        description: "Bugun eng ko'p sotilgan 5 ta tovar.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'low_stock',
        description: "Qoldig'i kam bo'lgan tovarlar ro'yxati.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'dead_stock',
        description: "Ko'rsatilgan kun ichida sotilmagan tovarlar ro'yxati.",
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Standart 30' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'profit',
        description: "Foyda-zarar hisoboti, kesim bo'yicha (kun/tovar/kategoriya).",
        parameters: {
          type: 'object',
          properties: {
            groupBy: { type: 'string', enum: ['period', 'product', 'category'] },
            from: { type: 'string', description: 'ISO sana' },
            to: { type: 'string', description: 'ISO sana' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_shifts',
        description: "Hozir ochiq turgan barcha smenalar.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'demand_report',
        description:
          "Mijozlar ko'p so'ragan, lekin qoldig'i tugagan tovarlar ro'yxati — xarid rejasi uchun.",
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Necha kunlik so\'rovlar hisobga olinsin, standart 30' },
          },
        },
      },
    },
  ];

  const handlers: ToolSet['handlers'] = {
    async sales_summary(args) {
      const params = new URLSearchParams();
      if (args.from) params.set('from', String(args.from));
      if (args.to) params.set('to', String(args.to));
      return api.get(`/bot/reports/sales-summary?${params.toString()}`);
    },

    async top_products() {
      return api.get('/bot/reports/top-products');
    },

    async low_stock() {
      return api.get('/bot/reports/low-stock');
    },

    async dead_stock(args) {
      const days = typeof args.days === 'number' ? args.days : 30;
      return api.get(`/bot/reports/dead-stock?days=${days}`);
    },

    async profit(args) {
      const params = new URLSearchParams({ groupBy: String(args.groupBy ?? 'period') });
      if (args.from) params.set('from', String(args.from));
      if (args.to) params.set('to', String(args.to));
      return api.get(`/bot/reports/profit?${params.toString()}`);
    },

    async open_shifts() {
      return api.get('/bot/reports/open-shifts');
    },

    async demand_report(args) {
      const days = typeof args.days === 'number' ? args.days : 30;
      return api.get(`/bot/reports/demand?days=${days}`);
    },
  };

  return { defs, handlers };
}
