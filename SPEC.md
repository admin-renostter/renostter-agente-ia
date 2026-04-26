# SPEC — Renostter Agente IA (WhatsApp AI Agent)

Gerado em: 2026-04-25

---

## Resumo executivo

Agente de IA para WhatsApp focado em **SDR/Pré-vendas** em Português (BR).
Recebe mensagens via Waha Core, faz debounce via Redis, responde com Google Gemini 2.5 Flash,
persiste em Postgres Railway, e expõe painel web Next.js para configuração.

---

## Decisões de configuração

| Dimensão | Escolha |
|---|---|
| Canal | WhatsApp · Waha Core (GOWS, free, 1 sessão, texto-only) |
| Caso de uso | SDR/Pré-vendas |
| Volume pico | Até 10 conversas simultâneas |
| Idioma | Português (BR) |
| LLM principal | Google Gemini — `gemini-2.5-flash` |
| LLM embeddings | `gemini-embedding-001` |
| Fallback IA | Fila + retry (3× backoff exponencial) |
| Memória | Resumo persistente + últimas 10 msgs |
| Tools | RAG (pgvector), Google Calendar, Webhook custom |
| Handoff trigger | Pedido explícito (keywords: "falar com atendente" etc.) |
| Horário | 24/7 |
| Persistência | Postgres Railway (Prisma ^6) |
| Debounce | Configurável no painel (default: 5s) via Redis |
| Auth painel | Senha simples (`PANEL_PASSWORD` env var) |
| Domínio | Subdomínio Railway gerado automaticamente |

---

## Arquitetura

```
[WhatsApp user]
      │
      ▼
[Waha Core :8080] ──webhook POST──▶ [Next.js App :3000]
                                          │
                              ┌───────────┼────────────┐
                              ▼           ▼            ▼
                         [Redis]     [Postgres]    [Gemini API]
                       (debounce)   (msgs/contacts  (chat + embed)
                                     /agents/docs)
```

**Railway services:**
- `app` — Next.js (standalone build)
- `Postgres` — plugin Railway (Prisma migrations)
- `Redis` — plugin Railway (debounce sliding window)
- `waha` — container devlikeapro/waha (GOWS engine)

Todos conectados via private networking IPv6 Railway.

---

## Fluxo de mensagem

1. Waha Core recebe msg do WhatsApp → `POST /api/webhooks/waha`
2. Webhook handler:
   - Dedup por `providerMsgId` (evita duplicatas)
   - `ensureContactIdentity()` com try/catch P2002 (concorrência)
   - Publica no Redis: `debounce:<channel>:<externalId>`
3. Redis sliding window (default 5s, configurável no painel):
   - Lock TTL = debounceMs × 4 (pre-mitigação 0.9.23)
4. `flush.ts` dispara após janela:
   - Busca histórico (últimas 10 msgs + resumo)
   - Monta contexto com RAG (se relevante)
   - Chama Gemini 2.5 Flash
   - Se falhar → enfileira para retry (3× backoff)
   - `sendText` via Waha usando `ContactIdentity.externalId` (não Contact.id)
5. Logs estruturados: `flush.start`, `flush.decided`, `flush.sending`, `flush.sent_ok`, `flush.send_failed`

---

## Banco de dados (Prisma schema resumido)

- `Contact` — contatos únicos
- `ContactIdentity` — externalId por canal (waha, ig, cloud)
- `Conversation` — conversa ativa por contato+canal
- `Message` — mensagens com `providerMsgId` (unique)
- `AgentSession` — config do agente (systemPrompt, modelo, temperature, debounceMs)
- `Document` — docs para RAG (chunks + embeddings pgvector)
- `RetryQueue` — msgs com falha aguardando retry

---

## Páginas do painel web

| Rota | Descrição |
|---|---|
| `/` | Dashboard (conversas ativas, métricas) |
| `/conversations` | Lista de conversas |
| `/conversations/[id]` | Conversa individual + reply manual + botão Reativar IA |
| `/agents` | Lista de AgentSessions |
| `/agents/[id]` | Editar: systemPrompt, modelo, temperature, debounceMs, tools |
| `/documents` | Upload de PDFs/docs para RAG |
| `/settings` | Config geral: webhook custom, horário, handoff keywords |
| `/api/webhooks/waha` | Endpoint Waha (POST) |
| `/api/conversations/[id]/reply` | Reply manual do operador |

---

## Variáveis de ambiente (app)

```env
# Banco
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis
REDIS_URL=${{Redis.REDIS_URL}}

# Waha
WAHA_BASE_URL=http://waha.railway.internal:8080
WAHA_HOOK_EVENTS=message,session.status

# Google Gemini
GOOGLE_API_KEY=

# Auth painel
PANEL_PASSWORD=
AUTH_SECRET=   # openssl rand -hex 32

# Google Calendar (OAuth — configurado no painel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Webhook custom
CUSTOM_WEBHOOK_URL=   # opcional
```

---

## Pre-mitigações aplicadas

Todas as pre-mitigações §0.9 do wizard foram incorporadas:

- **0.9.1** Prisma pinado em `^6` (não @latest)
- **0.9.2** Migrate roda fora do container (operador local)
- **0.9.3** Migration SQL gerado com `prisma migrate diff`
- **0.9.4** Waha subscreve apenas `message,session.status`
- **0.9.5** `ensureContactIdentity` com try/catch P2002 + dedup por providerMsgId
- **0.9.6** `WAHA_BASE_URL` usa porta `:8080`
- **0.9.7** Next.js 16: `proxy.ts` (não middleware), sem chaves eslint/typescript no next.config
- **0.9.8** Fontes shadcn nova: `--font-sans` / `--font-mono` exatos
- **0.9.9** `<html className="dark">` no layout raiz
- **0.9.10** Standalone: `server.js` na raiz do bundle
- **0.9.11** `setup.config.json` copiado no Dockerfile runner stage
- **0.9.12** Redis lazy init via `getRedis()`
- **0.9.17** Botão "Reativar IA" explícito na UI de conversa
- **0.9.18** Logs estruturados obrigatórios em flush.ts e webhook
- **0.9.19** `/agents` e `/agents/[id]` incluídos no scaffold inicial
- **0.9.20** `instrumentation.ts` com guard `NEXT_PHASE`
- **0.9.21** `externalId` salvo exatamente como veio (não converter @lid/@c.us)
- **0.9.23** Lock TTL do debounce = `debounceMs × 4`
- **0.9.24** Prisma `log: []` em produção
- **0.9.25** Debounce com fallback síncrono se Redis falhar
- **0.9.27** `sendText` sempre usa `ContactIdentity.externalId`

---

## Checklist pré-deploy

- [ ] `DATABASE_URL=... AUTH_SECRET=$(openssl rand -hex 32) npm run build` — zero erros TS
- [ ] `find .next/standalone -name server.js` — confirma path do CMD
- [ ] `grep -r 'message\.any' src/` — zero matches
- [ ] `grep -n 'url.*env(' prisma/schema.prisma` — existe
- [ ] `ls prisma/migrations/000_init/migration.sql` — SQL não-vazio
- [ ] `ls prisma/migrations/migration_lock.toml` — existe
