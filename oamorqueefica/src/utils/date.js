const TZ = 'America/Sao_Paulo';

// Returns today's date as YYYY-MM-DD in Brasília timezone (UTC-3)
export function hojeStrBR() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
}

// Formats a stored YYYY-MM-DD or ISO string as dd/mm/aaaa in Brasília timezone.
// ISO date-only strings are interpreted as UTC midnight; appending T12:00:00
// prevents off-by-one when the user is in a UTC- timezone.
export function formatDataBR(dataStr) {
  if (!dataStr) return '';
  const str = dataStr.length === 10 ? dataStr + 'T12:00:00' : dataStr;
  return new Date(str).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Returns current date+time as "dd/mm/aaaa às HH:MM" in Brasília timezone
export function agoraFormatadoBR() {
  const now = new Date();
  const data = now.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}
