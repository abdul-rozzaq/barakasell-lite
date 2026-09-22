import { Module } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { deepseekClientProvider } from './deepseek.provider.js';
import { ApiModule } from '../api/api.module.js';

@Module({
  imports: [ApiModule],
  providers: [AgentService, deepseekClientProvider],
  exports: [AgentService],
})
export class AgentModule {}
