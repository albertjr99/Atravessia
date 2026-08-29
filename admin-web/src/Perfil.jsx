import React, { useState, useEffect } from 'react';
import { auth, db, storage } from './firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { IconCamera, IconTrash, IconCheck } from './Icons';

export default function Perfil({ showToast, perfil }) {
  const [form, setForm] = useState({ nome: '', telefone: '', bio: '' });
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState(null);

  useEffect(() => {
    if (!perfil) return;
    setForm({
      nome: perfil.nome || '',
      telefone: perfil.telefone || '',
      bio: perfil.bio || '',
    });
  }, [perfil?.uid, perfil?.nome, perfil?.telefone, perfil?.bio]);

  const uid = perfil?.uid;
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const salvar = async () => {
    if (!uid) return;
    if (!form.nome.trim()) { showToast('Informe seu nome.', 'error'); return; }
    setSalvando(true);
    try {
      await setDoc(doc(db, 'usuarios', uid), {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        bio: form.bio.trim(),
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      showToast('Perfil atualizado.');
    } catch (e) {
      showToast('Não foi possível salvar: ' + (e?.message || ''), 'error');
    }
    setSalvando(false);
  };

  const enviarFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uid) return;

    if (!file.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('A imagem deve ter no máximo 5 MB.', 'error');
      return;
    }

    const caminho = `perfis/${uid}/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const tarefa = uploadBytesResumable(sRef(storage, caminho), file);
    setProgresso(0);

    tarefa.on('state_changed',
      snap => setProgresso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => { setProgresso(null); showToast('Erro ao enviar a imagem.', 'error'); },
      async () => {
        try {
          const url = await getDownloadURL(tarefa.snapshot.ref);
          const anterior = perfil?.fotoPath;
          await setDoc(doc(db, 'usuarios', uid), {
            fotoUrl: url, fotoPath: caminho, atualizadoEm: serverTimestamp(),
          }, { merge: true });
          if (anterior) { try { await deleteObject(sRef(storage, anterior)); } catch {} }
          showToast('Foto atualizada.');
        } catch (err) {
          showToast('Erro ao salvar a foto: ' + (err?.message || ''), 'error');
        }
        setProgresso(null);
      }
    );
  };

  const removerFoto = async () => {
    if (!uid || !perfil?.fotoUrl) return;
    if (!window.confirm('Remover sua foto de perfil?')) return;
    try {
      if (perfil.fotoPath) { try { await deleteObject(sRef(storage, perfil.fotoPath)); } catch {} }
      await setDoc(doc(db, 'usuarios', uid), { fotoUrl: '', fotoPath: '' }, { merge: true });
      showToast('Foto removida.');
    } catch (e) {
      showToast('Não foi possível remover: ' + (e?.message || ''), 'error');
    }
  };

  const redefinirSenha = async () => {
    if (!perfil?.email) return;
    if (!window.confirm(`Enviar um link de redefinição de senha para ${perfil.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, perfil.email);
      showToast('Link enviado. Confira sua caixa de entrada.');
    } catch (e) {
      showToast('Não foi possível enviar: ' + (e?.message || ''), 'error');
    }
  };

  const inicial = (form.nome || perfil?.email || 'A').charAt(0).toUpperCase();

  return (
    <div className="screen-content" style={{ maxWidth: 720 }}>
      <div className="screen-header">
        <h1 className="screen-title">Meu perfil</h1>
        <p className="screen-sub">
          Seus dados e sua foto aparecem no painel. Apenas você pode editá-los.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Foto</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          {perfil?.fotoUrl ? (
            <img
              src={perfil.fotoUrl}
              alt={form.nome}
              style={{
                width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid var(--primary-200)',
              }}
            />
          ) : (
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: 'linear-gradient(140deg, var(--primary), var(--primary-700))',
              display: 'grid', placeItems: 'center',
              color: '#fff', fontSize: 32, fontWeight: 600,
            }}>
              {inicial}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 210 }}>
            <label className="btn-ghost" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <IconCamera size={16} />
              {perfil?.fotoUrl ? 'Trocar foto' : 'Enviar foto'}
              <input type="file" accept="image/*" onChange={enviarFoto} style={{ display: 'none' }} />
            </label>
            {perfil?.fotoUrl && (
              <button className="btn-ghost" style={{ marginLeft: 8 }} onClick={removerFoto}>
                <IconTrash size={16} /> Remover
              </button>
            )}
            <p className="field-hint" style={{ marginTop: 9 }}>
              JPG ou PNG quadrado, até 5 MB.
            </p>
            {progresso !== null && (
              <>
                <div className="upload-progress">
                  <div className="upload-progress-bar" style={{ width: `${progresso}%` }} />
                </div>
                <span className="field-hint">{progresso}% enviado…</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Dados pessoais</h2>

        <div className="field-row">
          <div className="field-group">
            <label>Nome completo</label>
            <input
              type="text" value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="field-group">
            <label>Telefone</label>
            <input
              type="tel" value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <div className="field-group">
          <label>E-mail</label>
          <input type="email" value={perfil?.email || ''} disabled
            style={{ background: 'var(--surface-2)', color: 'var(--text-light)' }} />
          <span className="field-hint">O e-mail de acesso não pode ser alterado por aqui.</span>
        </div>

        <div className="field-group">
          <label>Apresentação</label>
          <textarea
            value={form.bio} rows={3}
            onChange={e => set('bio', e.target.value)}
            placeholder="Uma breve descrição sobre você."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            <IconCheck size={16} />
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Segurança</h2>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', margin: '0 0 16px' }}>
          Enviamos um link seguro para o seu e-mail para que você mesma defina uma nova senha.
        </p>
        <button className="btn-ghost" onClick={redefinirSenha}>
          Redefinir minha senha
        </button>
      </div>
    </div>
  );
}
