import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name } });
  }
}
