import express, { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createHmac, timingSafeEqual } from 'crypto';

const STARTED_AT = Date.now();
const DEPLOYED_AT = new Date().toISOString();

interface Turn { role: 'user' | 'assistant'; content: string; ts: string }
interface State { phone: string; turns: Turn[]; last_intent: string | null; updated_at: string }
const states = new Map<string, State>();
const seen = new Set<string>();
const seenOrder: string[] = [];

const SYSTEM_PROMPT = `Sos TarifAR, un bot de WhatsApp argentino que decodifica boletas de luz, gas y agua para usuarios del AMBA.

Tono: porteno coloquial, claro, breve. Empezas tuteando. Usa emojis con criterio (1-2 por mensaje, no mas).

Que haces:
- Desglosas boletas de Edenor, Edesur, Metrogas, Camuzzi, AySA cuando el usuario manda una foto
- Comparas con boletas anteriores del mismo usuario si las hay
- Explicas cargos: cargo fijo, variable, tasa ENRE, contribuciones municipales, IVA, segmentos N1/N2/N3
- Guias reclamos a ENRE/ENARGAS y recategorizacion RASE (sin tramitarlos vos)

Reglas:
- Mensajes cortos. Dividi en bullets cuando ayuda.
- Si no tenes la foto, pedila con luz buena y que entre el codigo de barras.
- NO inventes numeros si no los ves. Si la foto es ilegible, decilo.
- Disclaimer cuando corresponde: "no soy asesor legal, esto es informativo".
- Cifras siempre en pesos argentinos con punto de miles ($87.430).`;

const INTENTS = ['parse_bill', 'compare_history', 'explain_charge', 'claim_help', 'segment_check', 'greeting', 'unknown'] as const;
type Intent = typeof INTENTS[number];

function getState(phone: string): State {
  let s = states.get(phone);
  if (!s) {
    s = { phone, turns: [], last_intent: null, updated_at: new Date().toISOString() };
    states.set(phone, s);
  }
  return s;
}

function appendTurn(s: State, role: 'user' | 'assistant', content: string): void {
  s.turns.push({ role, content, ts: new Date().toISOString() });
  if (s.turns.length > 12) s.turns = s.turns.slice(-12);
  s.updated_at = new Date().toISOString();
}

function isDuplicate(id: string | undefined): boolean {
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  seenOrder.push(id);
  if (seenOrder.length > 100) {
    const removed = seenOrder.shift();
    if (removed) seen.delete(removed);
  }
  return false;
}

function client(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function classifyIntent(message: string, hasImage: boolean): Promise<Intent> {
  if (hasImage) return 'parse_bill';
  const lower = message.toLowerCase().trim();
  if (/^(hola|buenas|buen dia|que tal|holi)/.test(lower)) return 'greeting';
  const c = client();
  if (!c) return 'unknown';
  try {
    const resp = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      system: 'Clasificador de intents WhatsApp bot decodificador de boletas. Devolve SOLO una palabra: parse_bill, compare_history, explain_charge, claim_help, segment_check, greeting o unknown.',
      messages: [{ role: 'user', content: message }],
    });
    const block = resp.content[0];
    const text = block && block.type === 'text' ? block.text.trim().toLowerCase() : 'unknown';
    return (INTENTS.find(i => text.includes(i)) ?? 'unknown') as Intent;
  } catch {
    return 'unknown';
  }
}

async function respond(history: Turn[], message: string, context?: string): Promise<string> {
  const c = client();
  if (!c) return 'Bot en modo sin LLM (falta ANTHROPIC_API_KEY). Configurate la variable y volve a probar.';
  const messages = history.slice(-8).map(t => ({ role: t.role, content: t.content }));
  messages.push({ role: 'user' as const, content: context ? `${message}\n\n[contexto]\n${context}` : message });
  try {
    const resp = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages,
    });
    const block = resp.content[0];
    return block && block.type === 'text' ? block.text.trim() : 'No supe que contestar, mandame de nuevo.';
  } catch (err) {
    return `Tuve un problema procesando tu mensaje. Probá de nuevo en un toque. (${(err as Error).message.slice(0, 80)})`;
  }
}

