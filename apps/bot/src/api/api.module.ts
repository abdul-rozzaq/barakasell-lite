import { Module } from '@nestjs/common';
import { ApiClient } from './api.client.js';

@Module({
  providers: [ApiClient],
  exports: [ApiClient],
})
export class ApiModule {}
