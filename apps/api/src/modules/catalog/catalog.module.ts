import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductUnitsController } from './product-units.controller.js';
import { BarcodesController } from './barcodes.controller.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController, ProductUnitsController, BarcodesController, CategoriesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class CatalogModule {}
