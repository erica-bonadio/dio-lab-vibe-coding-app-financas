# Capim — App de Finanças Pessoais (DIO Vibe Coding)

> Entrega do lab [dio-lab-vibe-coding-app-financas](https://github.com/digitalinnovationone/dio-lab-vibe-coding-app-financas)  
> **Além do conceito:** MVP nativo funcional (Expo / React Native), offline-first.

## Resumo do conceito

O **Capim** é um app de organização financeira em que você **registra gastos e receitas conversando**, sem formulários cansativos. No aparelho: senha/biometria, SQLite, categorização automática, metas e dicas do Agente Capim.

**Nome:** Capim — finanças que crescem no ritmo da conversa.

## Como rodar o MVP

```bash
npm install
cp .env.example .env   # preencha Google Client IDs para backup Drive
npm start
```

Abra no Expo Go (Android/iOS). Fluxo rápido: desbloquear → Chat → `gastei 45 no mercado` → ver Início e Lançamentos.

### Backup Google Drive (E2EE)

1. Crie OAuth Client IDs no Google Cloud (scope `drive.appdata`)
2. Preencha `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` no `.env`
3. Aba **Backup** → Conectar Google Drive → senha Capim → Ativar sync

O Drive só recebe ciphertext. Sem a senha Capim o arquivo é inutilizável.

## Prompt final (PRD) usado com a IA

```txt
# Contexto
Quero criar o Capim, app nativo (Expo/React Native) de Organização de Finanças Pessoais
que funciona por conversa. Offline-first com SQLite, arquitetura em camadas como meu app GEMA
(app/ rotas, src/features, src/db, shared/, server/ opcional para IA).

# Problema
Apps atuais exigem muita entrada manual. Quero registrar gastos falando:
"gastei 45 no mercado", com categorização automática e dicas de economia.

# Público-Alvo
Iniciantes em organização financeira no Brasil (pt-BR, BRL).

# Funcionalidades-Chave (MVP)
1. Lock local (senha/biometria) — dados sensíveis no aparelho.
2. Registrar gastos/receitas via chat em linguagem natural.
3. Classificar automaticamente as transações (categorias em pt-BR).
4. Definir e acompanhar metas financeiras.
5. Dashboard do mês + dicas do Agente Capim (regras locais no MVP; API depois).
6. Valores em centavos; sem float para dinheiro.

# Entregável
App Expo funcional + README com este PRD, prints e reflexão do processo Vibe Coding.
Tom educativo, linguagem acessível, em português.
```

PRD completo: [`docs/PRD.md`](docs/PRD.md).

## Imagens / interações com a IA

> Coloque prints em `docs/screenshots/` (Copilot, Cursor, Lovable, telas do app) e linke aqui.

| Arquivo | Descrição |
|---------|-----------|
| _(adicionar)_ | Prompt/PRD no Copilot ou Cursor |
| _(adicionar)_ | Chat registrando um gasto |
| _(adicionar)_ | Dashboard / saldo do mês |

## Arquitetura (base GEMA / apps existentes)

```
app/               → UI (Expo Router)
src/features/      → chat, agente, auth
src/db/            → SQLite + repositories
shared/            → tipos
server/            → stub IA (futuro; secrets só em .env)
```

## Reflexão do processo

- **O que funcionou bem:** Partir de um PRD claro e da arquitetura já usada no GEMA (camadas + SQLite + auth local) acelerou o MVP sem reinventar a roda. O parser local cobre o happy path do desafio sem depender de API paga no dia 1.
- **O que aprendi:** Vibe Coding não é “pedir o app inteiro” — é especificar problema, escopo e restrições (centavos, offline, pt-BR, sem secrets no client) para a IA entregar algo alinhado e seguro.
- **Próximo passo:** prints reais no README; evoluir o agente para `server/` com modelo; importação de extrato (backlog).

## Licença / origem

Fork do repositório-base da DIO, com implementação própria do produto **Capim**.
