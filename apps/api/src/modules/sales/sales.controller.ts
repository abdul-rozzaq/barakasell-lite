import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { SyncSalesDto } from './dto/sync-sales.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequiresTotp } from '../../common/totp/requires-totp.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shiftId') shiftId?: string,
    @Query('customerId') customerId?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.salesService.findAll({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      shiftId,
      customerId,
      cursor,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('by-code/:code')
  findByCode(@Param('code') code: string) {
    return this.salesService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateSaleDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header majburiy');
    }
    return this.salesService.create(dto, idempotencyKey, user);
  }

  @Post('sync')
  sync(@Body() dto: SyncSalesDto, @CurrentUser() user: AuthUser) {
    return this.salesService.sync(dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @RequiresTotp()
  voidSale(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.voidSale(id, user);
  }
}
