import { Injectable } from '@nestjs/common';

export interface ParsedBill {
  utility: 'edenor' | 'edesur' | 'metrogas' | 'aysa' | 'unknown';
  total_ars: number | null;
  consumption_kwh: number | null;
  segment: string | null;
  period_days: number | null;
  parsed_at: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export interface ConversationState {
  phone: string;
  turns: ConversationTurn[];
  last_bill: ParsedBill | null;
  bill_history: ParsedBill[];
  last_intent: string | null;
  updated_at: string;
}

const MAX_TURNS = 12;
const MAX_BILLS = 6;
const MAX_DEDUP = 100;

@Injectable()
export class StateService {
  private readonly states = new Map<string, ConversationState>();
  private readonly seenMessageIds = new Set<string>();
  private readonly seenOrder: string[] = [];

  get(phone: string): ConversationState {
    let s = this.states.get(phone);
    if (!s) {
      s = {
        phone,
        turns: [],
        last_bill: null,
        bill_history: [],
        last_intent: null,
        updated_at: new Date().toISOString(),
      };
      this.states.set(phone, s);
    }
    return s;
  }

  appendTurn(phone: string, role: 'user' | 'assistant', content: string): void {
    const s = this.get(phone);
    s.turns.push({ role, content, ts: new Date().toISOString() });
    if (s.turns.length > MAX_TURNS) s.turns = s.turns.slice(-MAX_TURNS);
    s.updated_at = new Date().toISOString();
  }

  setBill(phone: string, bill: ParsedBill): void {
    const s = this.get(phone);
    if (s.last_bill) {
      s.bill_history.push(s.last_bill);
      if (s.bill_history.length > MAX_BILLS) s.bill_history = s.bill_history.slice(-MAX_BILLS);
    }
    s.last_bill = bill;
  }

  setIntent(phone: string, intent: string): void {
    this.get(phone).last_intent = intent;
  }

  isDuplicate(messageId: string | undefined): boolean {
    if (!messageId) return false;
    if (this.seenMessageIds.has(messageId)) return true;
    this.seenMessageIds.add(messageId);
    this.seenOrder.push(messageId);
    if (this.seenOrder.length > MAX_DEDUP) {
      const removed = this.seenOrder.shift();
      if (removed) this.seenMessageIds.delete(removed);
    }
    return false;
  }

  activeCount(): number {
    return this.states.size;
  }
}
