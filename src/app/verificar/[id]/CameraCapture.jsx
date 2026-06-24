"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Captura uma foto via câmera do dispositivo.
 * - `overlay="oval"` desenha a moldura de rosto (estilo selfie de banco).
 * - `overlay="documento"` desenha um retângulo guia para o documento.
 * - `facingMode` controla câmera frontal ("user") ou traseira ("environment").
 */
export default function CameraCapture({ overlay, facingMode, onCapturar, onCancelar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [foto, setFoto] = useState(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function iniciarCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });

        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setPronto(true);
        }
      } catch (err) {
        setErro(
          "Não foi possível acessar a câmera. Verifique se você concedeu permissão e tente novamente.",
        );
      }
    }

    iniciarCamera();

    return () => {
      ativo = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        setFoto(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapturar(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  function tirarNovamente() {
    setFoto(null);
    setPronto(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setPronto(true);
        }
      });
  }

  function aoEscolherArquivoFallback(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(URL.createObjectURL(file));
    onCapturar(file);
  }

  // Fallback que usa o app de câmera nativo do celular em vez de
  // getUserMedia. Funciona mesmo em navegadores embutidos restritos
  // (ex.: link aberto direto de dentro do app de e-mail) ou quando a
  // pessoa negou a permissão de câmera no navegador por engano — nesses
  // casos não dá pra simplesmente pedir a permissão de novo.
  const botaoFallback = (
    <label style={styles.linkFallback}>
      Problema com a câmera? Tirar foto pelo app do celular
      <input
        type="file"
        accept="image/*"
        capture={facingMode === "user" ? "user" : "environment"}
        onChange={aoEscolherArquivoFallback}
        style={{ display: "none" }}
      />
    </label>
  );

  if (erro) {
    return (
      <div style={styles.erroBox}>
        <p>{erro}</p>
        <p style={styles.erroDica}>
          Isso pode acontecer se você abriu esse link direto de dentro do app de
          e-mail, ou se a permissão de câmera foi negada antes.
        </p>
        <div style={styles.acoes}>
          <button style={styles.botaoSecundario} onClick={onCancelar}>
            Voltar
          </button>
          <label style={styles.botaoPrimario}>
            Tirar foto
            <input
              type="file"
              accept="image/*"
              capture={facingMode === "user" ? "user" : "environment"}
              onChange={aoEscolherArquivoFallback}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.cameraWrapper}>
        {!foto && (
          <>
            <video ref={videoRef} style={styles.video} muted playsInline />
            {overlay === "oval" && <div style={styles.ovalOverlay} />}
            {overlay === "documento" && <div style={styles.docOverlay} />}
          </>
        )}
        {foto && <img src={foto} alt="Foto capturada" style={styles.video} />}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!foto ? (
        <>
          <div style={styles.acoes}>
            <button style={styles.botaoSecundario} onClick={onCancelar}>
              Cancelar
            </button>
            <button style={styles.botaoPrimario} onClick={capturar} disabled={!pronto}>
              Capturar
            </button>
          </div>
          {botaoFallback}
        </>
      ) : (
        <div style={styles.acoes}>
          <button style={styles.botaoSecundario} onClick={tirarNovamente}>
            Tirar novamente
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: 16, alignItems: "center" },
  cameraWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    aspectRatio: "3 / 4",
    borderRadius: 16,
    overflow: "hidden",
    background: "#000",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  ovalOverlay: {
    position: "absolute",
    inset: 0,
    border: "4px solid rgba(212, 175, 55, 0.9)",
    borderRadius: "50% / 60%",
    margin: "10% 18%",
    boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)",
  },
  docOverlay: {
    position: "absolute",
    inset: 0,
    border: "3px dashed rgba(212, 175, 55, 0.9)",
    borderRadius: 12,
    margin: "20% 6%",
  },
  acoes: { display: "flex", gap: 12 },
  botaoPrimario: {
    background: "var(--color-gold)",
    color: "#1a1a1a",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
  },
  botaoSecundario: {
    background: "transparent",
    color: "var(--color-silver)",
    border: "1px solid var(--color-silver-dark)",
    borderRadius: 8,
    padding: "12px 24px",
    cursor: "pointer",
  },
  erroBox: { textAlign: "center", color: "var(--color-silver)" },
  erroDica: { fontSize: 13, color: "var(--color-silver-dark)", marginTop: 8 },
  linkFallback: {
    fontSize: 13,
    color: "var(--color-silver-dark)",
    textDecoration: "underline",
    cursor: "pointer",
    textAlign: "center",
  },
};
