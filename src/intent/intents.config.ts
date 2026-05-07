export const INTENTS = [
  'parse_bill',
  'compare_history',
  'explain_charge',
  'claim_help',
  'segment_check',
  'greeting',
  'unknown',
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_HINTS: Record<Intent, string> = {
  parse_bill: 'usuario manda foto/PDF de su boleta para que se la desglose',
  compare_history: 'usuario pregunta si subio o bajo respecto al mes anterior',
  explain_charge: 'usuario pregunta que significa un cargo, tasa o concepto de la boleta',
  claim_help: 'usuario quiere saber como reclamar a ENRE/ENARGAS o pedir reclasificacion RASE',
  segment_check: 'usuario duda en que segmento RASE esta o si conviene pedir cambio',
  greeting: 'saludo o presentacion inicial',
  unknown: 'no encaja en nada',
};
