-- Sessões de verificação: o advogado_id já é conhecido no momento da
-- criação (o fluxo só começa depois do cadastro + confirmação de e-mail
-- no app principal), então a sessão já nasce vinculada a ele.

create table if not exists public.sessoes_verificacao (
  id uuid primary key default gen_random_uuid(),

  advogado_id uuid not null,
  nome_cadastro text not null,
  oab_cadastro text not null,
  uf_cadastro text not null,

  -- webhook do app principal, chamado quando a verificação terminar
  callback_url text not null,

  status text not null default 'AGUARDANDO_ENVIO'
    check (status in ('AGUARDANDO_ENVIO', 'VERIFIED', 'ERROR', 'MANUAL_REVIEW', 'EXPIRADA')),

  documento_path text,
  selfie_rosto_path text,
  motivo text,
  analise_ia jsonb,

  webhook_entregue boolean not null default false,
  webhook_tentativas integer not null default 0,

  expires_at timestamp with time zone not null default (now() + interval '30 minutes'),
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists sessoes_verificacao_advogado_id_idx
  on public.sessoes_verificacao (advogado_id);
