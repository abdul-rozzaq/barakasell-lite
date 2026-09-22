import { ApiClient } from '../../api/api.client.js';
import type { ToolSet } from '../tool.types.js';

interface ProductSearchResult {
  name: string;
  price: string | null;
  inStock: boolean;
}

// Read-only except for request_product: the agent never places a sale,
// applies a discount, or moves money — those stay cashier/PIN-gated
// actions in the physical store. request_product only records a wish; the
// customer is notified automatically once a matching receipt is posted
// (see ReceiptsService.post() -> WaitlistService.notifyArrivals()).
export function customerTools(api: ApiClient, customerId: string): ToolSet {
  const defs: ToolSet['defs'] = [
    {
      type: 'function',
      function: {
        name: 'search_products',
        description:
          "Do'kondagi tovarni nomi yoki qismi bo'yicha qidiradi, narxi va sotuvda bor-yo'qligini qaytaradi.",
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: "Tovar nomi yoki uning bir qismi" },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_loyalty_balance',
        description: "Mijozning joriy loyalty ball balansini qaytaradi.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_my_debt',
        description: "Mijozning joriy nasiya (qarz) balansini qaytaradi.",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_my_purchases',
        description: "Mijozning so'nggi xaridlari ro'yxatini qaytaradi.",
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: "Nechta xarid qaytarilsin (standart 10)" },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_product',
        description:
          "search_products topolmagan yoki qoldig'i yo'q tovar uchun so'rov yozadi — tovar kelganda mijozga " +
          "avtomatik xabar boradi. Faqat mijoz aniq shu tovarni so'rasa chaqiring, o'zingiz taklif qilmang.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: "Mijoz so'ragan tovar nomi" },
          },
          required: ['productName'],
        },
      },
    },
  ];

  const handlers: ToolSet['handlers'] = {
    async search_products(args) {
      const query = String(args.query ?? '');
      const items = await api.get<ProductSearchResult[]>(
        `/bot/products/search?q=${encodeURIComponent(query)}`,
      );
      return items.map((i) => ({ name: i.name, price: i.price, inStock: i.inStock }));
    },

    async get_loyalty_balance() {
      const loyalty = await api.get<{ pointsBalance: number }>(`/bot/customers/${customerId}/loyalty`);
      return { pointsBalance: loyalty.pointsBalance };
    },

    async get_my_debt() {
      return api.get<{ debtBalance: string }>(`/bot/customers/${customerId}/debt`);
    },

    async get_my_purchases(args) {
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      return api.get(`/bot/customers/${customerId}/purchases?limit=${limit}`);
    },

    async request_product(args) {
      const rawText = String(args.productName ?? '');
      await api.post(`/bot/customers/${customerId}/waitlist`, { rawText });
      return { ok: true, message: "So'rovingiz qabul qilindi, tovar kelganda xabar beramiz." };
    },
  };

  return { defs, handlers };
}
