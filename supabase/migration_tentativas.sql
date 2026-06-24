-- Conta quantas vezes o advogado tentou enviar documento/selfie numa
-- mesma sessão. Falhas recuperáveis (documento ilegível, selfie de
-- baixa confiança) não finalizam a sessão — só incrementam esse contador
-- e pedem nova foto. Depois de um limite, vira MANUAL_REVIEW para não
-- permitir tentativas infinitas (e não consumir Gemini sem limite).

alter table public.sessoes_verificacao
  add column if not exists tentativas integer not null default 0;
