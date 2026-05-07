import { Injectable, Logger } from '@nestjs/common';
import { StateService } from '../state/state.service';
import { IntentService } from '../intent/intent.service';
import { LlmService } from '../llm/llm.service';
import { VisionService } from '../media/vision.service';
import { KapsoClient } from '../kapso/kapso.client';
import type { KapsoIncomingMessage } from './dto/kapso-payload.dto';

export interface ProcessResult {
  bot_response: string;
  intent_detected: string;
  latency_ms: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly state: StateService,
    private readonly intent: IntentService,
    private readonly llm: LlmService,
    private readonly vision: VisionService,
    private readonly kapso: KapsoClient,
  ) {}

  async handleIncoming(msg: KapsoIncomingMessage, sendViaKapso: boolean): Promise<ProcessResult> {
    const started = Date.now();
    const phone = msg.from;
    const text = msg.text?.body ?? '';
    const hasImage = msg.type === 'image' && !!msg.image;

    let visionContext: string | undefined;
    if (hasImage && msg.image?.base64) {
      const mime = (msg.image.mime_type ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';
      visionContext = await this.vision.parseBillImage(msg.image.base64, mime);
    }

    const intent = await this.intent.classify(text || '[imagen]', hasImage);
    this.state.setIntent(phone, intent);
    this.state.appendTurn(phone, 'user', text || '[el usuario mando una imagen de boleta]');

    const userMessage = text || 'Te mande una foto de mi boleta, desglosamela.';
    const reply = await this.llm.respond(this.state.get(phone).turns, userMessage, visionContext);
    this.state.appendTurn(phone, 'assistant', reply);

    if (sendViaKapso) await this.kapso.sendText(phone, reply);

    const latency = Date.now() - started;
    this.logger.log(JSON.stringify({ phone, intent, latency_ms: latency, has_image: hasImage }));
    return { bot_response: reply, intent_detected: intent, latency_ms: latency };
  }
}
