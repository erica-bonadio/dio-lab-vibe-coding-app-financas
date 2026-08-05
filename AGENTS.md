# Capim

App de organização de finanças pessoais com chat em linguagem natural (offline-first).  
Desafio DIO Vibe Coding + MVP funcional Expo.

## Regras do Cursor

| Tipo | Arquivos | Quando |
|------|----------|--------|
| Global | `~/.cursor/rules/` + Settings → Rules | Sempre |
| Projeto (local) | `.cursor/rules/*.mdc` | Só nesta máquina (não versionado no fork DIO) |
| Stack (local) | `.cursor/rules/expo-react-native.mdc` | Arquivos Expo/RN |

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
| `docs/comandos-testes.md` | Packs de check |
| `README.md` | Entrega DIO (PRD/prompt, prints, reflexão) |

> Backlog futuro (`docs/melhorias-futuras.md`) e regras Cursor (`.cursor/`) ficam **só locais**, fora do fork DIO.
