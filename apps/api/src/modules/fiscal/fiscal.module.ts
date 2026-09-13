import { Global, Module } from '@nestjs/common';
import { FISCAL_GATEWAY, NoopFiscalGateway } from './fiscal.gateway.js';

// Global so the future SalesModule can inject FISCAL_GATEWAY without a
// module-graph dependency on where the concrete gateway is provided.
@Global()
@Module({
  providers: [{ provide: FISCAL_GATEWAY, useClass: NoopFiscalGateway }],
  exports: [FISCAL_GATEWAY],
})
export class FiscalModule {}
