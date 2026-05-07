import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { WebhookService } from './webhook.service';
import { StateService } from '../state/state.service';
import type { KapsoWebhookPayload } from './dto/kapso-payload.dto';

interface TestRequest {
  phone: string;
  message: string;
}

@Controller('api')
export class WebhookController {
  constructor(
    private readonly webhook: WebhookService,
    private readonly state: StateService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async incoming(
    @Headers('x-kapso-signature') signature: string | undefined,
    @Body() body: KapsoWebhookPayload,
  ) {
    this.verifySignature(signature, body);
    const msg = body.message;
    if (!msg || !msg.from) return { ok: true, ignored: true };
    if (this.state.isDuplicate(msg.message_id)) return { ok: true, deduped: true };
    await this.webhook.handleIncoming(msg, true);
    return { ok: true };
  }

  @Post('test')
  @HttpCode(200)
  async test(@Body() body: TestRequest) {
    if (!body?.phone || !body?.message) {
      return { ok: false, error: 'phone and message required' };
    }
    const result = await this.webhook.handleIncoming(
      { from: body.phone, type: 'text', text: { body: body.message } },
      false,
    );
    return { ok: true, ...result };
  }

  private verifySignature(signature: string | undefined, body: unknown): void {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (!secret) return;
    if (!signature) throw new UnauthorizedException('missing signature');
    const expected = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid signature');
    }
  }
}
