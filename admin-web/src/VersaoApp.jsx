import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { IconCheck, IconDownload } from './Icons';

const VERSAO_RE = /^\d+(\.\d+){0,3}$/;
const CODIGO_RE = /^\d{1,9}$/;
const NOVIDADES_PADRAO = 'Melhorias de estabilidade e novos cuidados para acompanhar a sua travessia.';

// Aviso de atualização do app. Documento: configuracoes/versaoApp.
// O app compara a versão instalada (nome e versionCode) com este documento ao
// abrir e ao voltar para a frente:
// - abaixo de versaoRecente/versionCodeRecente → aviso com "Atualizar" e
//   "Agora não" (volta em 24 h);
// - abaixo de versaoMinima/versionCodeMinimo, ou "obrigatória" ligada →
//   aviso que bloqueia o app até atualizar.
export default function VersaoApp({ showToast }) {
  const [form, setForm] = useState({
    versaoMinima: '', versaoRecente: '', versionCodeMinimo: '', versionCodeRecente: '', obrigatoria: false, novidades: '',
  });
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState('opcional');

  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'versaoApp'), (snap) => {
    if (!carregado) {
      const d = snap.data() || {};
      setForm({
        versaoMinima: d.versaoMinima || '',
        versaoRecente: d.versaoRecente || '',
        versionCodeMinimo: d.versionCodeMinimo ? String(d.versionCodeMinimo) : '',
        versionCodeRecente: d.versionCodeRecente ? String(d.versionCodeRecente) : '',
        obrigatoria: d.obrigatoria === true,
        novidades: d.novidades || '',
      });
      if (d.obrigatoria === true) setPrevia('obrigatoria');
      setCarregado(true);
    }
  }, () => setCarregado(true)), [carregado]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const salvar = async () => {
    const versaoMinima = form.versaoMinima.trim();
    const versaoRecente = form.versaoRecente.trim();
    const codMin = form.versionCodeMinimo.trim();
    const codRec = form.versionCodeRecente.trim();
    if ((versaoMinima && !VERSAO_RE.test(versaoMinima)) || (versaoRecente && !VERSAO_RE.test(versaoRecente))) {
      showToast('Use números e pontos na versão, por exemplo 1.20.1.', 'error');
      return;
    }
    if ((codMin && !CODIGO_RE.test(codMin)) || (codRec && !CODIGO_RE.test(codRec))) {
      showToast('O versionCode é só um número inteiro, por exemplo 50.', 'error');
      return;
    }
    if (form.obrigatoria && !versaoRecente && !codRec) {
      showToast('Para tornar obrigatória, preencha a versão mais recente (ou o versionCode dela).', 'error');
      return;
    }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'configuracoes', 'versaoApp'), {
        versaoMinima,
        versaoRecente,
        versionCodeMinimo: codMin ? Number(codMin) : null,
        versionCodeRecente: codRec ? Number(codRec) : null,
        obrigatoria: !!form.obrigatoria,
        novidades: form.novidades.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Aviso de versão publicado. Ele aparece quando o app for aberto.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  const temRecente = !!(form.versaoRecente.trim() || form.versionCodeRecente.trim());
  const temMinima = !!(form.versaoMinima.trim() || form.versionCodeMinimo.trim());
  const resumo = !temRecente && !temMinima
    ? 'Nenhum aviso ativo: preencha a versão mais recente para avisar quem ainda não atualizou.'
    : form.obrigatoria
      ? `Quem estiver abaixo de ${rotulo(form.versaoRecente, form.versionCodeRecente)} precisará atualizar para continuar usando o app.`
      : [
        temRecente && `Quem estiver abaixo de ${rotulo(form.versaoRecente, form.versionCodeRecente)} verá o convite com "Atualizar" e "Agora não".`,
        temMinima && `Abaixo de ${rotulo(form.versaoMinima, form.versionCodeMinimo)} a atualização é obrigatória.`,
      ].filter(Boolean).join(' ');

  return (
    <div className="screen-content" style={{ maxWidth: 980 }}>
      <div className="screen-header">
        <h1 className="screen-title">Versão do app</h1>
        <p className="screen-sub">
          Avise quem ainda não atualizou o Atravessia. O aviso aparece na tela assim que a pessoa abre o app
          (ou volta para ele) — não é preciso enviar notificação.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Como usar</h2>
        <ol style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Publique a versão nova na Play Store e espere ela ficar disponível para todo mundo.</li>
          <li>Em <b>Versão mais recente</b>, coloque a versão publicada (ex.: 1.20.2) e, se quiser mais precisão, o <b>versionCode</b> dela (ex.: 51).</li>
          <li>
            <b>Opcional</b> (padrão): a pessoa vê o convite com <i>Atualizar</i> e <i>Agora não</i>; se escolher
            “Agora não”, segue na versão antiga e o convite volta depois de 24 h.
          </li>
          <li>
            <b>Obrigatória</b>: ligue a chave abaixo ou preencha a <b>Versão mínima</b>. Quem estiver abaixo não
            consegue usar o app até atualizar (o botão leva direto à Play Store).
          </li>
          <li>Escreva as novidades e confira a prévia. Depois, <b>Salvar e publicar</b>.</li>
        </ol>
        <span className="field-hint" style={{ display: 'block', marginTop: 10 }}>
          O aviso existe no app a partir da versão 1.20.0 (versionCode 49). Quem ainda estiver numa versão anterior
          só recebe o aviso da própria Play Store.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconDownload size={18} /> Versões
            </h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field-group" style={{ flex: '2 1 180px' }}>
                <label>Versão mais recente na loja</label>
                <input value={form.versaoRecente} onChange={e => set('versaoRecente', e.target.value)} placeholder="Ex.: 1.20.2" />
              </div>
              <div className="field-group" style={{ flex: '1 1 120px' }}>
                <label>versionCode (opcional)</label>
                <input inputMode="numeric" value={form.versionCodeRecente} onChange={e => set('versionCodeRecente', e.target.value)} placeholder="Ex.: 51" />
              </div>
            </div>
            <span className="field-hint" style={{ display: 'block', marginTop: -6, marginBottom: 14 }}>
              Quem tiver uma versão anterior recebe o convite.
            </span>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="field-group" style={{ flex: '2 1 180px' }}>
                <label>Versão mínima (opcional)</label>
                <input value={form.versaoMinima} onChange={e => set('versaoMinima', e.target.value)} placeholder="Ex.: 1.19.0" />
              </div>
              <div className="field-group" style={{ flex: '1 1 120px' }}>
                <label>versionCode mínimo</label>
                <input inputMode="numeric" value={form.versionCodeMinimo} onChange={e => set('versionCodeMinimo', e.target.value)} placeholder="Ex.: 45" />
              </div>
            </div>
            <span className="field-hint" style={{ display: 'block', marginTop: -6, marginBottom: 14 }}>
              Abaixo desta versão, a atualização é obrigatória (o aviso não tem “Agora não”).
            </span>

            <label className="toggle-row" style={{ margin: 0 }}>
              <span className="toggle">
                <input type="checkbox" checked={!!form.obrigatoria}
                  onChange={e => { set('obrigatoria', e.target.checked); setPrevia(e.target.checked ? 'obrigatoria' : 'opcional'); }} />
                <span className="toggle-slider" />
              </span>
              <span style={{ fontWeight: 650 }}>
                {form.obrigatoria ? 'Versão mais recente obrigatória' : 'Versão mais recente opcional'}
              </span>
            </label>
            <span className="field-hint">Use “obrigatória” só para correções importantes: todas as pessoas precisarão atualizar para continuar.</span>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 className="card-title">O que há de novo</h2>
            <div className="field-group">
              <label>Novidades (aparece no aviso)</label>
              <textarea rows={5} value={form.novidades} onChange={e => set('novidades', e.target.value)}
                placeholder="Ex.: Check-in mais rápido, novos áudios e correções." style={{ resize: 'vertical' }} />
            </div>
          </div>

          <p className="field-hint" style={{ marginBottom: 14 }}>{resumo}</p>
          <button className="btn-primary" onClick={salvar} disabled={salvando || !carregado}>
            <IconCheck size={16} /> {salvando ? 'Salvando…' : 'Salvar e publicar'}
          </button>
        </div>

        <div className="card" style={{ flex: '0 1 360px', minWidth: 0 }}>
          <h2 className="card-title">Prévia no app</h2>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[['opcional', 'Opcional'], ['obrigatoria', 'Obrigatória']].map(([id, nome]) => (
              <button key={id} type="button" onClick={() => setPrevia(id)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 999, cursor: 'pointer', fontWeight: 650,
                  border: '1px solid #6B54C6', background: previa === id ? '#6B54C6' : 'transparent',
                  color: previa === id ? '#fff' : '#6B54C6',
                }}>{nome}</button>
            ))}
          </div>
          <PreviaAviso obrigatoria={previa === 'obrigatoria'} novidades={form.novidades} />
        </div>
      </div>
    </div>
  );
}

