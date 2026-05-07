import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { WebhookController } from './webhook/webhook.controller';
import { WebhookService } from './webhook/webhook.service';
import { StateService } from './state/state.service';
import { IntentService } from './intent/intent.service';
import { LlmService } from './llm/llm.service';
import { VisionService } from './media/vision.service';
import { KapsoClient } from './kapso/kapso.client';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [HealthController, WebhookController],
  providers: [
    WebhookService,
    StateService,
    IntentService,
    LlmService,
    VisionService,
    KapsoClient,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
