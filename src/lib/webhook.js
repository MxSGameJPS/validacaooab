import { createHmac } from "crypto";

/**
 * Notifica o app principal sobre o resultado de uma sessão de
 * verificação. Assina o corpo com HMAC-SHA256 (header x-signature) para
 * o app principal validar que a chamada realmente veio desta API.
 */
export async function dispararWebhook(callbackUrl, payload) {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) throw new Error("WEBHOOK_SIGNING_SECRET não configurada.");

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": signature },
    body,
  });

  if (!response.ok) {
    throw new Error(`Webhook respondeu ${response.status}`);
  }
}
