import { GoogleGenAI, Type } from "@google/genai";

let ai = null;

function getClient() {
  if (ai) return ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  ai = new GoogleGenAI({ apiKey });
  return ai;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    documento_legivel: {
      type: Type.BOOLEAN,
      description: "Se foi possível ler os dados do documento com clareza.",
    },
    documento_parece_autentico: {
      type: Type.BOOLEAN,
      description:
        "False se houver indícios de print de tela, edição, montagem ou documento de terceiro óbvio.",
    },
    nome_extraido: { type: Type.STRING },
    oab_numero_extraido: { type: Type.STRING },
    oab_uf_extraido: { type: Type.STRING },
    nome_compativel: {
      type: Type.BOOLEAN,
      description: "Se nome_extraido corresponde ao nome informado no cadastro.",
    },
    oab_numero_compativel: { type: Type.BOOLEAN },
    oab_uf_compativel: { type: Type.BOOLEAN },
    confianca_facial: {
      type: Type.STRING,
      enum: ["ALTA", "MEDIA", "BAIXA", "NAO_AVALIADO"],
      description:
        "Similaridade estrutural entre o rosto da selfie e o rosto do documento, ignorando cabelo, barba, peso, idade da foto e iluminação.",
    },
    motivo_confianca_facial: { type: Type.STRING },
    observacoes: {
      type: Type.STRING,
      description: "Qualquer inconsistência relevante encontrada.",
    },
  },
  required: [
    "documento_legivel",
    "documento_parece_autentico",
    "nome_extraido",
    "oab_numero_extraido",
    "oab_uf_extraido",
    "nome_compativel",
    "oab_numero_compativel",
    "oab_uf_compativel",
    "confianca_facial",
    "motivo_confianca_facial",
    "observacoes",
  ],
};

function buildPrompt({ nomeCadastro, oabCadastro, ufCadastro, temSelfieRosto }) {
  return `Você é um analista de compliance verificando o cadastro de um advogado em uma plataforma jurídica brasileira.

Dados informados pelo advogado no cadastro:
- Nome: ${nomeCadastro}
- Número da OAB: ${oabCadastro}
- UF da OAB: ${ufCadastro}

Você receberá:
1. Uma imagem ou PDF da Carteira/Credencial da OAB (CNA) do advogado.
${temSelfieRosto ? "2. Uma selfie do rosto do advogado, para comparação facial com a foto do documento." : ""}

Tarefas:
1. Extraia do documento: nome completo, número da OAB e UF.
2. Compare cada campo extraído com o que foi informado no cadastro. Pequenas variações de acentuação, abreviação de nomes do meio, ou formatação do número da OAB (pontos, hífen) NÃO devem ser tratadas como incompatibilidade.
3. Avalie sinais de fraude: foto de tela, documento adulterado, marcas de edição, baixa resolução proposital, etc. em "documento_parece_autentico".
${
  temSelfieRosto
    ? `4. Compare o rosto da selfie com o rosto da foto do documento. Avalie SIMILARIDADE ESTRUTURAL (formato do rosto, olhos, nariz, orelhas, proporções faciais) e IGNORE diferenças temporárias como corte de cabelo, barba, peso, maquiagem, idade da foto do documento ou qualidade/iluminação da selfie. Seja permissivo: o objetivo é pegar fraude grosseira (pessoa claramente diferente), não fazer biometria forense. Retorne "ALTA" se claramente a mesma pessoa, "MEDIA" se plausivelmente a mesma pessoa com dúvida razoável, "BAIXA" se há indícios fortes de serem pessoas diferentes.`
    : '4. Não há selfie de rosto para comparar — retorne "confianca_facial": "NAO_AVALIADO".'
}
5. Responda exclusivamente no formato JSON definido pelo schema.`;
}

function fileToPart(file) {
  return {
    inlineData: {
      mimeType: file.mimeType,
      data: file.base64,
    },
  };
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
  const client = getClient();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const parts = [
    { text: buildPrompt({ nomeCadastro, oabCadastro, ufCadastro, temSelfieRosto: Boolean(selfieRosto) }) },
    fileToPart(documento),
  ];

  if (selfieRosto) {
    parts.push(fileToPart(selfieRosto));
  }

  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const text = response.text;
  return JSON.parse(text);
}
