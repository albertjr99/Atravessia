import React from 'react';
import Planos from './Planos';
import Precos from './Precos';

// "Preços e planos" — espelha AdminPrecosScreen do app: primeiro os cards dos
// planos exibidos no app (Planos.jsx), depois os preços de cobrança.
export default function PrecosPlanos({ showToast }) {
  return (
    <>
      <Planos showToast={showToast} />
      <div className="aln-separador" />
      <Precos showToast={showToast} />
    </>
  );
}
