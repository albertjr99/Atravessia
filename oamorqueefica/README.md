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
│       ├── auth/CadastroScreen.js      # Cadastro em 3 passos
│       ├── home/HomeScreen.js          # Tela inicial
│       ├── checkin/CheckInScreen.js    # Check-in emocional
│       ├── audios/AudiosScreen.js      # Biblioteca de áudios
│       ├── jornadas/JornadasScreen.js  # Jornadas estruturadas
│       ├── memorial/MemorialScreen.js  # Caixa de memórias
│       ├── relatorios/RelatoriosScreen.js  # Relatórios emocionais
│       ├── sessao/SessaoScreen.js      # Agendamento de sessão
│       └── planos/PlanosScreen.js      # Planos e assinatura
```

---

## Telas implementadas

| Tela | Plano | Status |
|------|-------|--------|
| Cadastro (3 passos) | Gratuito | ✅ |
| Home (frase + check-in + reflexão) | Gratuito | ✅ |
| Check-in emocional completo | Gratuito | ✅ |
| Biblioteca de áudios | Plano 1+ | ✅ |
| Jornadas | Plano 2+ | ✅ |
| Memorial / Caixa de memórias | Plano 1+ | ✅ |
| Relatórios emocionais | Gratuito+ | ✅ |
| Agendamento de sessão | Todos | ✅ |
| Planos e assinatura | Todos | ✅ |

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

- [ ] Player de áudio real (expo-av)
- [ ] Push notifications (expo-notifications)
- [ ] Banco de dados local (AsyncStorage)
- [ ] Integração com pagamento (Stripe / RevenueCat)
- [ ] Cartas da comunidade
- [ ] Pequenas vitórias com certificados
- [ ] Datas sensíveis com alertas antecipados
- [ ] Área administrativa
- [ ] IA acolhedora (Fase 3)

---

## Observação importante

Este aplicativo não substitui acompanhamento médico ou psicológico profissional.
