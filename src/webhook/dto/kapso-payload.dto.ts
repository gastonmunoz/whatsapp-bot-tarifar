export interface KapsoMediaRef {
  url?: string;
  base64?: string;
  mime_type?: string;
}

export interface KapsoIncomingMessage {
  message_id?: string;
  from: string;
  type: 'text' | 'image' | 'audio' | 'document';
  text?: { body: string };
  image?: KapsoMediaRef;
  audio?: KapsoMediaRef;
  document?: KapsoMediaRef;
  timestamp?: string;
}

export interface KapsoWebhookPayload {
  event?: string;
  message?: KapsoIncomingMessage;
}
