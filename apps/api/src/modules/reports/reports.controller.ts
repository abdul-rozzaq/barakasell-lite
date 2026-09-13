import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('reports')
@Roles(UserRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-value')
  stockValue() {
    return this.reportsService.stockValue();
  }

  @Get('stock')
  stockList() {
    return this.reportsService.stockList();
  }

  @Get('dashboard')
  dashboard() {
    return this.reportsService.dashboard();
  }

  @Get('profit')
  profit(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: 'period' | 'product' | 'category',
  ) {
    return this.reportsService.profitReport({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      groupBy: groupBy ?? 'period',
    });
  }

  @Get('dead-stock')
  deadStock(@Query('days') days?: string) {
    return this.reportsService.deadStock(days ? Number(days) : 30);
  }
}
