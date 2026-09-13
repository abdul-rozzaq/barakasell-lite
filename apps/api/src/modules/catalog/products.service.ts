import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductUnitDto } from './dto/product-unit.dto.js';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto.js';
import { generateInternalBarcode } from './barcode.util.js';

// Below this base-unit qty a product is flagged "kam qoldi" in list views.
// Not a business rule from plan.md — a UI affordance, tune freely per store.
const LOW_STOCK_THRESHOLD = 10;

export type StockFilter = 'all' | 'low' | 'out';

const PRODUCT_INCLUDE = {
  category: true,
  units: { orderBy: { sortOrder: 'asc' } },
  barcodes: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    q?: string;
    categoryId?: string;
    stockFilter?: StockFilter;
    cursor?: string;
    take?: number;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      OR: params.q
        ? [
            { name: { contains: params.q, mode: 'insensitive' } },
            { sku: { contains: params.q, mode: 'insensitive' } },
          ]
        : undefined,
      categoryId: params.categoryId,
      stock:
        params.stockFilter === 'out'
          ? { lte: 0 }
          : params.stockFilter === 'low'
            ? { gt: 0, lt: LOW_STOCK_THRESHOLD }
            : undefined,
    };

    if (params.page !== undefined) {
      const page = Math.max(1, params.page);
      const limit = Math.min(params.limit ?? params.take ?? 50, 200);
      const skip = (page - 1) * limit;

      const [total, items] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          include: PRODUCT_INCLUDE,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        nextCursor: items.length > 0 ? items[items.length - 1].id : null,
      };
    }

    const take = Math.min(params.take ?? 50, 200);
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        take: take + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = items.length > take;
    const pageItems = hasMore ? items.slice(0, take) : items;
    return {
      items: pageItems,
      total,
      nextCursor: hasMore ? pageItems[pageItems.length - 1].id : null,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Tovar topilmadi');
    return product;
  }

  async lookupByBarcode(code: string) {
    const barcode = await this.prisma.barcode.findUnique({
      where: { code },
      include: { product: { include: PRODUCT_INCLUDE } },
    });
    if (!barcode) throw new NotFoundException('Barcode topilmadi');
    return barcode.product;
  }

  async create(dto: CreateProductDto) {
    this.assertExactlyOneBaseUnit(dto.units);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: dto.sku,
            name: dto.name,
            categoryId: dto.categoryId,
            baseUnitLabel: dto.units.find((u) => u.isBase)!.label,
          },
        });

        await tx.productUnit.createMany({
          data: dto.units.map((u, index) => ({
            productId: product.id,
            label: u.label,
            factor: u.factor,
            price: u.price,
            isBase: Boolean(u.isBase),
            sortOrder: index,
          })),
        });

        if (dto.barcodes?.length) {
          await tx.barcode.createMany({
            data: dto.barcodes.map((code) => ({ code, productId: product.id })),
          });
        }

        return tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: PRODUCT_INCLUDE,
        });
      });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: PRODUCT_INCLUDE,
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addUnit(productId: string, dto: ProductUnitDto) {
    await this.findOne(productId);
    if (dto.isBase) {
      throw new BadRequestException(
        'Baza birlik faqat tovar yaratishda belgilanadi',
      );
    }
    const count = await this.prisma.productUnit.count({ where: { productId } });
    try {
      return await this.prisma.productUnit.create({
        data: { productId, label: dto.label, factor: dto.factor, price: dto.price, sortOrder: count },
      });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async updateUnit(unitId: string, dto: UpdateProductUnitDto) {
    const unit = await this.prisma.productUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Birlik topilmadi');
    if (unit.isBase && dto.factor !== undefined && Number(dto.factor) !== 1) {
      throw new BadRequestException('Baza birlik factor qiymati 1 bo\'lishi shart');
    }
    try {
      return await this.prisma.productUnit.update({ where: { id: unitId }, data: dto });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  async removeUnit(unitId: string) {
    const unit = await this.prisma.productUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Birlik topilmadi');
    if (unit.isBase) {
      throw new BadRequestException('Baza birlikni o\'chirib bo\'lmaydi');
    }
    await this.prisma.productUnit.delete({ where: { id: unitId } });
  }

  async addBarcode(productId: string, code: string) {
    await this.findOne(productId);
    try {
      return await this.prisma.barcode.create({ data: { productId, code } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const owner = await this.prisma.barcode.findUnique({
          where: { code },
          include: { product: { select: { name: true } } },
        });
        throw new ConflictException(
          owner
            ? `Bu barcode "${owner.product.name}" tovariga tegishli`
            : 'Bu barcode allaqachon mavjud',
        );
      }
      throw err;
    }
  }

  async generateBarcode(productId: string) {
    await this.findOne(productId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInternalBarcode();
      try {
        return await this.prisma.barcode.create({
          data: { productId, code, isInternal: true },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
      }
    }
    throw new ConflictException('Ichki barcode generatsiya qilinmadi, qayta urinib ko\'ring');
  }

  async removeBarcode(barcodeId: string) {
    const barcode = await this.prisma.barcode.findUnique({ where: { id: barcodeId } });
    if (!barcode) throw new NotFoundException('Barcode topilmadi');
    await this.prisma.barcode.delete({ where: { id: barcodeId } });
  }

  private assertExactlyOneBaseUnit(units: ProductUnitDto[]) {
    const baseUnits = units.filter((u) => u.isBase);
    if (baseUnits.length !== 1) {
      throw new BadRequestException('Aynan bitta baza birlik (isBase) belgilanishi kerak');
    }
    if (Number(baseUnits[0].factor) !== 1) {
      throw new BadRequestException('Baza birlik factor qiymati 1 bo\'lishi shart');
    }
  }

  private mapUniqueViolation(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      return new ConflictException(`Dublikat qiymat: ${target ?? 'unique maydon'}`);
    }
    return err as Error;
  }
}
