# Melhorias futuras — Capim

Ideias **fora** do produto atual (ver `docs/PRD.md`).

## Próximas frentes (a discutir)

Nenhuma em andamento agora. Quando retomar, escolher uma:

1. **Base de loja** — EAS (AAB/iOS) + ícones/splash + bundle id definitivo + canais preview/production
2. **Confiança / LGPD** — política de privacidade + termos + export/wipe de dados + página de suporte
3. **Produto** — IA no `server/`, lançamentos recorrentes, ou merge fino multi-aparelho

Também: migrar deste fork DIO para **repositório privado** antes de tratar como produto.

## Disponibilização

- Secrets só em EAS Secrets / `.env` local (nunca no repo)
- TestFlight / Play Internal testing antes de loja
- Telemetria mínima opt-in (sem PII financeira) ou zero analytics no v1
- Hardening: rate limit da API de IA (quando existir)

## Produto (backlog)

- API de IA em `server/` (DeepSeek/Gemini) para parser mais rico e conselhos personalizados
- Open Banking / importação de extrato OFX/CSV
- Widgets e notificações locais de “ainda não registrou hoje”
- Modo família / contas compartilhadas
- Relatórios anuais e export PDF / CSV
- Tema escuro
- Merge fino multi-aparelho (hoje: last-write-wins no Drive)
- Editar valor/descrição do lançamento
- Lançamentos recorrentes (aluguel, salário)
- Comparativo mês a mês (gráfico de barras)
