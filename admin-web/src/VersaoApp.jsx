import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { IconCheck, IconDownload } from './Icons';

const VERSAO_RE = /^\d+(\.\d+){0,3}$/;

// Aviso de atualização do app. Documento: configuracoes/versaoApp.
// versaoRecente → convite com "Depois" (volta em 24 h); versaoMinima ou
// "obrigatória" → convite sem "Depois". "novidades" aparece no convite.
export default function VersaoApp({ showToast }) {
  const [form, setForm] = useState({ versaoMinima: '', versaoRecente: '', obrigatoria: false, novidades: '' });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'versaoApp'), (snap) => {
    if (!carregado) {
      const d = snap.data() || {};
      setForm({
        versaoMinima: d.versaoMinima || '',
        versaoRecente: d.versaoRecente || '',
        obrigatoria: d.obrigatoria === true,
        novidades: d.novidades || '',
      });
      setCarregado(true);
    }
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const salvar = async () => {
    const versaoMinima = form.versaoMinima.trim();
    const versaoRecente = form.versaoRecente.trim();
    if ((versaoMinima && !VERSAO_RE.test(versaoMinima)) || (versaoRecente && !VERSAO_RE.test(versaoRecente))) {
      showToast('Use números e pontos na versão, por exemplo 1.19.12.', 'error');
      return;
    }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'versaoApp'), {
        versaoMinima,
        versaoRecente,
        obrigatoria: !!form.obrigatoria,
        novidades: form.novidades.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Aviso de versão publicado no app.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  return (
    <div className="screen-content" style={{ maxWidth: 820 }}>
      <div className="screen-header">
        <h1 className="screen-title">Versão do app</h1>
        <p className="screen-sub">
          Depois de publicar uma versão nova na Play Store, atualize aqui para avisar as usuárias.
          Quem estiver com uma versão mais antiga verá um convite para atualizar ao abrir o app.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconDownload size={18} /> Versões
        </h2>
        <div className="field-group">
          <label>Versão mais recente na loja</label>
          <input value={form.versaoRecente} onChange={e => set('versaoRecente', e.target.value)} placeholder="Ex.: 1.19.12" />
          <span className="field-hint">Quem tiver uma versão anterior recebe o convite, com a opção "Depois" (volta a lembrar em 24 h).</span>
        </div>
        <div className="field-group">
          <label>Versão mínima</label>
          <input value={form.versaoMinima} onChange={e => set('versaoMinima', e.target.value)} placeholder="Ex.: 1.19.0" />
          <span className="field-hint">Abaixo desta versão, a atualização é obrigatória (o convite não tem "Depois").</span>
        </div>
        <label className="toggle-row" style={{ margin: 0 }}>
          <span className="toggle">
            <input type="checkbox" checked={!!form.obrigatoria} onChange={e => set('obrigatoria', e.target.checked)} />
            <span className="toggle-slider" />
          </span>
          <span style={{ fontWeight: 650 }}>
            {form.obrigatoria ? 'Versão mais recente obrigatória' : 'Versão mais recente opcional'}
          </span>
        </label>
        <span className="field-hint">Use "obrigatória" só para correções importantes: todas precisarão atualizar para continuar.</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">O que há de novo</h2>
        <div className="field-group">
          <label>Novidades (aparece no convite)</label>
          <textarea rows={5} value={form.novidades} onChange={e => set('novidades', e.target.value)}
            placeholder="Ex.: Check-in mais rápido, novos áudios e correções." style={{ resize: 'vertical' }} />
        </div>
      </div>

      <button className="btn-primary" onClick={salvar} disabled={salvando || !carregado}>
        <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
      </button>
    </div>
  );
}
