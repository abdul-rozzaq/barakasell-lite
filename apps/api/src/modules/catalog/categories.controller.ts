import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Prisma } from '../../generated/prisma/client.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: { name: dto.name } });
    } catch (err) {
      throw this.mapUniqueViolation(err);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    try {
      return await this.prisma.category.update({ where: { id }, data: { name: dto.name } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Kategoriya topilmadi');
      }
      throw this.mapUniqueViolation(err);
    }
  }

  @Delete(':id')
  @Audit({ action: "O'chirish", entity: 'Category' })
  async remove(@Param('id') id: string) {
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        `Bu kategoriyada ${productCount} ta tovar bor, avval ularni boshqa kategoriyaga o'tkazing`,
      );
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Kategoriya topilmadi');
      }
      throw err;
    }
  }

  private mapUniqueViolation(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException('Bu nomli kategoriya allaqachon mavjud');
    }
    return err as Error;
  }
}
