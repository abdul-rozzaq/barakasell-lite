import { BotService } from '../../../bot/bot.service.js';
import type { ToolSet } from '../tool.types.js';

// Read-only reporting proxies to BotService (which itself wraps
// ReportsService/ProductsService) — same numbers the admin dashboard
// shows, just phrased as a chat answer. No tool here can change a price,
// void a sale, or move stock.
export function ownerTools(botService: BotService): ToolSet {
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
            days: { type: 'number', description: "Necha kunlik so'rovlar hisobga olinsin, standart 30" },
          },
        },
      },
    },
  ];

  const handlers: ToolSet['handlers'] = {
    async sales_summary(args) {
      const from = args.from ? new Date(String(args.from)) : undefined;
      const to = args.to ? new Date(String(args.to)) : undefined;
      return botService.salesSummary(from, to);
    },

    async top_products() {
      return botService.topProducts();
    },

    async low_stock() {
      return botService.lowStock();
    },

    async dead_stock(args) {
      const days = typeof args.days === 'number' ? args.days : 30;
      return botService.deadStock(days);
    },

    async profit(args) {
      const groupBy = (args.groupBy as 'period' | 'product' | 'category' | undefined) ?? 'period';
      const from = args.from ? new Date(String(args.from)) : undefined;
      const to = args.to ? new Date(String(args.to)) : undefined;
      return botService.profit(groupBy, from, to);
    },

    async open_shifts() {
      return botService.openShifts();
    },

    async demand_report(args) {
      const days = typeof args.days === 'number' ? args.days : 30;
      return botService.demand(days);
    },
  };

  return { defs, handlers };
}
