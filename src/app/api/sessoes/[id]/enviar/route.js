import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { processarVerificacao } from "@/lib/verificationEngine";
import { dispararWebhook } from "@/lib/webhook";
import { json, fileFieldToBase64, HttpError } from "@/lib/http";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TENTATIVAS = 3;

/**
 * POST /api/sessoes/{id}/enviar
 *
 * Rota pública chamada pela própria tela de captura, ao final do fluxo
 * (documento + selfie já tirados no navegador). Não exige x-api-key —
 * a segurança vem do id da sessão ser de uso único, vinculado a uma
 * janela de tempo curta e a um advogado_id já definido na criação.
 *
 * Form-data: documento (obrigatório), selfie_rosto (opcional)
 *
 * Falhas recuperáveis (documento ilegível, selfie de baixa confiança)
 * devolvem status "RETRY" sem finalizar a sessão, para o usuário poder
 * tentar de novo — até MAX_TENTATIVAS, depois disso vira MANUAL_REVIEW.
 */
export async function POST(request, { params }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return json({ success: false, message: "Sessão inválida." }, 400);
  }

  const db = getSupabaseAdmin();

  try {
    const { data: sessao, error: fetchError } = await db
      .from("sessoes_verificacao")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !sessao) {
      return json({ success: false, message: "Sessão não encontrada." }, 404);
    }

    if (sessao.status !== "AGUARDANDO_ENVIO") {
      return json(
        { success: false, message: `Sessão já processada (status: ${sessao.status}).` },
        409,
      );
    }

    if (new Date(sessao.expires_at).getTime() < Date.now()) {
      await db.from("sessoes_verificacao").update({ status: "EXPIRADA" }).eq("id", id);
      return json({ success: false, message: "Sessão expirada." }, 410);
    }

    const formData = await request.formData();
    const documento = await fileFieldToBase64(formData, "documento", { required: true });
    const selfieRosto = await fileFieldToBase64(formData, "selfie_rosto", { required: false });

    const resultado = await processarVerificacao({
      nomeCadastro: sessao.nome_cadastro,
      oabCadastro: sessao.oab_cadastro,
      ufCadastro: sessao.uf_cadastro,
      documento,
      selfieRosto,
    });

    const { status, motivo, retomar, analise, documentoPath, selfiePath } = resultado;
    const tentativas = (sessao.tentativas || 0) + 1;

    if (status === "RETRY" && tentativas < MAX_TENTATIVAS) {
      await db
        .from("sessoes_verificacao")
        .update({ tentativas, analise_ia: analise })
        .eq("id", id);

      return json({
        success: true,
        status: "RETRY",
        retomar,
        motivo,
        tentativas_restantes: MAX_TENTATIVAS - tentativas,
      });
    }

    // Esgotou as tentativas com falha recuperável: vira revisão manual
    // em vez de deixar o usuário tentando pra sempre.
    const statusFinal = status === "RETRY" ? "MANUAL_REVIEW" : status;
    const motivoFinal =
      status === "RETRY"
        ? `${motivo} (limite de ${MAX_TENTATIVAS} tentativas atingido)`
        : motivo;

    await db
      .from("sessoes_verificacao")
      .update({
        status: statusFinal,
        motivo: motivoFinal,
        analise_ia: analise,
        documento_path: documentoPath,
        selfie_rosto_path: selfiePath,
        tentativas,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    let webhookEntregue = false;
    try {
      await dispararWebhook(sessao.callback_url, {
        sessao_id: id,
        advogado_id: sessao.advogado_id,
        status: statusFinal,
        motivo: motivoFinal,
      });
      webhookEntregue = true;
    } catch (webhookError) {
      console.error("[sessoes/enviar] falha ao notificar webhook", webhookError);
    }

    await db
      .from("sessoes_verificacao")
      .update({
        webhook_entregue: webhookEntregue,
        webhook_tentativas: 1,
      })
      .eq("id", id);

    return json({
      success: true,
      status: statusFinal,
      motivo: motivoFinal,
      revisao_manual: statusFinal === "MANUAL_REVIEW",
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ success: false, message: error.message }, error.status);
    }

    console.error("[sessoes/enviar] erro inesperado", error);
    return json({ success: false, message: "Erro interno na verificação." }, 500);
  }
}
