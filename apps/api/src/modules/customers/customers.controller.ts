import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get()
  findAll(@Query('q') q?: string) {
    return this.customersService.findAll(q);
  }

  // Declared before ':id' — same ordering rule as products.controller.ts's
  // 'lookup/:barcode' — so a card code isn't swallowed as an :id lookup.
  @Get('by-card/:code')
  findByCard(@Param('code') code: string) {
    return this.customersService.findByCardCode(code);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get(':id/loyalty')
  async loyalty(@Param('id') id: string) {
    const customer = await this.customersService.findOne(id);
    const entries = await this.loyaltyService.history(id);
    return { pointsBalance: customer.pointsBalance, cardCode: customer.cardCode, entries };
  }

  @Post(':id/loyalty/card')
  @Audit({ action: 'Loyalty karta yaratildi', entity: 'Customer' })
  async createLoyaltyCard(@Param('id') id: string) {
    await this.customersService.findOne(id);
    return this.loyaltyService.ensureCard(id);
  }

  @Get(':id/entries')
  listEntries(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.customersService.listEntries(
      id,
      cursor,
      take ? Number(take) : undefined,
    );
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(':id/payments')
  @Audit({ action: "Nasiya to'lovi", entity: 'Customer' })
  addPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.addPayment(id, dto, user);
  }
}
