import { Module } from '@nestjs/common';
import { OwnerLinkService } from './owner-link.service.js';

@Module({
  providers: [OwnerLinkService],
  exports: [OwnerLinkService],
})
export class OwnerLinkModule {}
