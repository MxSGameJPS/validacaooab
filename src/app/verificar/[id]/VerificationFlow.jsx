"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import CameraCapture from "./CameraCapture";

const LOGIN_URL = "https://www.socialjuridico.com.br/login";
const WHATSAPP_PRINCIPAL = "5515981657317";
const WHATSAPP_ATENDIMENTO = "5515992653066";

export default function VerificationFlow({ sessaoId }) {
  const [etapa, setEtapa] = useState("carregando");
  const [sessao, setSessao] = useState(null);
  const [erroCarregamento, setErroCarregamento] = useState(null);
  const [tipoCna, setTipoCna] = useState(null);
  const [documentoBlob, setDocumentoBlob] = useState(null);
  const [selfieBlob, setSelfieBlob] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [avisoRetomar, setAvisoRetomar] = useState(null);

  useEffect(() => {
    fetch(`/api/sessoes/${sessaoId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setErroCarregamento(data.message || "Sessão inválida.");
          setEtapa("erro");
          return;
        }
        if (data.expirada || data.status === "EXPIRADA") {
          setErroCarregamento(
            "Este link de verificação expirou. Volte ao Social Jurídico e solicite um novo.",
          );
          setEtapa("erro");
          return;
        }
        if (data.status !== "AGUARDANDO_ENVIO") {
          setErroCarregamento("Esta verificação já foi processada.");
          setEtapa("erro");
          return;
        }
        setSessao(data);
        setEtapa("apresentacao");
      })
      .catch(() => {
        setErroCarregamento("Não foi possível carregar a sessão de verificação.");
        setEtapa("erro");
      });
  }, [sessaoId]);

  function escolherTipoCna(tipo) {
    setTipoCna(tipo);
    setEtapa(tipo === "fisica" ? "captura_documento" : "upload_documento_digital");
  }

  function aoCapturarDocumento(blob) {
    setAvisoRetomar(null);
    setDocumentoBlob(blob);
    setEtapa("captura_selfie");
  }

  function aoEscolherArquivoDigital(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvisoRetomar(null);
    setDocumentoBlob(file);
    setEtapa("captura_selfie");
  }

  function aoCapturarSelfie(blob) {
    setAvisoRetomar(null);
    setSelfieBlob(blob);
    enviar(documentoBlob, blob);
  }

  async function enviar(documento, selfie) {
    setEtapa("enviando");
    setErroEnvio(null);

    try {
      const formData = new FormData();
      formData.append("documento", documento, "documento.jpg");
      if (selfie) formData.append("selfie_rosto", selfie, "selfie.jpg");

      const response = await fetch(`/api/sessoes/${sessaoId}/enviar`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!data.success) {
        setErroEnvio(data.message || "Falha ao enviar a verificação.");
        setEtapa("erro_envio");
        return;
      }

      if (data.status === "RETRY") {
        setAvisoRetomar(data.motivo);

        if (data.retomar === "documento") {
          setDocumentoBlob(null);
          setEtapa(tipoCna === "fisica" ? "captura_documento" : "upload_documento_digital");
        } else {
          setSelfieBlob(null);
          setEtapa("captura_selfie");
        }
        return;
      }

      setResultado(data);
      setEtapa("resultado");
    } catch {
      setErroEnvio("Falha de conexão ao enviar a verificação.");
      setEtapa("erro_envio");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <Image src="/Logo.png" alt="Social Jurídico" width={64} height={64} priority />
        </div>

        {etapa === "carregando" && <p style={styles.texto}>Carregando…</p>}

        {etapa === "erro" && (
          <div style={styles.center}>
            <p style={styles.texto}>{erroCarregamento}</p>
          </div>
        )}

        {etapa === "apresentacao" && sessao && (
          <div style={styles.center}>
            <h1 style={styles.titulo}>Verificação de identidade</h1>
            <p style={styles.texto}>
              Olá, {sessao.nome.split(" ")[0]}. Para liberar seu acesso como advogado
              verificado, precisamos confirmar sua identidade e seu registro na OAB{" "}
              {sessao.oab}/{sessao.uf}. Isso leva menos de 2 minutos.
            </p>
            <button style={styles.botaoPrimario} onClick={() => setEtapa("pergunta")}>
              Começar
            </button>
          </div>
        )}

        {etapa === "pergunta" && (
          <div style={styles.center}>
            <h2 style={styles.titulo}>Sua CNA é física ou digital?</h2>
            <div style={styles.acoesColuna}>
              <button style={styles.botaoPrimario} onClick={() => escolherTipoCna("fisica")}>
                CNA física
              </button>
              <button
                style={styles.botaoSecundario}
                onClick={() => escolherTipoCna("digital")}
              >
                CNA digital
              </button>
            </div>
          </div>
        )}

        {etapa === "upload_documento_digital" && (
          <div style={styles.center}>
            <h2 style={styles.titulo}>Envie sua CNA digital</h2>
            {avisoRetomar && <AvisoRetomar mensagem={avisoRetomar} />}
            <p style={styles.texto}>Aceitamos imagem (JPG/PNG) ou PDF, até 8MB.</p>
            <label style={styles.botaoPrimario}>
              Enviar CNA digital
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={aoEscolherArquivoDigital}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}

        {etapa === "captura_documento" && (
          <div style={styles.center}>
            <h2 style={styles.titulo}>Foto da sua CNA</h2>
            {avisoRetomar && <AvisoRetomar mensagem={avisoRetomar} />}
            <p style={styles.texto}>Posicione o documento dentro da moldura, com boa luz e sem reflexo.</p>
            <CameraCapture
              overlay="documento"
              facingMode="environment"
              onCapturar={aoCapturarDocumento}
              onCancelar={() => setEtapa("pergunta")}
            />
          </div>
        )}

        {etapa === "captura_selfie" && (
          <div style={styles.center}>
            <h2 style={styles.titulo}>Agora, sua selfie</h2>
            {avisoRetomar && <AvisoRetomar mensagem={avisoRetomar} />}
            <p style={styles.texto}>
              Centralize seu rosto dentro da moldura. Retire boné, touca, óculos escuros
              ou qualquer acessório que cubra o rosto.
            </p>
            <CameraCapture
              overlay="oval"
              facingMode="user"
              onCapturar={aoCapturarSelfie}
              onCancelar={() => setEtapa("pergunta")}
            />
          </div>
        )}

        {etapa === "enviando" && (
          <div style={styles.center}>
            <h2 style={styles.titulo}>Analisando seus dados…</h2>
            <p style={styles.texto}>Isso pode levar alguns segundos.</p>
          </div>
        )}

        {etapa === "erro_envio" && (
          <div style={styles.center}>
            <p style={styles.texto}>{erroEnvio}</p>
            <button
              style={styles.botaoSecundario}
              onClick={() => enviar(documentoBlob, selfieBlob)}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {etapa === "resultado" && resultado && (
          <ResultadoFinal resultado={resultado} nome={sessao?.nome} />
        )}
      </div>
    </main>
  );
}

function AvisoRetomar({ mensagem }) {
  return <p style={styles.aviso}>{mensagem} Tire a foto novamente.</p>;
}

function linkWhatsappSuporte(nome, numero) {
  const texto = `Olá, meu cadastro no Social Jurídico não foi verificado automaticamente${
    nome ? ` (${nome})` : ""
  } e preciso de ajuda.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function BotoesWhatsapp({ nome }) {
  return (
    <div style={styles.acoesColuna}>
      <a
        href={linkWhatsappSuporte(nome, WHATSAPP_PRINCIPAL)}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.botaoWhatsapp}
      >
        WhatsApp principal
      </a>
      <a
        href={linkWhatsappSuporte(nome, WHATSAPP_ATENDIMENTO)}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.botaoWhatsapp}
      >
        WhatsApp de atendimento
      </a>
    </div>
  );
}

function ResultadoFinal({ resultado, nome }) {
  if (resultado.status === "VERIFIED") {
    return (
      <div style={styles.center}>
        <h2 style={styles.titulo}>Identidade verificada!</h2>
        <p style={styles.texto}>
          Sua identidade e registro na OAB foram confirmados. Você já pode acessar a
          plataforma.
        </p>
        <a href={LOGIN_URL} style={styles.botaoPrimario}>
          Ir para o login
        </a>
      </div>
    );
  }

  if (resultado.status === "MANUAL_REVIEW") {
    return (
      <div style={styles.center}>
        <h2 style={styles.titulo}>Verificação em análise</h2>
        <p style={styles.texto}>
          Não conseguimos confirmar automaticamente. Nossa equipe vai analisar seus
          dados manualmente e você receberá um e-mail em breve. Se preferir, fale agora
          com nosso suporte pelo WhatsApp.
        </p>
        <BotoesWhatsapp nome={nome} />
      </div>
    );
  }

  return (
    <div style={styles.center}>
      <h2 style={styles.titulo}>Não foi possível verificar</h2>
      <p style={styles.texto}>
        Os dados do documento não coincidem com o cadastro informado. Fale com nosso
        suporte pelo WhatsApp pra resolver isso.
      </p>
      <BotoesWhatsapp nome={nome} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "var(--color-black-light)",
    border: "1px solid var(--color-brown)",
    borderRadius: 20,
    padding: "32px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  logoWrap: { display: "flex", justifyContent: "center" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" },
  titulo: { color: "var(--color-gold)", fontSize: 22, fontWeight: 700 },
  texto: { color: "var(--color-silver)", fontSize: 15, lineHeight: 1.5 },
  acoesColuna: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  botaoPrimario: {
    background: "var(--color-gold)",
    color: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
  },
  botaoSecundario: {
    background: "transparent",
    color: "var(--color-silver)",
    border: "1px solid var(--color-silver-dark)",
    borderRadius: 8,
    padding: "12px 24px",
    cursor: "pointer",
    textAlign: "center",
  },
  botaoWhatsapp: {
    background: "#25d366",
    color: "#0d2b18",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
  },
  aviso: {
    color: "#f5b942",
    fontSize: 13,
    background: "rgba(245, 185, 66, 0.12)",
    border: "1px solid rgba(245, 185, 66, 0.4)",
    borderRadius: 8,
    padding: "8px 12px",
    lineHeight: 1.4,
  },
};
