-- Banco próprio desta API (independente do Supabase do app principal).
-- Guarda os arquivos enviados (storage) e o status de cada verificação.
-- O advogado_id só é conhecido/gravado na segunda chamada (confirmação),
-- pois a primeira chamada não tem acesso ao banco do app principal.

create extension if not exists pgcrypto;

create table if not exists public.verificacoes_oab (
  id uuid primary key default gen_random_uuid(),

  -- dados informados pela plataforma na 1a chamada
  nome_cadastro text not null,
  oab_cadastro text not null,
  uf_cadastro text not null,

  -- arquivos enviados (Supabase Storage)
  documento_path text not null,
  selfie_rosto_path text,

  -- resultado da análise
  status text not null check (status in ('VERIFIED', 'ERROR', 'MANUAL_REVIEW')),
  motivo text,
  analise_ia jsonb,

  -- preenchido só na 2a chamada (confirmação), quando status = VERIFIED
  advogado_id uuid,
  confirmado_em timestamp with time zone,

  created_at timestamp with time zone not null default now()
);

create index if not exists verificacoes_oab_advogado_id_idx
  on public.verificacoes_oab (advogado_id);

create index if not exists verificacoes_oab_oab_uf_idx
  on public.verificacoes_oab (oab_cadastro, uf_cadastro);

-- Criar manualmente no painel (Storage > New bucket): "verificacoes", privado.
