import { NextResponse } from "next/server";

export function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function requireApiKey(request) {
  const expected = process.env.VERIFICACAO_API_KEY;
  if (!expected) {
    throw new Error("VERIFICACAO_API_KEY não configurada no servidor.");
  }

  const provided = request.headers.get("x-api-key");
  return provided === expected;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function fileFieldToBase64(formData, field, { required = true } = {}) {
  const file = formData.get(field);

  if (!file || typeof file === "string") {
    if (required) throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    return null;
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, `Arquivo "${field}" excede 8MB.`);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new HttpError(
      400,
      `Tipo de arquivo não suportado em "${field}": ${file.type}.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return { mimeType: file.type, base64: buffer.toString("base64") };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
