import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class KapsoClient {
  private readonly logger = new Logger(KapsoClient.name);

  async sendText(phone: string, text: string): Promise<void> {
    const apiKey = process.env.KAPSO_API_KEY;
    const baseUrl = process.env.KAPSO_BASE_URL ?? 'https://api.kapso.ai';
    if (!apiKey) {
      this.logger.warn(`[kapso disabled] would send to ${phone}: ${text.slice(0, 80)}`);
      return;
    }
    try {
      await axios.post(
        `${baseUrl}/v1/messages`,
        { to: phone, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 },
      );
    } catch (err) {
      this.logger.error(`kapso send error: ${(err as Error).message}`);
    }
  }
}
