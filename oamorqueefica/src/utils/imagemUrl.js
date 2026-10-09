// Links de compartilhamento do Google Drive ("drive.google.com/file/d/ID/view")
// abrem uma página, não a imagem — por isso o logotipo não carregava. Aqui o
// link é trocado pelo endereço direto da imagem. O arquivo precisa estar
// compartilhado como "Qualquer pessoa com o link". Mesma função em
// admin-web/src/parceriaUtils.js.
export function idDoDrive(url) {
  const s = String(url || '').trim();
  if (!/drive\.google\.com|docs\.google\.com/i.test(s)) return null;
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return m ? m[1] : null;
}

export function urlDeImagem(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const id = idDoDrive(s);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : s;
}
