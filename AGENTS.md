# Capim

App de organização de finanças pessoais com chat em linguagem natural (offline-first).  
Desafio DIO Vibe Coding + MVP funcional Expo.

## Regras do Cursor

| Tipo | Arquivos | Quando |
|------|----------|--------|
| Global | `~/.cursor/rules/` + Settings → Rules | Sempre |
| Projeto (alwaysApply) | `.cursor/rules/seguranca-informacao.mdc`, `engenharia-software.mdc`, `qa.mdc`, `metricas-codigo.mdc` | Sempre neste repo |
| Stack | `.cursor/rules/expo-react-native.mdc` | Arquivos Expo/RN |

## Estrutura

| Pasta | Conteúdo |
|-------|----------|
| `app/` | Rotas Expo Router (tabs: início, chat, lançamentos, metas, backup) |
| `src/db/` | SQLite (`capim.db`) + repositories |
| `src/features/` | Chat parser, agente, auth local, backup Drive E2EE |
| `src/theme/` | Cores e tipografia |
| `shared/` | Tipos/contratos |
| `server/` | Stub para API de IA (futuro) |
| `docs/` | PRD, backlog, comandos de teste |

## Comandos

Ver `docs/comandos-testes.md`.

```bash
npm start                 # Expo (SDK 54)
npm run typecheck
npm run cid:check
npm run db:check
```

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `docs/PRD.md` | Produto atual |
| `docs/melhorias-futuras.md` | Backlog |
| `docs/comandos-testes.md` | Packs de check |
| `README.md` | Entrega DIO (PRD/prompt, prints, reflexão) |
