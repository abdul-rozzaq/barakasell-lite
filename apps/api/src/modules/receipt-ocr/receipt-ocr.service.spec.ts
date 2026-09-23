import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type OpenAI from 'openai';
import type { ConfigService } from '@nestjs/config';
import { ReceiptOcrService } from './receipt-ocr.service.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ProductsService } from '../catalog/products.service.js';

function fakeClient(content: string | null, shouldThrow = false): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          if (shouldThrow) throw new Error('network xatosi');
          return { choices: [{ message: { content } }] };
        }),
      },
    },
  } as unknown as OpenAI;
}

function fakeConfig(): ConfigService {
  return { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;
}

function fakePrisma(suppliers: { id: string; name: string }[] = []): PrismaService {
  return {
    supplier: { findMany: vi.fn().mockResolvedValue(suppliers) },
  } as unknown as PrismaService;
}

function img(content: string) {
  return { buffer: Buffer.from(content), mimeType: 'image/jpeg' };
}

function fakeProductsService(
  items: {
    id: string;
    name: string;
    sku: string;
    avgCost: number;
    units: { label: string; factor: number; isBase: boolean }[];
  }[],
): ProductsService {
  return {
    findAll: vi.fn().mockResolvedValue({ items, nextCursor: null }),
  } as unknown as ProductsService;
}

describe('ReceiptOcrService', () => {
  const product = {
    id: 'p1',
    name: 'Coca Cola 1.5L',
    sku: 'CC15',
    avgCost: 8000,
    units: [{ label: 'dona', factor: 1, isBase: true }],
  };

  it('parses a valid vision response and matches a known product', async () => {
    const client = fakeClient(
      JSON.stringify({
        supplierName: 'ABC Trade',
        lines: [{ rawName: 'Coca Cola 1.5L', qty: 10, unitLabel: 'dona', unitPrice: 8200, lineTotal: 82000 }],
      }),
    );
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([product]));

    const result = await service.parse([img('fake-image')]);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].status).toBe('matched');
    expect(result.lines[0].productId).toBe('p1');
    expect(result.lines[0].unitLabel).toBe('dona');
  });

  it('throws BadRequestException when the model returns malformed JSON', async () => {
    const client = fakeClient('not json');
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([]));

    await expect(service.parse([img('x')])).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the vision API call fails', async () => {
    const client = fakeClient(null, true);
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([]));

    await expect(service.parse([img('x')])).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no images are given', async () => {
    const client = fakeClient(null);
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([]));

    await expect(service.parse([])).rejects.toThrow(BadRequestException);
  });

  it('marks a line unmatched when no product is close enough', async () => {
    const client = fakeClient(
      JSON.stringify({ lines: [{ rawName: 'Butunlay boshqa narsa XYZ', qty: 1, unitPrice: 100 }] }),
    );
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([product]));

    const result = await service.parse([img('x')]);
    expect(result.lines[0].status).toBe('unmatched');
    expect(result.lines[0].productId).toBeNull();
  });

  it('sends every image as a separate content block in one request', async () => {
    const client = fakeClient(
      JSON.stringify({ lines: [{ rawName: 'Coca Cola 1.5L', qty: 1, unitPrice: 8000 }] }),
    );
    const service = new ReceiptOcrService(client, fakeConfig(), fakePrisma(), fakeProductsService([product]));

    await service.parse([img('page1'), img('page2'), img('page3')]);

    const call = (client.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const imageBlocks = call.messages[0].content.filter((c: { type: string }) => c.type === 'image_url');
    expect(imageBlocks).toHaveLength(3);
  });
});
