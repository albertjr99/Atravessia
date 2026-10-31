import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToStorage } from './storageUpload';

// Afiliados: lojas, textos dos botões e cálculo do cashback. As mesmas regras
// valem no servidor (functions/index.js → seção AFILIADOS) e no painel web
// (admin-web/src/afiliadosUtils.js).

export const PLATAFORMAS_AFILIADO = [
  { id: 'amazon', nome: 'Amazon', exemplo: 'https://amzn.to/...', padrao: /amzn\.|amazon\./i },
  { id: 'mercadolivre', nome: 'Mercado Livre', exemplo: 'https://mercadolivre.com/sec/...', padrao: /mercadoli[vb]re|meli\.la/i },
  { id: 'shopee', nome: 'Shopee', exemplo: 'https://s.shopee.com.br/...', padrao: /shopee/i },
  { id: 'magalu', nome: 'Magalu', exemplo: 'https://www.magazinevoce.com.br/...', padrao: /magalu|magazineluiza|magazinevoce/i },
  { id: 'outra', nome: 'Outra loja', exemplo: 'https://...', padrao: null },
];

export const LIMITES_AFILIADO = { valorMaxCentavos: 300000, cashbackMaxCentavos: 10000, percentualMax: 50 };

// Itens antigos (só Amazon) não têm `plataforma`: contam como Amazon.
export function nomePlataforma(item) {
  if (item?.plataforma === 'outra') return String(item.plataformaNome || '').trim() || 'loja';
  return PLATAFORMAS_AFILIADO.find(p => p.id === (item?.plataforma || 'amazon'))?.nome || 'Amazon';
}

export function textoBotaoAfiliado(item) {
  const proprio = String(item?.textoBotao || '').trim();
  return proprio || `Ver na ${nomePlataforma(item)}`;
}

export const brlCentavos = (c) => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace('.', ',')}%`;

// Regra de cashback do item para a usuária (null = sem cashback).
export function regraCashback(item) {
  if (!item || item.cashbackAtivo !== true) return null;
  if (item.cashbackTipo === 'percentual') {
    const p = Number(item.cashbackPercentual);
    return p > 0 ? { tipo: 'percentual', percentual: Math.min(p, LIMITES_AFILIADO.percentualMax) } : null;
  }
  const f = Math.round(Number(item.cashbackFixoCentavos));
  return f > 0 ? { tipo: 'fixo', fixoCentavos: Math.min(f, LIMITES_AFILIADO.cashbackMaxCentavos) } : null;
}

export function calcularCashback(regra, valorCentavos) {
  if (!regra || !(valorCentavos > 0)) return 0;
  const bruto = regra.tipo === 'percentual' ? Math.floor(valorCentavos * (regra.percentual / 100)) : regra.fixoCentavos;
  return Math.max(0, Math.min(bruto, valorCentavos, LIMITES_AFILIADO.cashbackMaxCentavos));
}

// Selo do cartão: "Ganhe R$ 0,20 de crédito" ou "Ganhe 2% de volta em créditos".
export function seloCashback(item) {
  const r = regraCashback(item);
  if (!r) return null;
  return r.tipo === 'percentual'
    ? `Ganhe ${pct(r.percentual)} de volta em créditos`
    : `Ganhe ${brlCentavos(r.fixoCentavos)} de crédito`;
}

// "22,90" / "R$ 1.234,50" → centavos (null se inválido).
export function reaisParaCentavos(txt) {
  const limpo = String(txt || '').replace(/[^\d,.-]/g, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const centavosParaTexto = (c) => (c == null || c === '' ? '' : (Number(c) / 100).toFixed(2).replace('.', ','));

export const STATUS_PEDIDO = {
  pendente: { rotulo: 'Em análise', icone: 'time-outline', cor: 'dourado' },
  aprovado: { rotulo: 'Aprovado', icone: 'checkmark-circle-outline', cor: 'salvia' },
  recusado: { rotulo: 'Recusado', icone: 'close-circle-outline', cor: 'rosa' },
};

// Escolhe uma imagem (galeria no celular, seletor de arquivo na web) e envia
// para o Storage em `pasta`. Devolve { url, caminho } ou null se desistir.
export async function escolherEnviarImagem(pasta, { maxMB = 8, qualidade = 0.7 } = {}) {
  const nome = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const caminho = `${pasta}/${nome}`;
  if (Platform.OS === 'web') {
    const file = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => resolve(e.target.files?.[0] || null);
      input.click();
    });
    if (!file) return null;
    if (file.size > maxMB * 1024 * 1024) throw new Error(`A imagem precisa ter até ${maxMB} MB.`);
    const { ref: sRef, uploadBytes, getDownloadURL } = require('firebase/storage');
    const { storage } = require('../services/firebase');
    const r = sRef(storage, caminho);
    await uploadBytes(r, file, { contentType: file.type || 'image/jpeg' });
    return { url: await getDownloadURL(r), caminho };
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permissão necessária', 'Para escolher uma imagem, permita o acesso à galeria nas configurações do aparelho.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: qualidade });
  if (res.canceled) return null;
  const url = await uploadToStorage(res.assets[0].uri, caminho, 'image/jpeg');
  return { url, caminho };
}

// Pedidos de cashback de afiliados da própria pessoa (as regras só deixam ler
// os seus). Usado no Perfil e no extrato para mostrar quantos estão em análise.
export function useMeusPedidosAfiliado(uid) {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    if (!uid) { setPedidos([]); return undefined; }
    return onSnapshot(query(collection(db, 'pedidosCashbackAfiliado'), where('usuarioId', '==', uid)),
      (snap) => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (e) => console.warn('[Afiliados] pedidos:', e?.message));
  }, [uid]);
  const pendentes = pedidos.filter(p => p.status === 'pendente').length;
  return { pedidos, pendentes };
}
