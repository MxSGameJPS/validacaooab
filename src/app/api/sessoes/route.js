import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeOab, normalizeUf, normalizeNome } from "@/lib/oabUtils";
import { json, requireApiKey, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/sessoes
 *
 * Chamado pelo backend do app principal (server-to-server, x-api-key)
 * imediatamente após o advogado confirmar o e-mail. Cria a sessão de
 * captura e devolve a URL para redirecionar o navegador do advogado.
 *
 * Body JSON:
 * { "advogado_id": "uuid", "nome": "...", "oab": "...", "uf": "SP",
 *   "callback_url": "https://www.socialjuridico.com.br/api/webhooks/verificacao-oab" }
 */
export async function POST(request) {
  try {
    if (!requireApiKey(request)) {
      return json({ success: false, message: "Não autorizado." }, 401);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return json({ success: false, message: "JSON inválido." }, 400);
    }

    const advogadoId = String(body.advogado_id || "").trim();
    const nomeCadastro = normalizeNome(body.nome);
    const oabCadastro = normalizeOab(body.oab);
    const ufCadastro = normalizeUf(body.uf);
    const callbackUrl = String(body.callback_url || "").trim();

    if (!UUID_RE.test(advogadoId)) {
      return json({ success: false, message: "advogado_id inválido." }, 400);
    }
    if (!nomeCadastro) {
      return json({ success: false, message: "Campo 'nome' é obrigatório." }, 400);
    }
    if (!oabCadastro) {
      return json({ success: false, message: "Campo 'oab' inválido." }, 400);
    }
    if (!ufCadastro) {
      return json({ success: false, message: "Campo 'uf' inválido." }, 400);
    }
    const callbackIsLocalHttp =
      process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)/.test(callbackUrl);

    if (!/^https:\/\//.test(callbackUrl) && !callbackIsLocalHttp) {
      return json({ success: false, message: "callback_url deve ser https." }, 400);
    }

    const db = getSupabaseAdmin();

    const { data: sessao, error } = await db
      .from("sessoes_verificacao")
      .insert({
        advogado_id: advogadoId,
        nome_cadastro: nomeCadastro,
        oab_cadastro: oabCadastro,
        uf_cadastro: ufCadastro,
        callback_url: callbackUrl,
      })
      .select("id, expires_at")
      .single();

    if (error) {
      throw new Error(`Falha ao criar sessão: ${error.message}`);
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;

    return json({
      success: true,
      sessao_id: sessao.id,
      url: `${baseUrl}/verificar/${sessao.id}`,
      expires_at: sessao.expires_at,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ success: false, message: error.message }, error.status);
    }

    console.error("[sessoes] erro inesperado", error);
    return json({ success: false, message: "Erro interno ao criar sessão." }, 500);
  }
}
