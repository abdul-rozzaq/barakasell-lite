import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductsService, type StockFilter } from './products.service.js';
import { StockService } from '../inventory/stock.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductUnitDto } from './dto/product-unit.dto.js';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto.js';
import { CreateBarcodeDto } from './dto/create-barcode.dto.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
  ) {}

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('stockFilter') stockFilter?: StockFilter,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.productsService.findAll({ q, categoryId, stockFilter, cursor, take: take ? Number(take) : undefined });
  }

  @Get('lookup/:barcode')
  lookup(@Param('barcode') barcode: string) {
    return this.productsService.lookupByBarcode(barcode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/movements')
  movements(@Param('id') id: string) {
    return this.stockService.movementsForProduct(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequiresPinConfirmation()
  @Audit({ action: 'O\'chirish', entity: 'Product' })
  archive(@Param('id') id: string) {
    return this.productsService.archive(id);
  }

  @Post(':id/units')
  addUnit(@Param('id') id: string, @Body() dto: ProductUnitDto) {
    return this.productsService.addUnit(id, dto);
  }

  @Post(':id/barcodes')
  addBarcode(@Param('id') id: string, @Body() dto: CreateBarcodeDto) {
    return this.productsService.addBarcode(id, dto.code);
  }

  @Post(':id/barcodes/generate')
  generateBarcode(@Param('id') id: string) {
    return this.productsService.generateBarcode(id);
  }
}
