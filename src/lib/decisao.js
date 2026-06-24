/**
 * Decide o resultado final da verificação combinando a análise da IA
 * com as regras de negócio do MVP: documento é critério decisivo,
 * rosto é um filtro de sanidade permissivo.
 *
 * @returns {{ status: "VERIFIED" | "ERROR" | "MANUAL_REVIEW", motivo: string }}
 */
export function decidirResultado(analise) {
  if (!analise.documento_legivel) {
    return { status: "MANUAL_REVIEW", motivo: "Documento ilegível." };
  }

  if (!analise.documento_parece_autentico) {
    return {
      status: "MANUAL_REVIEW",
      motivo: "Indícios de documento não autêntico ou adulterado.",
    };
  }

  const documentoCompativel =
    analise.nome_compativel &&
    analise.oab_numero_compativel &&
    analise.oab_uf_compativel;

  if (!documentoCompativel) {
    return {
      status: "ERROR",
      motivo: "Dados do documento não coincidem com o cadastro.",
    };
  }

  if (analise.confianca_facial === "BAIXA") {
    return {
      status: "MANUAL_REVIEW",
      motivo: `Baixa similaridade facial: ${analise.motivo_confianca_facial}`,
    };
  }

  // ALTA, MEDIA ou NAO_AVALIADO (sem selfie de rosto) + documento ok => aprova.
  return { status: "VERIFIED", motivo: "Documento e identidade conferidos." };
}
