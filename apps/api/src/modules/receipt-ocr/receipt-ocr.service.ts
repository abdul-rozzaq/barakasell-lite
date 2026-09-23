import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ProductsService } from '../catalog/products.service.js';
import { OPENAI_CLIENT } from './openai.provider.js';
import {
  matchLine,
  priceWarnings,
  resolveUnit,
  scoreMatch,
  type MatchableProduct,
  type MatchStatus,
} from './ocr-match.util.js';

const REQUEST_TIMEOUT_MS = 60_000;
// A shop like this rarely carries more than a few hundred active SKUs — one
// bounded scan (a handful of cursor pages) is simpler than per-line queries
// and matches the "JS reduce is enough at this scale" call made elsewhere
// (see ReportsService).
const MAX_PRODUCTS_SCANNED = 1000;
const PRODUCTS_PAGE_SIZE = 200;
const SUPPLIER_MATCH_THRESHOLD = 0.6;

interface RawOcrLine {
  rawName: string;
  qty: number;
  unitLabel?: string;
  unitPrice: number;
  lineTotal?: number;
}

interface RawOcrResult {
  supplierName?: string;
  lines: RawOcrLine[];
}

export interface OcrReceiptLine {
  rawName: string;
  qty: number;
  productId: string | null;
  productName: string | null;
  unitLabel: string;
  unitCostPack: number;
  status: MatchStatus;
  candidates: { productId: string; name: string; sku: string; score: number }[];
  warnings: string[];
}

export interface OcrReceiptResult {
  supplierName: string | null;
  supplierId: string | null;
  lines: OcrReceiptLine[];
}

export interface OcrImage {
  buffer: Buffer;
  mimeType: string;
}

const PROMPT = `Sen yetkazib beruvchi faktura/накладной rasmini o'qiydigan yordamchisan.
Rasmdagi HAR bir tovar qatorini chiqar. Faqat quyidagi JSON shaklida javob ber, boshqa matn yozma:

{
  "supplierName": "faktura yuqorisidagi yetkazib beruvchi nomi, topilmasa null",
  "lines": [
    {
      "rawName": "tovar nomi — QOIDA pastda",
      "qty": <son>,
      "unitLabel": "birlik (dona/karobka/pachka va h.k.), aniq bo'lmasa null",
      "unitPrice": <bitta birlik narxi, so'mda>,
      "lineTotal": <qator jami summasi, mavjud bo'lsa; aks holda null>
    }
  ]
}

"rawName" QOIDASI — MUHIM: bizning tovar katalogimizdagi barcha nomlar LOTIN
alifbosida yozilgan. Agar faktura rasmida tovar nomi KIRILL alifbosida yoki
ruscha bo'lsa, uni albatta LOTIN alifbosiga o'gir:
- Xalqaro brend nomlari uchun ularning asl (haqiqiy) lotincha yozilishini
  ishlat, harf-baharf transliteratsiya EMAS — masalan "Кока-Кола" -> "Coca-Cola",
  "Фанта" -> "Fanta", "Спрайт" -> "Sprite", "Пепси" -> "Pepsi".
- Oddiy so'zlar (masalan umumiy tovar tavsifi) uchun standart o'zbekcha
  kirill->lotin transliteratsiyasini ishlat (masalan "гуруч" -> "guruch",
  "ёғ" -> "yog'", "қанд" -> "qand").
Rasmda allaqachon lotin alifbosida bo'lsa, o'zgartirmasdan shundayligicha yoz.

Raqamlarni aniq o'qi, taxmin qilma. Agar biror qator noaniq bo'lsa, baribir eng yaxshi taxminingni yoz —
uni keyin inson tekshiradi.`;

const MULTI_PAGE_NOTE =
  "Diqqat: senga bir nechta rasm berilgan — bularning barchasi BITTA fakturaning turli sahifalari yoki " +
  "qismlari. Barcha rasmlardagi tovar qatorlarini BITTA umumiy ro'yxatga yig'. Agar bir xil qator bir necha " +
  "rasmda takrorlangan bo'lsa (masalan sahifa chegarasida), uni faqat BIR MARTA hisobga ol.\n\n";

