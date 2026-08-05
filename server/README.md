# server/ — API de IA (futuro)

No MVP o parser e as dicas são **locais** (`src/features/chat`, `src/features/agent`).

Quando ligar um modelo:

1. Copie `.env.example` → `.env` (nunca commitado)
2. Exponha só endpoints necessários (parse / tips)
3. Client Expo chama via `extra.apiUrl` — **sem** API keys no app

Ver `docs/melhorias-futuras.md`.
