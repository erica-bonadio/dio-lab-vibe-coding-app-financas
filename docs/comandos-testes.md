# Comandos e packs — Capim

```bash
npm start              # Expo Go / dev client
npm run android
npm run ios
npm run typecheck      # TypeScript
npm run smoke          # Smoke domínio (parser, resumo, meta, mês, orçamento)
npm run cid:check      # Pack SI (secrets / padrões)
npm run db:check       # Pack BD (schema no client.ts)
```

## Check pós-implementação (manual — no Expo Go)

1. Criar senha local e desbloquear
2. No chat: `gastei 45 no mercado` → aparece em Lançamentos e no saldo *(coberto por `npm run smoke`)*
3. `recebi 3000 de salário` → entrada no mês *(smoke)*
4. `resumo` → totais + dicas *(smoke)*
5. Criar meta e aportar +R$50 *(smoke parcial: lógica de dica/aporte)*
6. Matar o app e reabrir → dados persistem; lock pede senha/bio
7. Configurar Client IDs no `.env` (ver `.env.example`)
8. Aba Backup → Conectar Google Drive → senha Capim → Ativar sync
9. Registrar novo gasto → após ~5s (online) status “em dia”
10. Restaurar em outro fluxo (confirmação) → dados voltam