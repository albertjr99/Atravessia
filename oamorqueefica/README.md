# O Amor Que Fica — App Mobile

Aplicativo de acolhimento ao luto para iOS e Android, construído com React Native + Expo.

---

## Pré-requisitos

- Node.js (já instalado)
- npm (já instalado)
- VS Code (recomendado)
- Expo Go no celular (iOS ou Android) para testar

---

## Instalação

1. **Abra esta pasta no VS Code**
   - File → Open Folder → selecione a pasta `oamorqueefica`

2. **Abra o terminal no VS Code** (Ctrl+` ou Terminal → New Terminal)

3. **Instale as dependências** (só na primeira vez):
   ```bash
   npm install
   ```

4. **Inicie o app**:
   ```bash
   npx expo start
   ```

5. **Visualize no celular**:
   - Instale o app **Expo Go** na App Store ou Google Play
   - Escaneie o QR code que aparecer no terminal

---

## Estrutura do Projeto

```
oamorqueefica/
├── App.js                          # Entrada principal
├── app.json                        # Configurações do app (nome, ícone)
├── src/
│   ├── theme/index.js              # Cores, fontes, espaçamentos
│   ├── data/index.js               # Frases, áudios, jornadas, planos
│   ├── hooks/AppContext.js         # Estado global (usuário, check-ins)
│   ├── components/index.js         # Componentes reutilizáveis
│   ├── navigation/AppNavigator.js  # Navegação (tabs + stack)
│   └── screens/
│       ├── auth/CadastroScreen.js              # Cadastro em 4 passos (dados, perda, tipo de luto, conclusão)
│       ├── home/HomeScreen.js                  # Tela inicial
│       ├── checkin/CheckInScreen.js            # Check-in emocional (emoções positivas/negativas)
│       ├── audios/AudiosScreen.js              # Biblioteca de áudios
│       ├── audios/AudioPlayerScreen.js         # Player do áudio (com regra de liberação diária)
│       ├── jornadas/JornadasScreen.js          # Jornadas estruturadas
│       ├── jornadas/JornadaDetalheScreen.js    # Detalhe da jornada (liberação gradual de atividades)
│       ├── jornadas/PequenasVitoriasScreen.js  # Pequenas vitórias (Plano 3)
│       ├── memorial/MemorialScreen.js          # Caixa de memórias
│       ├── cartas/CartasScreen.js              # Cartas (ler / escrever — Plano 1+)
│       ├── relatorios/RelatoriosScreen.js      # Relatórios emocionais
│       ├── notificacoes/NotificacoesScreen.js  # Central de notificações
│       ├── perfil/DatasSensiveisScreen.js      # Datas sensíveis (Plano 2+)
│       ├── perfil/RedeApoioScreen.js           # Rede de apoio (Plano 3)
│       ├── sessao/SessaoScreen.js              # Agendamento de sessão
│       └── planos/PlanosScreen.js              # Planos e assinatura
```

---

## Telas implementadas

| Tela | Plano | Status |
|------|-------|--------|
| Cadastro (4 passos, incl. perfil de tipo de luto) | Gratuito | ✅ |
| Home (frase + check-in + reflexão + atalhos) | Gratuito | ✅ |
| Check-in emocional (emoções positivas/negativas + mensagens) | Gratuito | ✅ |
| Biblioteca de áudios + player (1 novo/dia) | Plano 1+ | ✅ |
| Jornadas com liberação gradual de atividades | Plano 2+ | ✅ |
| Pequenas vitórias | Plano 3 | ✅ |
| Memorial / Caixa de memórias | Plano 1+ | ✅ |
| Cartas (ler comunidade / escrever) | Plano 1+ (escrita) | ✅ |
| Datas sensíveis (até 3, com notificação antecipada) | Plano 2+ | ✅ |
| Rede de apoio (até 3 contatos) | Plano 3 | ✅ |
| Central de notificações (automáticas + editoriais) | Gratuito | ✅ |
| Relatórios emocionais | Gratuito+ | ✅ |
| Agendamento de sessão | Todos | ✅ |
| Planos e assinatura (com subtítulos Perceber/Acolher/Compreender/Evoluir) | Todos | ✅ |

---

## Paleta de cores (fiel ao design)

| Nome | Hex | Uso |
|------|-----|-----|
| Fundo | #FAF7F4 | Background geral |
| Lavanda principal | #B8A6C9 | Botões, destaques |
| Lavanda escuro | #7A5FA0 | Títulos script, links |
| Rosa antigo | #D8B4B6 | Botão de sessão |
| Sage | #A8B8A0 | Conquistas, jornadas |
| Dourado | #D4A882 | Plano 3, premium |

---

## Próximos passos (Fase 2+)

- [ ] Player de áudio real com arquivos reais (expo-av) — atualmente simulado
- [ ] Push notifications reais (expo-notifications) — atualmente apenas central in-app
- [ ] Persistência local (AsyncStorage) — estado hoje é em memória (Context API)
- [ ] Integração com pagamento (Stripe / RevenueCat)
- [ ] Moderação real de cartas da comunidade
- [ ] Pequenas vitórias com certificados / badges visuais
- [ ] Área administrativa (gestão de notificações editoriais, conteúdo, planos)
- [ ] Texto oficial e licenciado do instrumento de tipos de luto (atualmente placeholder estrutural)
- [ ] IA acolhedora (Fase 3)

---

## Observação importante

Este aplicativo não substitui acompanhamento médico ou psicológico profissional.
