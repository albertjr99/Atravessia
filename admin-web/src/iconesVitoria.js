// Ícones das opções de Pequenas Vitórias — mesmos nomes do Ionicons usados no
// app (oamorqueefica/src/data/iconesVitoria.js; altere as duas listas juntas).
// Só os SVGs listados aqui entram no build do painel.

import svg_star from 'ionicons/dist/svg/star-outline.svg';
import svg_heart from 'ionicons/dist/svg/heart-outline.svg';
import svg_sunny from 'ionicons/dist/svg/sunny-outline.svg';
import svg_moon from 'ionicons/dist/svg/moon-outline.svg';
import svg_bed from 'ionicons/dist/svg/bed-outline.svg';
import svg_walk from 'ionicons/dist/svg/walk-outline.svg';
import svg_bicycle from 'ionicons/dist/svg/bicycle-outline.svg';
import svg_fitness from 'ionicons/dist/svg/fitness-outline.svg';
import svg_water from 'ionicons/dist/svg/water-outline.svg';
import svg_nutrition from 'ionicons/dist/svg/nutrition-outline.svg';
import svg_restaurant from 'ionicons/dist/svg/restaurant-outline.svg';
import svg_cafe from 'ionicons/dist/svg/cafe-outline.svg';
import svg_home from 'ionicons/dist/svg/home-outline.svg';
import svg_leaf from 'ionicons/dist/svg/leaf-outline.svg';
import svg_flower from 'ionicons/dist/svg/flower-outline.svg';
import svg_rose from 'ionicons/dist/svg/rose-outline.svg';
import svg_people from 'ionicons/dist/svg/people-outline.svg';
import svg_chatbubbles from 'ionicons/dist/svg/chatbubbles-outline.svg';
import svg_call from 'ionicons/dist/svg/call-outline.svg';
import svg_hand_left from 'ionicons/dist/svg/hand-left-outline.svg';
import svg_musical_notes from 'ionicons/dist/svg/musical-notes-outline.svg';
import svg_book from 'ionicons/dist/svg/book-outline.svg';
import svg_brush from 'ionicons/dist/svg/brush-outline.svg';
import svg_school from 'ionicons/dist/svg/school-outline.svg';
import svg_briefcase from 'ionicons/dist/svg/briefcase-outline.svg';
import svg_paw from 'ionicons/dist/svg/paw-outline.svg';
import svg_medkit from 'ionicons/dist/svg/medkit-outline.svg';
import svg_happy from 'ionicons/dist/svg/happy-outline.svg';
import svg_flame from 'ionicons/dist/svg/flame-outline.svg';
import svg_trophy from 'ionicons/dist/svg/trophy-outline.svg';
import svg_gift from 'ionicons/dist/svg/gift-outline.svg';
import svg_balloon from 'ionicons/dist/svg/balloon-outline.svg';

export const ICONES_VITORIA = [
  { id: 'star', nome: 'Estrela', url: svg_star },
  { id: 'heart', nome: 'Coração', url: svg_heart },
  { id: 'sunny', nome: 'Sol', url: svg_sunny },
  { id: 'moon', nome: 'Lua', url: svg_moon },
  { id: 'bed', nome: 'Descanso', url: svg_bed },
  { id: 'walk', nome: 'Caminhada', url: svg_walk },
  { id: 'bicycle', nome: 'Bicicleta', url: svg_bicycle },
  { id: 'fitness', nome: 'Exercício', url: svg_fitness },
  { id: 'water', nome: 'Água', url: svg_water },
  { id: 'nutrition', nome: 'Alimentação', url: svg_nutrition },
  { id: 'restaurant', nome: 'Refeição', url: svg_restaurant },
  { id: 'cafe', nome: 'Café', url: svg_cafe },
  { id: 'home', nome: 'Casa', url: svg_home },
  { id: 'leaf', nome: 'Natureza', url: svg_leaf },
  { id: 'flower', nome: 'Flor', url: svg_flower },
  { id: 'rose', nome: 'Rosa', url: svg_rose },
  { id: 'people', nome: 'Pessoas', url: svg_people },
  { id: 'chatbubbles', nome: 'Conversa', url: svg_chatbubbles },
  { id: 'call', nome: 'Ligação', url: svg_call },
  { id: 'hand-left', nome: 'Ajuda', url: svg_hand_left },
  { id: 'musical-notes', nome: 'Música', url: svg_musical_notes },
  { id: 'book', nome: 'Leitura', url: svg_book },
  { id: 'brush', nome: 'Arte', url: svg_brush },
  { id: 'school', nome: 'Estudos', url: svg_school },
  { id: 'briefcase', nome: 'Trabalho', url: svg_briefcase },
  { id: 'paw', nome: 'Animal', url: svg_paw },
  { id: 'medkit', nome: 'Saúde', url: svg_medkit },
  { id: 'happy', nome: 'Alegria', url: svg_happy },
  { id: 'flame', nome: 'Força', url: svg_flame },
  { id: 'trophy', nome: 'Conquista', url: svg_trophy },
  { id: 'gift', nome: 'Presente', url: svg_gift },
  { id: 'balloon', nome: 'Celebração', url: svg_balloon },
];

export function iconeVitoria(id) {
  const limpo = String(id || '').replace(/-outline$/, '');
  return ICONES_VITORIA.find(i => i.id === limpo) || ICONES_VITORIA[0];
}
