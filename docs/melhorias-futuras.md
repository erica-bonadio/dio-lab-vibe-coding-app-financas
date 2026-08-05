# Melhorias futuras — Capim

Ideias **fora** do produto atual (ver `docs/PRD.md`).

## Disponibilização (produto público/privado)

Quando for além do lab DIO:

- Migrar para **repositório privado** (código + secrets fora do fork DIO)
- Builds EAS (Android AAB / iOS) + canais preview/production
- Política de privacidade + termos (LGPD); página de suporte
- Remover/omitir Client IDs de exemplo; secrets só em EAS Secrets / `.env` local
- TestFlight / Play Internal testing antes de loja
- Telemetria mínima opt-in (sem PII financeira) ou zero analytics no v1
- Hardening: rate limit futuro da API de IA; wipe local; export de dados (LGPD)

## Produto

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
