import React, { useState } from 'react';
import { auth } from './firebase';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { IconSpark, IconEye, IconEyeOff } from './Icons';

export default function Login({ showToast }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (!email || !senha) return;
    setCarregando(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch {
      showToast('E-mail ou senha incorretos.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const recuperar = async () => {
    if (!email.trim()) { showToast('Informe seu e-mail primeiro.', 'error'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('Enviamos um link de redefinição para o seu e-mail.');
    } catch {
      showToast('Não foi possível enviar o link.', 'error');
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo"><IconSpark size={24} /></div>
        <h1 className="login-title">Atravessia</h1>
        <p className="login-sub">Painel administrativo</p>

        <form onSubmit={entrar}>
          <div className="field-group">
            <label>E-mail</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email" required autoFocus
            />
          </div>

          <div className="field-group">
            <label>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={verSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password" required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setVerSenha(v => !v)}
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-light)', display: 'grid', placeItems: 'center',
                  width: 30, height: 30, borderRadius: 6,
                }}
              >
                {verSenha ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit" className="btn-primary" disabled={carregando}
            style={{ width: '100%', padding: '12px', marginTop: 4 }}
          >
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <button
          type="button" onClick={recuperar}
          style={{
            display: 'block', margin: '16px auto 0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12.5, color: 'var(--primary-600)', textDecoration: 'underline',
          }}
        >
          Esqueci minha senha
        </button>

        <p style={{
          textAlign: 'center', fontSize: 11, color: 'var(--text-light)',
          marginTop: 24, marginBottom: 0,
        }}>
          Acesso restrito às administradoras
        </p>
      </div>
    </div>
  );
}
