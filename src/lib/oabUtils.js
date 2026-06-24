export const ALLOWED_STATES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function normalizeOab(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, "");

  if (!normalized || normalized.length > 30) return null;
  if (!/^[0-9A-Za-z.-]+$/.test(normalized)) return null;

  return normalized.toUpperCase();
}

export function normalizeUf(value) {
  const uf = String(value || "").trim().toUpperCase();
  return ALLOWED_STATES.has(uf) ? uf : null;
}

export function normalizeNome(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Compara nomes tolerando acentuação, abreviações e ordem de sobrenomes
 * compostos — dois nomes "casam" se todo token relevante (>2 letras) de
 * um aparecer no outro.
 */
export function nomesCorrespondem(nomeCadastro, nomeDocumento) {
  const limpar = (nome) =>
    String(nome || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .split(/\s+/)
      .filter((token) => token.length > 2);

  const tokensCadastro = limpar(nomeCadastro);
  const tokensDocumento = limpar(nomeDocumento);

  if (!tokensCadastro.length || !tokensDocumento.length) return false;

  const intersecao = tokensCadastro.filter((t) => tokensDocumento.includes(t));
  const minimoNecessario = Math.ceil(tokensCadastro.length * 0.7);

  return intersecao.length >= minimoNecessario;
}