@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {
    this.model = this.config.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o';
  }

  async parse(images: OcrImage[]): Promise<OcrReceiptResult> {
    if (images.length === 0) throw new BadRequestException('Fayl yuborilmadi');
    const raw = await this.withTimeout(this.callVisionModel(images), REQUEST_TIMEOUT_MS);
    const [products, suppliers] = await Promise.all([this.loadActiveProducts(), this.loadSuppliers()]);

    const supplierMatch = raw.supplierName ? this.matchSupplier(raw.supplierName, suppliers) : null;

    return {
      supplierName: raw.supplierName ?? null,
      supplierId: supplierMatch?.id ?? null,
      lines: raw.lines.map((line) => this.resolveLine(line, products)),
    };
  }

  private async callVisionModel(images: OcrImage[]): Promise<RawOcrResult> {
    let completion;
    try {
      completion = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image_url' as const,
                image_url: { url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}` },
              })),
              { type: 'text' as const, text: images.length > 1 ? MULTI_PAGE_NOTE + PROMPT : PROMPT },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.error('OCR vision chaqiruvi xatosi', err instanceof Error ? err.stack : err);
      throw new BadRequestException('Rasmni o\'qib bo\'lmadi, qayta urinib ko\'ring');
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new BadRequestException("Rasmdan ma'lumot chiqmadi");

    return this.parseRawResult(content);
  }

  private parseRawResult(content: string): RawOcrResult {
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new BadRequestException("AI javobini o'qib bo'lmadi");
    }

    if (typeof json !== 'object' || json === null || !Array.isArray((json as Record<string, unknown>).lines)) {
      throw new BadRequestException("AI javobi noto'g'ri formatda");
    }

    const obj = json as Record<string, unknown>;
    const lines: RawOcrLine[] = (obj.lines as unknown[])
      .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
      .map((l) => ({
        rawName: typeof l.rawName === 'string' ? l.rawName : "Noma'lum tovar",
        qty: typeof l.qty === 'number' && l.qty > 0 ? l.qty : 0,
        unitLabel: typeof l.unitLabel === 'string' ? l.unitLabel : undefined,
        unitPrice: typeof l.unitPrice === 'number' && l.unitPrice >= 0 ? l.unitPrice : 0,
        lineTotal: typeof l.lineTotal === 'number' ? l.lineTotal : undefined,
      }))
      .filter((l) => l.qty > 0);

    if (lines.length === 0) {
      throw new BadRequestException('Rasmda tovar qatorlari topilmadi');
    }

    return {
      supplierName: typeof obj.supplierName === 'string' ? obj.supplierName : undefined,
      lines,
    };
  }

  private resolveLine(line: RawOcrLine, products: MatchableProduct[]): OcrReceiptLine {
    const { status, candidates } = matchLine(line.rawName, products);
    const best = candidates[0] && status !== 'unmatched' ? products.find((p) => p.id === candidates[0].productId) : undefined;

    const unit = best ? resolveUnit(line.unitLabel, best.units) : undefined;
    const factor = unit ? Number(unit.factor) : 1;
    const unitCostBase = factor > 0 ? line.unitPrice / factor : line.unitPrice;

    const warnings = best
      ? priceWarnings({
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          unitCostBase,
          avgCost: Number(best.avgCost),
        })
      : [];

    return {
      rawName: line.rawName,
      qty: line.qty,
      productId: best?.id ?? null,
      productName: best?.name ?? null,
      unitLabel: unit?.label ?? line.unitLabel ?? '',
      unitCostPack: line.unitPrice,
      status,
      candidates,
      warnings,
    };
  }

  private matchSupplier(
    rawName: string,
    suppliers: { id: string; name: string }[],
  ): { id: string } | null {
    let best: { id: string; score: number } | null = null;
    for (const supplier of suppliers) {
      const score = scoreMatch(rawName, supplier.name);
      if (!best || score > best.score) best = { id: supplier.id, score };
    }
    return best && best.score >= SUPPLIER_MATCH_THRESHOLD ? { id: best.id } : null;
  }

  private async loadActiveProducts(): Promise<MatchableProduct[]> {
    const products: MatchableProduct[] = [];
    let cursor: string | undefined;
    while (products.length < MAX_PRODUCTS_SCANNED) {
      const page = await this.productsService.findAll({ take: PRODUCTS_PAGE_SIZE, cursor });
      products.push(
        ...page.items.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          avgCost: p.avgCost as unknown as number,
          units: p.units.map((u) => ({ label: u.label, factor: u.factor as unknown as number, isBase: u.isBase })),
        })),
      );
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return products;
  }

  private loadSuppliers() {
    return this.prisma.supplier.findMany({ select: { id: true, name: true } });
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new BadRequestException('OCR javob berish vaqti tugadi')), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}
