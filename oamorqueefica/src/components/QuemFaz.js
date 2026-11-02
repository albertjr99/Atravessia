import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { colors, criarEstilos } from '../theme';
import { EQUIPE_PADRAO, FOTOS_LOCAIS, normalizarEquipe } from '../screens/institucional/equipeFaqPadrao';

// "Quem faz a Atravessia" na tela Sobre o app. O conteúdo vem do documento
// configuracoes/equipe (editado em "Sobre e parcerias" no painel); sem
// documento, mostra o conteúdo padrão com as fotos que já vêm no app.
export default function QuemFaz() {
  const [dados, setDados] = useState(EQUIPE_PADRAO);
  useEffect(() => onSnapshot(doc(db, 'configuracoes', 'equipe'),
    (snap) => setDados(snap.exists() ? normalizarEquipe(snap.data()) : EQUIPE_PADRAO),
    () => setDados(EQUIPE_PADRAO)), []);
  if (dados.ativo === false) return null;
  return <QuemFazConteudo dados={dados} />;
}

function fonteDaFoto(f) {
  if (f?.url) return { uri: f.url };
  return FOTOS_LOCAIS[f?.local] || null;
}

// Parte visual, também usada na prévia do painel (sem moldura de borda no topo).
export function QuemFazConteudo({ dados, previa = false }) {
  const fotos = (dados?.fotos || []).filter(fonteDaFoto);
  const integrantes = dados?.integrantes || [];
  const [i, setI] = useState(0);
  const total = fotos.length;
  const atual = total ? Math.min(i, total - 1) : 0;
  const foto = fotos[atual];
  const ir = (passo) => setI(n => (Math.min(n, total - 1) + passo + total) % total);
  const proporcao = Number(foto?.proporcao) > 0 ? Number(foto.proporcao) : 4 / 3;
  if (!total && !integrantes.length) return null;

  return (
    <View style={[s.equipe, previa && s.equipePrevia]}>
      <Text style={s.equipeTitulo}>{dados?.titulo || EQUIPE_PADRAO.titulo}</Text>
      {!!foto && (
        <>
          <View style={[s.fotoMoldura, proporcao < 1 && s.fotoMolduraRetrato, { aspectRatio: proporcao }]}>
            <Image source={fonteDaFoto(foto)} style={s.foto} resizeMode="cover"
              accessibilityLabel={foto.legenda ? `Foto da equipe: ${foto.legenda}` : 'Foto da equipe'} />
            {total > 1 && (
              <>
                <TouchableOpacity style={[s.fotoSeta, { left: 8 }]} onPress={() => ir(-1)} accessibilityRole="button" accessibilityLabel="Foto anterior">
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[s.fotoSeta, { right: 8 }]} onPress={() => ir(1)} accessibilityRole="button" accessibilityLabel="Próxima foto">
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
          {!!foto.legenda && <Text style={s.fotoLegenda}>{foto.legenda}</Text>}
          {total > 1 && (
            <View style={s.pontos}>
              {fotos.map((f, n) => (
                <TouchableOpacity key={`${n}-${f.url || f.local}`} onPress={() => setI(n)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Foto ${n + 1} de ${total}`} accessibilityState={{ selected: n === atual }}>
                  <View style={[s.ponto, n === atual && s.pontoAtivo]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
      {integrantes.length > 0 && (
        <View style={s.pessoas}>
          {integrantes.map((p, n) => (
            <View key={p.id || `${n}-${p.nome}`} style={s.pessoa}>
              {p.fotoUrl
                ? <Image source={{ uri: p.fotoUrl }} style={s.pessoaFoto} accessibilityLabel={`Foto de ${p.nome || 'integrante'}`} />
                : <View style={s.pessoaIcone}><Ionicons name={p.icone || 'heart-outline'} size={18} color={colors.lilasTexto} /></View>}
              <View style={{ flex: 1 }}>
                {!!p.nome && <Text style={s.pessoaNome}>{p.nome}</Text>}
                {!!p.papel && <Text style={s.pessoaPapel}>{p.papel}</Text>}
                {!!p.texto && <Text style={s.pessoaTexto}>{p.texto}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = criarEstilos(() => ({
  equipe: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.bordaSuave },
  equipePrevia: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  equipeTitulo: { fontFamily: 'Titulo', fontSize: 26, color: colors.titulo, marginBottom: 14, textAlign: 'center' },
  fotoMoldura: { width: '100%', maxWidth: 640, alignSelf: 'center', borderRadius: 22, overflow: 'hidden', backgroundColor: colors.lav1 },
  fotoMolduraRetrato: { width: '75%', maxWidth: 420 },
  foto: { width: '100%', height: '100%' },
  fotoSeta: {
    position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,14,30,0.4)',
  },
  fotoLegenda: { fontFamily: 'Figtree_500Medium', fontSize: 14, color: colors.texto2, textAlign: 'center', marginTop: 10 },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lav3, opacity: 0.5 },
  pontoAtivo: { opacity: 1, backgroundColor: colors.lilasTexto },
  pessoas: { marginTop: 16, gap: 10 },
  pessoa: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.vidroTenue, borderWidth: 1, borderColor: colors.bordaSuave },
  pessoaIcone: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lav1 },
  pessoaFoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lav1 },
  pessoaNome: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: colors.titulo },
  pessoaPapel: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: colors.lilasTexto, marginTop: 1 },
  pessoaTexto: { fontFamily: 'Figtree_400Regular', fontSize: 14, lineHeight: 20, color: colors.texto2, marginTop: 4 },
}));
