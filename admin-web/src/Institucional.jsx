import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { IconCheck, IconLink } from './Icons';

// Textos institucionais que aparecem no app: "Sobre o app" e "Seja nosso
// parceiro" (texto + link do formulário de parceria, ex.: Google Forms).
// Documento: configuracoes/institucional.
export default function Institucional({ showToast }) {
  const [form, setForm] = useState({ sobreTexto: '', parceiroTexto: '', parceiroLink: '' });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'institucional'), (snap) => {
    if (!carregado) {
      const d = snap.data() || {};
      setForm({ sobreTexto: d.sobreTexto || '', parceiroTexto: d.parceiroTexto || '', parceiroLink: d.parceiroLink || '' });
      setCarregado(true);
    }
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const salvar = async () => {
    const link = form.parceiroLink.trim();
    if (link && !/^https?:\/\//i.test(link)) { showToast('O link precisa começar com https://', 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'institucional'), {
        sobreTexto: form.sobreTexto.trim(),
        parceiroTexto: form.parceiroTexto.trim(),
        parceiroLink: link,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Textos publicados no app.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="screen-content" style={{ maxWidth: 820 }}>
      <div className="screen-header">
        <h1 className="screen-title">Sobre e parcerias</h1>
        <p className="screen-sub">
          Textos das telas "Sobre o app" e "Seja nosso parceiro", no menu e no Perfil do app.
          Enquanto um campo estiver vazio, o app mostra um texto padrão.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Sobre o app</h2>
        <div className="field-group">
          <label>O que é o Atravessia</label>
          <textarea rows={8} value={form.sobreTexto} onChange={e => set('sobreTexto', e.target.value)}
            placeholder="Conte o que é o app, para quem ele é e como ele acolhe." style={{ resize: 'vertical' }} />
          <span className="field-hint">Use uma linha em branco para separar parágrafos.</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Seja nosso parceiro</h2>
        <div className="field-group">
          <label>Texto-convite</label>
          <textarea rows={6} value={form.parceiroTexto} onChange={e => set('parceiroTexto', e.target.value)}
            placeholder="Explique como funciona a parceria e quem pode participar." style={{ resize: 'vertical' }} />
        </div>
        <div className="field-group">
          <label>Link do formulário de parceria</label>
          <input type="url" value={form.parceiroLink} onChange={e => set('parceiroLink', e.target.value)}
            placeholder="https://forms.gle/..." />
          <span className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconLink size={14} /> No app, o botão "Quero ser parceiro" abre este link. Sem link, o botão não aparece.
          </span>
        </div>
      </div>

      <button className="btn-primary" onClick={salvar} disabled={salvando || !carregado}>
        <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
      </button>
    </div>
  );
}
