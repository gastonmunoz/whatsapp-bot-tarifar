import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Intent, INTENT_HINTS, INTENTS } from './intents.config';

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }

  async classify(message: string, hasImage: boolean): Promise<Intent> {
    if (hasImage) return 'parse_bill';
    const lower = message.toLowerCase().trim();
    if (/^(hola|buenas|buen dia|que tal|holi)/.test(lower)) return 'greeting';

    if (!process.env.ANTHROPIC_API_KEY) return 'unknown';

    const hints = INTENTS.map((i) => `- ${i}: ${INTENT_HINTS[i]}`).join('\n');
    try {
      const resp = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        system:
          `Sos un clasificador de intents para un bot de WhatsApp que decodifica boletas de luz/gas en Argentina.\n` +
          `Devolve SOLO una palabra: el nombre del intent.\n\nIntents:\n${hints}`,
        messages: [{ role: 'user', content: message }],
      });
      const block = resp.content[0];
      const text = block && block.type === 'text' ? block.text.trim().toLowerCase() : 'unknown';
      const match = INTENTS.find((i) => text.includes(i)) ?? 'unknown';
      return match;
    } catch (err) {
      this.logger.warn(`intent classify fallback: ${(err as Error).message}`);
      return 'unknown';
    }
  }
}
