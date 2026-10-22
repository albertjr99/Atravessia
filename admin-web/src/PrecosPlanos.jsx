import React from 'react';
import Planos from './Planos';
import Precos from './Precos';
import Assinatura from './Assinatura';
import { IconTag } from './Icons';

// "Preços e planos" — único lugar para editar preços. Espelha AdminPrecosScreen
// do app: cards dos planos (com o editor de preço), relatório por período e
// formas de pagamento.
export default function PrecosPlanos({ showToast }) {
  return (
    <div className="screen-content pp-tela">
      <div className="screen-header">
        <h1 className="screen-title">Preços e planos</h1>
        <p className="pp-explica">
          <IconTag size={16} />
          <span>O valor que você salva aqui é o que a usuária vê no app e o que é cobrado no pagamento.
            Quem já assina continua com o valor da época da assinatura.</span>
        </p>
      </div>
      <Planos showToast={showToast} />
      <Precos showToast={showToast} />
      <Assinatura showToast={showToast} />
    </div>
  );
}
