import { analisarVerificacaoOab } from "@/lib/geminiVerification";
import { decidirResultado } from "@/lib/decisao";
import { uploadVerificacaoFile } from "@/lib/storage";
import { nomesCorrespondem } from "@/lib/oabUtils";

/**
 * Roda a análise completa (Gemini + regra de decisão + upload dos
 * arquivos para o Storage). Não grava nada em tabela — quem chama
 * decide onde persistir o resultado.
 *
 * @returns {Promise<{status: string, motivo: string, analise: object, documentoPath: string, selfiePath: string|null}>}
 */
export async function processarVerificacao({
  nomeCadastro,
  oabCadastro,
  ufCadastro,
  documento,
  selfieRosto,
}) {
  const analise = await analisarVerificacaoOab({
    nomeCadastro,
    oabCadastro,
    ufCadastro,
    documento,
    selfieRosto,
  });

  analise.nome_compativel =
    analise.nome_compativel || nomesCorrespondem(nomeCadastro, analise.nome_extraido);

  const { status, motivo, retomar } = decidirResultado(analise);

  const documentoPath = await uploadVerificacaoFile(documento, "documentos");
  const selfiePath = selfieRosto
    ? await uploadVerificacaoFile(selfieRosto, "selfies")
    : null;

  return { status, motivo, retomar, analise, documentoPath, selfiePath };
}
