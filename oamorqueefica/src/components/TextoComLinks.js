import React from 'react';
import { Text } from 'react-native';
import { colors, fonts } from '../theme';
import { abrirLink } from '../utils/abrirLink';

// Texto corrido em que endereços (https://..., www....) viram links tocáveis.
// Usado nos conteúdos escritos pela administradora: antes, um link colado no
// meio do texto aparecia como texto comum e não abria.
const REGEX_LINK = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

// Pontuação colada no fim do link ("veja www.x.com.") não faz parte do endereço.
function separarPontuacao(trecho) {
  const m = trecho.match(/^(.*?)([.,;:!?)\]]+)$/);
  return m ? [m[1], m[2]] : [trecho, ''];
}

export default function TextoComLinks({ children, style, corLink = colors.lav5, ...props }) {
  const texto = typeof children === 'string' ? children : String(children ?? '');
  const partes = texto.split(REGEX_LINK);

  return (
    <Text style={style} {...props}>
      {partes.map((parte, i) => {
        if (i % 2 === 0) return parte;
        const [endereco, sobra] = separarPontuacao(parte);
        return (
          <React.Fragment key={i}>
            <Text
              style={{ color: corLink, fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
              onPress={() => abrirLink(endereco)}
              suppressHighlighting
            >
              {endereco}
            </Text>
            {sobra}
          </React.Fragment>
        );
      })}
    </Text>
  );
}
