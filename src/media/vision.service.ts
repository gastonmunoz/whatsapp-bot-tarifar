import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }

  async parseBillImage(imageBase64: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) return '[vision desactivado: falta ANTHROPIC_API_KEY]';
    try {
      const resp = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system:
          'Extraes datos de boletas argentinas de luz/gas/agua. ' +
          'Devolve JSON con: utility (edenor|edesur|metrogas|camuzzi|aysa|unknown), total_ars, consumption_kwh, segment (N1|N2|N3|null), period_days, charges (array {label, amount_ars}), anomalies (array string). ' +
          'Si algo no se ve, poneselo null. NO inventes.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: 'Extrae los datos de esta boleta y devolve JSON valido.' },
            ],
          },
        ],
      });
      const block = resp.content[0];
      return block && block.type === 'text' ? block.text : '{}';
    } catch (err) {
      this.logger.error(`vision error: ${(err as Error).message}`);
      return `[error vision: ${(err as Error).message.slice(0, 100)}]`;
    }
  }
}
