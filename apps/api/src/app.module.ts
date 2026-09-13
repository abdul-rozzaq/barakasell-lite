import './common/bigint-json.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ReceivingModule } from './modules/receiving/receiving.module.js';
import { CountsModule } from './modules/counts/counts.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { FiscalModule } from './modules/fiscal/fiscal.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { ShiftsModule } from './modules/shifts/shifts.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { ReturnsModule } from './modules/returns/returns.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    CatalogModule,
    ReceivingModule,
    CountsModule,
    ReportsModule,
    FiscalModule,
    SettingsModule,
    ShiftsModule,
    CustomersModule,
    SalesModule,
    ReturnsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
