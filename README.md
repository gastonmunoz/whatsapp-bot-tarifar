# TarifAR — WhatsApp Bot

> Decodificador de boletas de luz/gas/agua AMBA. Mandas foto y te explico cargos, segmento RASE, anomalias y como reclamar.

## Conversacion ejemplo

```
Usuario: che, me llego la boleta de edenor y vino 87 lucas, esta bien?
Bot: Mostrame una foto de la boleta entera y te la desgloso. Sacala con buena luz, que se vea el codigo de barras.
Usuario: [foto]
Bot: Listo:
      Total: $87.430 | 412 kWh | Segmento N2 | 32 dias
      Cargos: cargo fijo $4.200, energia $60.976, subsidio N2 -$12.800, IVA $11.214, contribucion municipal Tigre $4.020...
      Lo que veo raro: tu consumo subio 18% vs el mes anterior.
      Si calificas para N3 podes pedir reclasificacion en RASE.
```

## Stack

- NestJS 10 (TypeScript strict)
- Anthropic SDK — Sonnet 4.6 (respuesta + vision), Haiku 4.5 (intent)
- Kapso WhatsApp Business adapter
- Vercel serverless (`@vercel/node`)
- State **in-memory** (`Map<phone, ConversationState>`). Reinicia con cold starts. Para produccion, agregar Supabase.

## Setup local

```bash
npm install
cp .env.example .env
# completar ANTHROPIC_API_KEY en .env
npm run start:dev
```

## Probar con curl

```bash
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5491150000000","message":"me llego una boleta de edenor de 87 mil pesos, esta bien?"}'
```

Health:

```bash
curl http://localhost:3000/
```

## Endpoints

| Metodo | Path | Descripcion |
| --- | --- | --- |
| GET | `/` | Health + estado del bot |
| POST | `/api/test` | Simulacion sin Kapso. Body: `{ phone, message }`. Devuelve `bot_response`. |
| POST | `/api/webhook` | Webhook Kapso (text/image). Verifica HMAC con `KAPSO_WEBHOOK_SECRET`. |

## Variables de entorno (Vercel)

| Variable | Obligatoria | Notas |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | si | Para LLM y vision |
| `KAPSO_API_KEY` | no en MVP | Si falta, el bot no manda mensajes outbound (logs only) |
| `KAPSO_WEBHOOK_SECRET` | no en MVP | Si esta seteada, valida HMAC de cada webhook |
| `KAPSO_BASE_URL` | no | Default `https://api.kapso.ai` |

## Conectar a Kapso

1. Crear numero WhatsApp en Kapso.
2. Configurar webhook URL: `https://<vercel-url>/api/webhook`.
3. Setear `KAPSO_WEBHOOK_SECRET` en Vercel y en Kapso (mismo valor).

## Deploy

```bash
vercel --prod
```

## Tests

```bash
npm test
```

## Aviso

MVP sin persistencia. State en memoria, se reinicia con cada cold start de Vercel. Para produccion, migrar `StateService` a Supabase (tabla `conversations` con jsonb `state`).