async function parseBillImage(b64: string, mediaType: string): Promise<string> {
  const c = client();
  if (!c) return '[vision desactivado]';
  try {
    const mt = (['image/jpeg', 'image/png', 'image/webp'].includes(mediaType) ? mediaType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';
    const resp = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: 'Extraes datos de boletas argentinas de luz/gas/agua. Devolve JSON con: utility, total_ars, consumption_kwh, segment, period_days, charges, anomalies. Si no se ve, null. NO inventes.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } },
          { type: 'text', text: 'Extrae los datos de esta boleta y devolve JSON valido.' },
        ],
      }],
    });
    const block = resp.content[0];
    return block && block.type === 'text' ? block.text : '{}';
  } catch (err) {
    return `[error vision: ${(err as Error).message.slice(0, 100)}]`;
  }
}

async function sendKapso(phone: string, text: string): Promise<void> {
  const apiKey = process.env.KAPSO_API_KEY;
  const baseUrl = process.env.KAPSO_BASE_URL ?? 'https://api.kapso.ai';
  if (!apiKey) {
    console.log(JSON.stringify({ event: 'kapso_disabled', phone, preview: text.slice(0, 80) }));
    return;
  }
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, type: 'text', text: { body: text } }),
    });
    if (!res.ok) console.error(`kapso send ${res.status}`);
  } catch (err) {
    console.error(`kapso error: ${(err as Error).message}`);
  }
}

interface KapsoMsg { message_id?: string; from: string; type: string; text?: { body: string }; image?: { base64?: string; mime_type?: string } }

async function handleIncoming(msg: KapsoMsg, sendOut: boolean) {
  const started = Date.now();
  const phone = msg.from;
  const text = msg.text?.body ?? '';
  const hasImage = msg.type === 'image' && !!msg.image;
  let visionContext: string | undefined;
  if (hasImage && msg.image?.base64) {
    visionContext = await parseBillImage(msg.image.base64, msg.image.mime_type ?? 'image/jpeg');
  }
  const intent = await classifyIntent(text || '[imagen]', hasImage);
  const s = getState(phone);
  s.last_intent = intent;
  appendTurn(s, 'user', text || '[imagen de boleta]');
  const userMsg = text || 'Te mande una foto de mi boleta, desglosamela.';
  const reply = await respond(s.turns, userMsg, visionContext);
  appendTurn(s, 'assistant', reply);
  if (sendOut) await sendKapso(phone, reply);
  const latency = Date.now() - started;
  console.log(JSON.stringify({ phone, intent, latency_ms: latency, has_image: hasImage }));
  return { bot_response: reply, intent_detected: intent, latency_ms: latency };
}

function verifySignature(req: Request): boolean {
  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.headers['x-kapso-signature'];
  if (typeof sig !== 'string') return false;
  const expected = createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const app = express();
app.use(express.json({ limit: '20mb' }));

const healthHandler = (_req: Request, res: Response) => {
  res.json({
    ok: true,
    bot: 'TarifAR',
    slug: 'tarifar',
    office: 'Decodificador de boletas de servicios publicos (luz, gas, agua)',
    version: '0.1.0',
    uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    active_phones_in_memory: states.size,
    deployed_at: DEPLOYED_AT,
  });
};
app.get('/', healthHandler);
app.get('/api', healthHandler);
app.get('/api/health', healthHandler);
app.get('/_unused_', (_req, res) => {
  res.json({
    ok: true,
    bot: 'TarifAR',
    slug: 'tarifar',
    office: 'Decodificador de boletas de servicios publicos (luz, gas, agua)',
    version: '0.1.0',
    uptime_seconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    active_phones_in_memory: states.size,
    deployed_at: DEPLOYED_AT,
  });
});

app.post('/api/test', async (req, res) => {
  const { phone, message } = req.body ?? {};
  if (!phone || !message) {
    res.status(200).json({ ok: false, error: 'phone and message required' });
    return;
  }
  const result = await handleIncoming({ from: phone, type: 'text', text: { body: message } }, false);
  res.json({ ok: true, ...result });
});

app.post('/api/webhook', async (req, res) => {
  if (!verifySignature(req)) {
    res.status(401).json({ ok: false, error: 'invalid signature' });
    return;
  }
  const msg = req.body?.message;
  if (!msg || !msg.from) {
    res.json({ ok: true, ignored: true });
    return;
  }
  if (isDuplicate(msg.message_id)) {
    res.json({ ok: true, deduped: true });
    return;
  }
  await handleIncoming(msg, true);
  res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ ok: false, error: 'not found' }));

export default app;
