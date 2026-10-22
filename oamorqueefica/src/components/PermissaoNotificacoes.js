import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, AppState, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, criarEstilos } from '../theme';
import { registrarPushToken } from '../utils/pushNotifications';
import { criarCanalLembretes } from '../utils/lembreteCheckin';

const CHAVE_ADIADO = 'permissaoNotificacoes.adiadoEm';
const ESPERA_MS = 3 * 24 * 60 * 60 * 1000;

// Convite para ligar as notificações logo no início: lembretes do check-in,
// Frase do dia, avisos e comunicações dependem delas. Se a pessoa disser
// "agora não", o convite volta depois de alguns dias. Se o sistema já não
// deixa perguntar de novo, o botão abre as configurações do aparelho.
export default function PermissaoNotificacoes({ uid }) {
  const [visivel, setVisivel] = useState(false);
  const [podePerguntar, setPodePerguntar] = useState(true);

  const conferir = useCallback(async (ignorarAdiamento = false) => {
    if (!uid || Platform.OS === 'web' || !Device.isDevice) return;
    try {
      const atual = await Notifications.getPermissionsAsync();
      if (atual.status === 'granted') {
        setVisivel(false);
        registrarPushToken(uid);
        return;
      }
      if (!ignorarAdiamento) {
        const adiado = Number(await AsyncStorage.getItem(CHAVE_ADIADO).catch(() => 0)) || 0;
        if (Date.now() - adiado < ESPERA_MS) return;
      }
      setPodePerguntar(atual.canAskAgain !== false);
      setVisivel(true);
    } catch {}
  }, [uid]);

  useEffect(() => {
    const t = setTimeout(() => conferir(), 1500);
    // Ao voltar das configurações do aparelho, confere de novo.
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') conferir(true).catch(() => {}); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [conferir]);

  const permitir = async () => {
    try {
      // No Android 13+, a pergunta só aparece se já existir um canal.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Avisos da Atravessia', importance: Notifications.AndroidImportance.HIGH,
        }).catch(() => {});
        await criarCanalLembretes();
      }
      if (!podePerguntar) { Linking.openSettings(); return; }
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setVisivel(false);
        registrarPushToken(uid);
      } else if (canAskAgain === false) {
        setPodePerguntar(false);
      }
    } catch {}
  };

  const adiar = () => {
    AsyncStorage.setItem(CHAVE_ADIADO, String(Date.now())).catch(() => {});
    setVisivel(false);
  };

  if (!visivel) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={adiar}>
      <View style={s.fundo}>
        <View style={s.caixa}>
          <LinearGradient colors={[colors.botao, colors.botaoForte]} style={s.icone}>
            <Ionicons name="notifications-outline" size={30} color="#fff" />
          </LinearGradient>
          <Text style={s.titulo}>Ative as notificações</Text>
          <Text style={s.texto}>
            É por elas que chegam o lembrete do seu check-in, a Frase do dia, os avisos dos seus cupons e as mensagens da equipe Atravessia.
          </Text>
          {!podePerguntar && (
            <Text style={s.dica}>As notificações estão desligadas no aparelho. Toque abaixo e ative em "Notificações".</Text>
          )}
          <TouchableOpacity style={s.botao} onPress={permitir} activeOpacity={0.85} accessibilityLabel="Permitir notificações">
            <LinearGradient colors={[colors.botao, colors.botaoForte]} style={StyleSheet.absoluteFill} />
            <Text style={s.botaoTxt}>{podePerguntar ? 'Permitir notificações' : 'Abrir configurações'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={adiar} style={s.depois}>
            <Text style={s.depoisTxt}>Agora não</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = criarEstilos(() => ({
  fundo: { flex: 1, backgroundColor: colors.sobreposicao, alignItems: 'center', justifyContent: 'center', padding: 20 },
  caixa: {
    width: '100%', maxWidth: 420, alignItems: 'center', backgroundColor: colors.cardSolido, borderRadius: 28,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 14, borderWidth: 1, borderColor: colors.bordaLuz,
  },
  icone: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  titulo: { fontFamily: 'Titulo', fontSize: 26, color: colors.titulo, textAlign: 'center' },
  texto: { fontFamily: 'Figtree_400Regular', fontSize: 15.5, lineHeight: 22, color: colors.texto2, textAlign: 'center', marginTop: 8 },
  dica: { fontFamily: 'Figtree_600SemiBold', fontSize: 13.5, lineHeight: 19, color: colors.lilasTexto, textAlign: 'center', marginTop: 10 },
  botao: { alignSelf: 'stretch', marginTop: 20, paddingVertical: 15, borderRadius: 999, overflow: 'hidden', alignItems: 'center' },
  botaoTxt: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: '#fff' },
  depois: { paddingVertical: 12, paddingHorizontal: 20 },
  depoisTxt: { fontFamily: 'Figtree_700Bold', fontSize: 15, color: colors.texto2 },
}));
