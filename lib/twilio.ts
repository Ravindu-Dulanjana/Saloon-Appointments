import twilio from 'twilio';

let cached: ReturnType<typeof twilio> | null = null;

function client() {
  if (cached) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  cached = twilio(sid, token);
  return cached;
}

export async function sendWhatsApp(to: string, body: string) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('Missing TWILIO_WHATSAPP_FROM');
  return client().messages.create({ from, to, body });
}

export function buildTwiML(body: string) {
  const { MessagingResponse } = twilio.twiml;
  const res = new MessagingResponse();
  res.message(body);
  return res.toString();
}

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  return twilio.validateRequest(token, signature, url, params);
}
