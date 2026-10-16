// Nome para mostrar nas saudações. O apelido às vezes chega preenchido pelo
// preenchimento automático do celular com algo que não é um nome (senha gerada,
// e-mail, código). Só usamos o texto se ele parecer um nome de verdade.
const PARECE_NOME = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .-]{0,29}$/;
const VOGAL = /[aeiouyáàâãéêíóôõúüøæ]/i;

export function pareceNome(texto) {
  const t = String(texto || '').trim();
  if (!t || !PARECE_NOME.test(t) || !VOGAL.test(t)) return false;
  // Palavras longas sem vogal suficiente ou com muitas consoantes seguidas não são nomes.
  if (/[^aeiouyáàâãéêíóôõúüøæ\s'.-]{5,}/i.test(t)) return false;
  // Maiúscula no meio da palavra (ex.: "kdJaHsu") é sinal de código gerado.
  if (/[a-zß-ÿ][A-ZÀ-Þ]/.test(t)) return false;
  return true;
}

export function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  return pareceNome(p) ? p : '';
}

export function nomeDeExibicao({ apelido, nome } = {}) {
  if (pareceNome(apelido)) return String(apelido).trim();
  return primeiroNome(nome) || 'Você';
}
