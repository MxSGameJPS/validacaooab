import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "verificacoes";

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * @param {{mimeType: string, base64: string}} file
 * @param {string} prefix
 * @returns {Promise<string>} path do objeto no bucket
 */
export async function uploadVerificacaoFile(file, prefix) {
  const db = getSupabaseAdmin();
  const ext = EXTENSION_BY_MIME[file.mimeType] || "bin";
  const path = `${prefix}/${randomUUID()}.${ext}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(file.base64, "base64"), {
      contentType: file.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Falha ao enviar arquivo para storage: ${error.message}`);
  }

  return path;
}
