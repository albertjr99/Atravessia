import React, { useEffect, useState } from 'react';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { IconSpark, IconCheck, IconAlert, IconGift } from './Icons';

// Página avulsa, sem login: aberta pelo parceiro a partir do QR code ou do
// link do cupom (?t=<tokenSeguro>) ou do link do painel de extrato
// (?painel=<tokenPainel>). A segurança vem do token em si — ver
// functions/index.js (validarVoucher, confirmarAtendimento, consultarExtratoParceiro).

function reaisTxt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function centavosParaTexto(v) {
  return `R$ ${(Number(v || 0) / 100).toFixed(2).replace('.', ',')}`;
}

function Shell({ children }) {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="login-logo"><IconSpark size={22} /></div>
        <h1 className="login-title">Atravessia · Parceiros</h1>
        <p className="login-sub">Validação de cupons e acompanhamento de comissões</p>
        {children}
      </div>
    </div>
  );
}

function Erro({ mensagem }) {
  return (
    <div className="empty-state" style={{ padding: '28px 18px' }}>
      <div className="empty-icon"><IconAlert size={30} /></div>
      <p>{mensagem}</p>
    </div>
  );
}

function TelaVoucher({ token }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [cupom, setCupom] = useState(null);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const fn = httpsCallable(functions, 'validarVoucher');
        const { data } = await fn({ tokenSeguro: token });
        setCupom(data);
      } catch (e) {
        setErro(e?.message || 'Não foi possível validar este cupom.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const valorPrevia = Number(String(valor).replace(',', '.')) || 0;

  const confirmar = async () => {
    const valorNumero = Number(String(valor).replace(',', '.'));
    if (!valorNumero || valorNumero <= 0) {
      setErro('Informe o valor do serviço prestado.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const fn = httpsCallable(functions, 'confirmarAtendimento');
      const { data } = await fn({ tokenSeguro: token, valorOriginal: valorNumero });
      setResultado(data);
    } catch (e) {
      setErro(e?.message || 'Não foi possível confirmar o atendimento.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return <div style={{ display: 'grid', placeItems: 'center', padding: '30px 0' }}><div className="spinner" /></div>;
  }

  if (resultado) {
    return (
      <div>
        <div className="empty-icon" style={{ color: '#4A6B4E' }}><IconCheck size={30} /></div>
        <p style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dark)', marginBottom: 18 }}>
          Atendimento confirmado!
        </p>
        <div className="card" style={{ padding: 16, marginBottom: 10 }}>
          <Linha label="Valor do serviço" valor={reaisTxt(resultado.valorOriginal)} />
          <Linha label="Desconto da cliente" valor={`− ${reaisTxt(resultado.valorDesconto)}`} />
          <Linha label="Valor a cobrar da cliente" valor={reaisTxt(resultado.valorFinal)} destaque />
        </div>
        <p className="field-hint" style={{ textAlign: 'center' }}>
          Pedimos à cliente que confirme no aplicativo que o atendimento aconteceu.
          Os valores de comissão ficam no seu extrato de parceiro.
        </p>
      </div>
    );
  }

  if (erro && !cupom) return <Erro mensagem={erro} />;

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>{cupom.parceriaNome}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary-700)' }}>{cupom.codigoPublico}</div>
        {/* A cliente costuma estar olhando esta tela junto com o parceiro: só o
            desconto dela aparece aqui. A comissão fica no extrato do parceiro. */}
        <div className="field-hint" style={{ marginTop: 8 }}>
          Desconto para a cliente: <strong>{cupom.percentualDescontoCliente}%</strong>
        </div>
      </div>

      <div className="field-group">
        <label>Valor do serviço prestado (R$)</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Ex.: 90,00"
          value={valor}
          onChange={e => setValor(e.target.value)}
        />
        <span className="field-hint">Informe o valor cheio, antes do desconto do cupom.</span>
        {valorPrevia > 0 && (
          <span className="field-hint" style={{ color: 'var(--text-dark)' }}>
            Valor a cobrar da cliente: <strong>{reaisTxt(valorPrevia * (1 - (cupom.percentualDescontoCliente || 0) / 100))}</strong>
          </span>
        )}
      </div>

      {erro && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{erro}</p>}

      <button className="btn-primary" style={{ width: '100%', padding: '12px 0' }} onClick={confirmar} disabled={enviando}>
        {enviando ? 'Confirmando…' : 'Confirmar atendimento'}
      </button>
    </div>
  );
}

function Linha({ label, valor, destaque }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: destaque ? 14 : 13, fontWeight: destaque ? 700 : 400, color: destaque ? 'var(--primary-700)' : 'var(--text-dark)' }}>
      <span>{label}</span>
      <span>{valor}</span>
    </div>
  );
}

const STATUS_LABEL = {
  CONCLUIDO: 'Aguardando confirmação da cliente',
  CONFIRMADO_USUARIO: 'Confirmado — aguardando fechamento',
  ELEGIVEL_LIQUIDACAO: 'Aguardando fechamento do período',
  AGUARDANDO_PAGAMENTO: 'Fechado — aguardando pagamento',
  LIQUIDADO: 'Pago',
  CONTESTADO: 'Contestado pela cliente',
};

function TelaExtrato({ tokenPainel }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [extrato, setExtrato] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const fn = httpsCallable(functions, 'consultarExtratoParceiro');
        const { data } = await fn({ tokenPainel });
        setExtrato(data);
      } catch (e) {
        setErro(e?.message || 'Não foi possível carregar o extrato.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [tokenPainel]);

  if (carregando) {
    return <div style={{ display: 'grid', placeItems: 'center', padding: '30px 0' }}><div className="spinner" /></div>;
  }
  if (erro) return <Erro mensagem={erro} />;

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 18, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{extrato.parceriaNome}</div>
        <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>Comissão pendente</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-700)' }}>
          {centavosParaTexto(extrato.totalComissaoPendente * 100)}
        </div>
      </div>

      {extrato.itens.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 18px' }}>
          <div className="empty-icon"><IconGift size={26} /></div>
          <p>Nenhuma utilização registrada ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {extrato.itens.map((item, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{item.codigoPublico}</strong>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{centavosParaTexto(item.comissao * 100)}</span>
              </div>
              <div className="field-hint">
                {STATUS_LABEL[item.status] || item.status}
                {item.data ? ` · ${new Date(item.data).toLocaleDateString('pt-BR')}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Parceiro() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');
  const tokenPainel = params.get('painel');

  let conteudo;
  if (token) conteudo = <TelaVoucher token={token} />;
  else if (tokenPainel) conteudo = <TelaExtrato tokenPainel={tokenPainel} />;
  else conteudo = <Erro mensagem="Link inválido. Peça à Atravessia um novo link de acesso." />;

  return <Shell>{conteudo}</Shell>;
}
