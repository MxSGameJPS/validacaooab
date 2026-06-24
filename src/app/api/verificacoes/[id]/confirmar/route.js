import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { json, requireApiKey } from "@/lib/http";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/verificacoes/{id}/confirmar
 *
 * 2a chamada do fluxo: a plataforma já criou/confirmou o advogado no
 * próprio banco e agora informa o advogado_id para vincular ao registro
 * de verificação. Só aceita se o status da verificação for VERIFIED.
 *
 * Body JSON: { "advogado_id": "uuid" }
 */
export async function POST(request, { params }) {
  if (!requireApiKey(request)) {
    return json({ success: false, message: "Não autorizado." }, 401);
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return json({ success: false, message: "id de verificação inválido." }, 400);
  }

  const body = await request.json().catch(() => null);
  const advogadoId = String(body?.advogado_id || "").trim();

  if (!UUID_RE.test(advogadoId)) {
    return json({ success: false, message: "advogado_id inválido." }, 400);
  }

  const db = getSupabaseAdmin();

  const { data: registro, error: fetchError } = await db
    .from("verificacoes_oab")
    .select("id, status, advogado_id")
    .eq("id", id)
    .single();

  if (fetchError || !registro) {
    return json({ success: false, message: "Verificação não encontrada." }, 404);
  }

  if (registro.status !== "VERIFIED") {
    return json(
      { success: false, message: `Verificação não está aprovada (status atual: ${registro.status}).` },
      409,
    );
  }

  if (registro.advogado_id && registro.advogado_id !== advogadoId) {
    return json(
      { success: false, message: "Verificação já vinculada a outro advogado_id." },
      409,
    );
  }

  const { error: updateError } = await db
    .from("verificacoes_oab")
    .update({ advogado_id: advogadoId, confirmado_em: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return json({ success: false, message: "Falha ao confirmar verificação." }, 500);
  }

  return json({ success: true, verificacao_id: id, advogado_id: advogadoId });
}
