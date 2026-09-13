import { Controller, Delete, Param } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('barcodes')
export class BarcodesController {
  constructor(private readonly productsService: ProductsService) {}

  @Delete(':id')
  @RequiresPinConfirmation()
  @Audit({ action: 'O\'chirish', entity: 'Barcode' })
  remove(@Param('id') id: string) {
    return this.productsService.removeBarcode(id);
  }
}
