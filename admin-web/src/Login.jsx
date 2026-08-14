import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login({ showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      showToast('E-mail ou senha incorretos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🌸</div>
        <h1 className="login-title">Atravessia</h1>
        <p className="login-sub">Painel Administrativo</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field-group">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="field-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
            {loading ? '⏳ Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#A39FA3', marginTop: 20 }}>
          Acesso restrito à administração
        </p>
      </div>
    </div>
  );
}
