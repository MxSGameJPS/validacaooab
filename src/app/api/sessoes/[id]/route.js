import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { json } from "@/lib/http";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/sessoes/{id}
 *
 * Rota pública (sem x-api-key) usada pela própria tela de captura para
 * saber o que exibir. Devolve só o necessário para a UI — nunca o
 * advogado_id nem dados sensíveis.
 */
export async function GET(_request, { params }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return json({ success: false, message: "Sessão inválida." }, 400);
  }

  const db = getSupabaseAdmin();

  const { data: sessao, error } = await db
    .from("sessoes_verificacao")
    .select("id, nome_cadastro, oab_cadastro, uf_cadastro, status, expires_at")
    .eq("id", id)
    .single();

  if (error || !sessao) {
    return json({ success: false, message: "Sessão não encontrada." }, 404);
  }

  const expirada = new Date(sessao.expires_at).getTime() < Date.now();

  if (expirada && sessao.status === "AGUARDANDO_ENVIO") {
    await db
      .from("sessoes_verificacao")
      .update({ status: "EXPIRADA" })
      .eq("id", id);
    sessao.status = "EXPIRADA";
  }

  return json({
    success: true,
    sessao_id: sessao.id,
    nome: sessao.nome_cadastro,
    oab: sessao.oab_cadastro,
    uf: sessao.uf_cadastro,
    status: sessao.status,
    expirada,
  });
}
