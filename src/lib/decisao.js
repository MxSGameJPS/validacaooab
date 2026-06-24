/**
 * Decide o resultado da verificação combinando a análise da IA com as
 * regras de negócio do MVP: documento é critério decisivo, rosto é um
 * filtro de sanidade permissivo.
 *
 * Distingue falhas "recuperáveis" (o usuário pode tirar a foto de novo:
 * documento ilegível, selfie de baixa confiança — geralmente causado por
 * boné/touca/acessório ou má iluminação) de falhas terminais (fraude
 * aparente ou dados que não coincidem com o cadastro).
 *
 * @returns {{
 *   status: "VERIFIED" | "ERROR" | "MANUAL_REVIEW" | "RETRY",
 *   motivo: string,
 *   retomar?: "documento" | "selfie"
 * }}
 */
export function decidirResultado(analise) {
  if (!analise.documento_legivel) {
    return {
      status: "RETRY",
      motivo: "Não conseguimos ler os dados do documento.",
      retomar: "documento",
    };
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
      status: "RETRY",
      motivo: `Não conseguimos confirmar seu rosto: ${analise.motivo_confianca_facial}`,
      retomar: "selfie",
    };
  }

  // ALTA, MEDIA ou NAO_AVALIADO (sem selfie de rosto) + documento ok => aprova.
  return { status: "VERIFIED", motivo: "Documento e identidade conferidos." };
}