function rotulo(versao, codigo) {
  const v = String(versao || '').trim();
  const c = String(codigo || '').trim();
  if (v && c) return `${v} (versionCode ${c})`;
  return v || `versionCode ${c}`;
}

// Reprodução do aviso do app (AvisoAtualizacao.js).
function PreviaAviso({ obrigatoria, novidades }) {
  const roxo = 'linear-gradient(135deg, #8B74D9, #6B54C6)';
  return (
    <div style={{ background: 'rgba(46,39,64,0.55)', borderRadius: 24, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '22px 18px 10px', textAlign: 'center', color: '#2E2740' }}>
        <div style={{ width: 52, height: 52, borderRadius: 18, background: roxo, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24 }}>
          {obrigatoria ? '↑' : '✦'}
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, lineHeight: 1.25 }}>Uma nova versão do Atravessia chegou</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: '#5E5670', marginTop: 6 }}>
          {obrigatoria
            ? 'Para continuar usando o app com tudo funcionando bem, é preciso atualizar. Leva só um instante.'
            : 'Preparamos melhorias com carinho para a sua travessia. Atualize quando puder.'}
        </div>
        <div style={{ textAlign: 'left', background: 'rgba(139,122,192,0.10)', borderRadius: 14, padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B54C6', marginBottom: 3 }}>O que há de novo</div>
          <div style={{ fontSize: 13, lineHeight: 1.45, color: '#5E5670', whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto' }}>
            {novidades.trim() || NOVIDADES_PADRAO}
          </div>
        </div>
        <div style={{ background: roxo, color: '#fff', fontWeight: 700, borderRadius: 999, padding: '12px 0', marginTop: 14 }}>Atualizar</div>
        <div style={{ fontSize: obrigatoria ? 11.5 : 14, fontWeight: obrigatoria ? 400 : 700, color: '#5E5670', padding: '10px 0' }}>
          {obrigatoria ? 'Esta atualização é necessária para continuar.' : 'Agora não'}
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: 11.5, textAlign: 'center', marginTop: 10, opacity: 0.9 }}>
        {obrigatoria
          ? 'Bloqueia o app: o voltar do Android não fecha. “Atualizar” abre a Play Store.'
          : '“Agora não” fecha o aviso; ele volta depois de 24 h.'}
      </div>
    </div>
  );
}
