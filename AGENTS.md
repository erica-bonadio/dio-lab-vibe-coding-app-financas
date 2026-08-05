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
| `docs/` | PRD (público no fork); demais docs locais |

## Comandos

```bash
npm start                 # Expo (SDK 54)
npm run typecheck
```

Packs internos (`cid:check`, `db:check`, `smoke`) e `docs/comandos-testes.md` ficam **só locais**.

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `docs/PRD.md` | Produto atual |
| `README.md` | Entrega DIO (PRD/prompt, prints, reflexão) |

> Locais (fora do fork DIO): `.cursor/`, `docs/melhorias-futuras.md`, `docs/comandos-testes.md`, `scripts/`.
