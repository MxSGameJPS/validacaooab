import OpenAI from "openai";

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  client = new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL });
  return client;
}

function buildPrompt({ nomeCadastro, oabCadastro, ufCadastro, temSelfieRosto }) {
  return `Você é um analista de compliance verificando o cadastro de um advogado em uma plataforma jurídica brasileira.

Dados informados pelo advogado no cadastro:
- Nome: ${nomeCadastro}
- Número da OAB: ${oabCadastro}
- UF da OAB: ${ufCadastro}

Você recebe:
1. Uma imagem ou PDF da Carteira/Credencial da OAB (CNA) do advogado. CRITÉRIO PRINCIPAL.
${temSelfieRosto ? "2. Uma selfie do rosto do advogado, para uma checagem facial secundária e opcional." : ""}

Tarefas:
1. Extraia do documento: nome completo, número da OAB e UF.
2. Compare cada campo com o cadastro. Pequenas variações de acentuação, abreviação de nomes do meio ou formatação do número da OAB (pontos, hífen) NÃO contam como incompatibilidade.
3. Avalie sinais de fraude no documento (foto de tela, adulteração, montagem) em "documento_parece_autentico".
${
  temSelfieRosto
    ? `4. CHECAGEM FACIAL SECUNDÁRIA (prioridade mínima): compare de forma permissiva o rosto da selfie com o rosto do documento, avaliando apenas similaridade estrutural geral. IGNORE cabelo, barba, peso, idade da foto e iluminação. O objetivo é só pegar fraude grosseira (pessoa claramente diferente). Se não conseguir avaliar com segurança, retorne "NAO_AVALIADO" — não invente. Valores: "ALTA", "MEDIA", "BAIXA", "NAO_AVALIADO".`
    : '4. Não há selfie de rosto. Retorne "confianca_facial": "NAO_AVALIADO".'
}

Responda SOMENTE com JSON válido neste formato exato:
{
  "documento_legivel": true,
  "documento_parece_autentico": true,
  "nome_extraido": "",
  "oab_numero_extraido": "",
  "oab_uf_extraido": "",
  "nome_compativel": true,
  "oab_numero_compativel": true,
  "oab_uf_compativel": true,
  "confianca_facial": "NAO_AVALIADO",
  "motivo_confianca_facial": "",
  "observacoes": ""
}`;
}

function fileToContentPart(file, nomeArquivo) {
  const dataUrl = `data:${file.mimeType};base64,${file.base64}`;

  if (file.mimeType === "application/pdf") {
    return { type: "file", file: { filename: nomeArquivo, file_data: dataUrl } };
  }

  return { type: "image_url", image_url: { url: dataUrl } };
}

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_TENTATIVAS = 3;

function isErroTransitorio(error) {
  const status = error?.status ?? error?.error?.code;
  return RETRYABLE_STATUS.has(Number(status));
}

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{nomeCadastro: string, oabCadastro: string, ufCadastro: string, documento: {mimeType: string, base64: string}, selfieRosto?: {mimeType: string, base64: string}}} params
 */
export async function analisarVerificacaoOab({
  nomeCadastro,
  oabCadastro,
  ufCadastro,
  documento,
  selfieRosto,
}) {
  const openai = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const content = [
    {
      type: "text",
      text: buildPrompt({
        nomeCadastro,
        oabCadastro,
        ufCadastro,
        temSelfieRosto: Boolean(selfieRosto),
      }),
    },
    fileToContentPart(documento, "cna.pdf"),
  ];

  if (selfieRosto) {
    content.push(fileToContentPart(selfieRosto, "selfie.jpg"));
  }

  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      });

      const texto = completion.choices?.[0]?.message?.content || "{}";
      return JSON.parse(texto);
    } catch (error) {
      ultimoErro = error;
      if (!isErroTransitorio(error) || tentativa === MAX_TENTATIVAS) {
        throw error;
      }
      await aguardar(1000 * tentativa);
    }
  }

  throw ultimoErro;
}
