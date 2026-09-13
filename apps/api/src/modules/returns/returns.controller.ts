import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ReturnsService } from './returns.service.js';
import { CreateReturnDto } from './dto/create-return.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Post()
  @RequiresPinConfirmation()
  @Audit({ action: 'Qaytarish', entity: 'SaleReturn' })
  create(@Body() dto: CreateReturnDto, @CurrentUser() user: AuthUser) {
    return this.returnsService.create(dto, user);
  }
}
