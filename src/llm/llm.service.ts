import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompts/system.prompt';
import type { ConversationTurn } from '../state/state.service';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }

  async respond(history: ConversationTurn[], userMessage: string, context?: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      return 'Bot en modo sin LLM (falta ANTHROPIC_API_KEY). Configurate la variable y volve a probar.';
    }

    const messages = history
      .slice(-8)
      .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content }));
    messages.push({ role: 'user', content: context ? `${userMessage}\n\n[contexto]\n${context}` : userMessage });

    try {
      const resp = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages,
      });
      const block = resp.content[0];
      return block && block.type === 'text' ? block.text.trim() : 'No supe que contestar, mandame de nuevo.';
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`LLM error: ${msg}`);
      return `Tuve un problema procesando tu mensaje. Probá de nuevo en un toque. (${msg.slice(0, 80)})`;
    }
  }
}
