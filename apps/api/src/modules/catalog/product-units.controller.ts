import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('product-units')
export class ProductUnitsController {
  constructor(private readonly productsService: ProductsService) {}

  @Patch(':id')
  @Audit({ action: 'Narx o\'zgartirdi', entity: 'ProductUnit' })
  update(@Param('id') id: string, @Body() dto: UpdateProductUnitDto) {
    return this.productsService.updateUnit(id, dto);
  }

  @Delete(':id')
  @Audit({ action: 'O\'chirish', entity: 'ProductUnit' })
  remove(@Param('id') id: string) {
    return this.productsService.removeUnit(id);
  }
}
