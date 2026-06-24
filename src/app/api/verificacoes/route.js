import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { processarVerificacao } from "@/lib/verificationEngine";
import { normalizeOab, normalizeUf, normalizeNome } from "@/lib/oabUtils";
import { json, requireApiKey, fileFieldToBase64, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/verificacoes
 *
 * Endpoint de baixo nível, server-to-server: roda a verificação sem
 * depender da tela hospedada nesta API. Para o fluxo padrão do app
 * principal (advogado capturando selfie/documento direto no navegador),
 * use /api/sessoes em vez deste endpoint.
 *
 * Form-data esperado:
 * - nome, oab, uf (texto)
 * - documento (arquivo, obrigatório)
 * - selfie_rosto (arquivo, opcional)
 */
export async function POST(request) {
  try {
    if (!requireApiKey(request)) {
      return json({ success: false, message: "Não autorizado." }, 401);
    }

    const formData = await request.formData();

    const nomeCadastro = normalizeNome(formData.get("nome"));
    const oabCadastro = normalizeOab(formData.get("oab"));
    const ufCadastro = normalizeUf(formData.get("uf"));

    if (!nomeCadastro) {
      return json({ success: false, message: "Campo 'nome' é obrigatório." }, 400);
    }
    if (!oabCadastro) {
      return json({ success: false, message: "Campo 'oab' inválido." }, 400);
    }
    if (!ufCadastro) {
      return json({ success: false, message: "Campo 'uf' inválido." }, 400);
    }

    const documento = await fileFieldToBase64(formData, "documento", { required: true });
    const selfieRosto = await fileFieldToBase64(formData, "selfie_rosto", { required: false });

    const resultado = await processarVerificacao({
      nomeCadastro,
      oabCadastro,
      ufCadastro,
      documento,
      selfieRosto,
    });

    // Este endpoint não tem como pedir nova foto ao usuário (sem tela),
    // então uma falha recuperável (RETRY) aqui sempre vira revisão manual.
    const status = resultado.status === "RETRY" ? "MANUAL_REVIEW" : resultado.status;
    const motivo = resultado.motivo;
    const { analise, documentoPath, selfiePath } = resultado;

    const db = getSupabaseAdmin();

    const { data: registro, error: insertError } = await db
      .from("verificacoes_oab")
      .insert({
        nome_cadastro: nomeCadastro,
        oab_cadastro: oabCadastro,
        uf_cadastro: ufCadastro,
        documento_path: documentoPath,
        selfie_rosto_path: selfiePath,
        status,
        motivo,
        analise_ia: analise,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Falha ao gravar verificação: ${insertError.message}`);
    }

    return json({
      success: true,
      verificacao_id: registro.id,
      status,
      motivo,
      revisao_manual: status === "MANUAL_REVIEW",
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ success: false, message: error.message }, error.status);
    }

    console.error("[verificacoes] erro inesperado", error);
    return json({ success: false, message: "Erro interno na verificação." }, 500);
  }
}
