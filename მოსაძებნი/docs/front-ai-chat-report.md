# Front AI Chat — Inventory & Behavior Report (SOL-546)

## Files & Paths
- `src/components/futuristic-chat/AIChatInterface.tsx`: primary container orchestrating chat state, input validation, SSE handling, and telemetry surfaces.【F:src/components/futuristic-chat/AIChatInterface.tsx†L48-L1595】
- `src/components/futuristic-chat/FuturisticChatPanel.tsx`: presentational shell receiving props for messages, controls, badges, and error UI.【F:src/components/futuristic-chat/FuturisticChatPanel.tsx†L1-L360】
- `src/components/futuristic-chat/ChatCloud.tsx`: floating entry button, hover label, and listening indicator.【F:src/components/futuristic-chat/ChatCloud.tsx†L1-L128】
- `src/MainPage.tsx`: renders `<AIChatInterface />` into the marketing landing page.【F:src/MainPage.tsx†L771-L785】
- Context hooks: `src/contexts/useAuth.ts` / `src/contexts/AuthContext.tsx` for identity, `src/contexts/useAIMode.ts` / `src/contexts/AIModeContext.tsx` for live/demo enforcement.【F:src/contexts/useAuth.ts†L1-L39】【F:src/contexts/AuthContext.tsx†L220-L320】【F:src/contexts/useAIMode.ts†L1-L13】【F:src/contexts/AIModeContext.tsx†L1-L86】
- Server proxy & AI service: `backend/routes/ai_chat.js` (SSE proxy) and `ai-service/routes/ai_chat.js` (intent router) plus `ai-service/services/gurulo_intent_router.js` and `ai-service/services/gurulo_response_builder.js` for classification payloads.【F:backend/routes/ai_chat.js†L1-L580】【F:ai-service/routes/ai_chat.js†L1-L263】【F:ai-service/services/gurulo_intent_router.js†L1-L200】【F:ai-service/services/gurulo_response_builder.js†L40-L296】
- i18n sources for availability/greeting copy: `src/i18n/locales/ka.json` & `src/i18n/locales/en.json` under `futuristicChat` and `chat.greeting` scopes.【F:src/i18n/locales/ka.json†L320-L337】【F:src/i18n/locales/en.json†L394-L411】

## Components & Hooks
- **AIChatInterface**
  - Contexts: `useAuth()` for `user`, `updateUserPreferences`, personal ID/role gating; `useAIMode()` for live-mode enforcement.【F:src/components/futuristic-chat/AIChatInterface.tsx†L658-L763】
  - Local state: open/hover state, messages array, input field, loading/error flags, voice recognition toggles, predictive hints, status counters, heartbeat timestamp, fallback metadata, and persistent preferences via `localStorage` keys `bakhmaro_ai_cloud_*`.【F:src/components/futuristic-chat/AIChatInterface.tsx†L671-L713】
  - Voice input handled via browser `SpeechRecognition` API with language switching.【F:src/components/futuristic-chat/AIChatInterface.tsx†L820-L910】
  - Suggestion pools differentiate super admin vs general copy; predictive hint reuses heartbeat time.【F:src/components/futuristic-chat/AIChatInterface.tsx†L620-L704】【F:src/components/futuristic-chat/AIChatInterface.tsx†L920-L1015】
  - Security gates: regex-based `detectDangerousInput` and `sanitizeAssistantOutput` enforce secrets/privileged/dangerous blocking and show `SECURITY_MESSAGES` in KA/EN.【F:src/components/futuristic-chat/AIChatInterface.tsx†L64-L140】【F:src/components/futuristic-chat/AIChatInterface.tsx†L472-L612】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1095-L1102】
  - Message flow: builds user message (blank title to avoid highlights), enforces client cooldown vs backend rate limits, submits SSE request, pipes structured response into `FuturisticChatPanel`, and exposes retry/clear handlers.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1034-L1590】

- **FuturisticChatPanel**
  - Stateless UI consuming props for open/close, send handler, predictive toggles, listening controls, error with retry button, and `statusBadges` tone mapping (`live`, `fallback`, `blocked`, `offline`).【F:src/components/futuristic-chat/FuturisticChatPanel.tsx†L55-L360】

- **ChatCloud**
  - Animated button receives `position`, hover callbacks, listening flag, and language label to display localized readiness (“ქართ. · მზადაა” / etc.).【F:src/components/futuristic-chat/ChatCloud.tsx†L4-L123】

## API & SSE Contract
- Frontend POSTs `/api/ai/chat` with body `{ message, personalId, conversationHistory: [{role, content}], metadata: { language, mode:'explain', client:'gurulo-ui', directive, timestamp } }`, sending cookies and headers `Content-Type`, `X-Gurulo-Client`, `X-User-Role` when available.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1121-L1171】
- Proxy `backend/routes/ai_chat.js` sets SSE headers (no buffering, identity encoding) and forwards to AI service using service token headers, Accept `text/event-stream`, correlation id, and optional role propagation.【F:backend/routes/ai_chat.js†L97-L119】【F:backend/routes/ai_chat.js†L304-L335】
- SSE events emitted: `meta` (request id), repeated `chunk` events (sanitized text), terminal `done` and `end`; proxy writes fallback chunk on errors and records `sse_open`, `chunk_write`, `done_write` telemetry.【F:backend/routes/ai_chat.js†L381-L538】
- Frontend stream reader handles event types `start`, `heartbeat`, `chunk`, `done`, `end`, `error`, aggregating text vs structured payloads and falling back to JSON decode when streaming unavailable.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1285-L1404】
- AI service REST fallback: `/api/ai/chat` classifies greeting/availability/smalltalk/recommendations and returns structured JSON when no streaming; includes telemetry metadata for intents and CTAs.【F:ai-service/routes/ai_chat.js†L181-L238】
- Auth pipeline ensures personal ID via `/api/auth/me` call inside `AuthContext` before chat unlocks; `sendMessage` refuses when `activePersonalId` missing.【F:src/contexts/AuthContext.tsx†L249-L284】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1039-L1045】

## States/Badges & i18n Keys
- Status badges rendered in panel header:
  - `offline` badge (“🔴 Offline”) shown when `unavailableDetails` populated via translations, tone `offline` (red).【F:src/components/futuristic-chat/AIChatInterface.tsx†L979-L999】【F:src/i18n/locales/en.json†L395-L400】【F:src/i18n/locales/ka.json†L321-L325】
  - `fallback` badge (“⚠️ Temporary fallback active” / KA equivalent) when realtime degraded without hard offline.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1004-L1014】
  - `blocked` badge counts policy violations and rate-limits.【F:src/components/futuristic-chat/AIChatInterface.tsx†L989-L1013】
  - Predictive hint message references heartbeat timestamp and super-admin mode, localized in-line rather than i18n file.【F:src/components/futuristic-chat/AIChatInterface.tsx†L920-L959】
  - Greeting & quick actions sourced from `chat.greeting.reply` keys; availability/offline copy from `futuristicChat.availability` (user/adminTitle/adminAnalysis/offlineBadge/retry).【F:src/i18n/locales/ka.json†L320-L337】【F:src/i18n/locales/en.json†L394-L411】
- Default assistant section title `'გურულოს რეკომენდაციები' / 'Gurulo Highlights'` applied whenever plaintext is auto-structured; greetings/availability payloads override titles to avoid injecting the highlight heading.【F:src/components/futuristic-chat/AIChatInterface.tsx†L112-L125】【F:ai-service/services/gurulo_response_builder.js†L73-L136】

## Fallback & Sanitizer
- Input guard rejects secrets, privileged operations, command execution, or network exfil patterns before network dispatch, incrementing telemetry counters and presenting localized security policy text.【F:src/components/futuristic-chat/AIChatInterface.tsx†L64-L110】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1095-L1102】
- Output sanitizer checks assistant responses for code/secret leaks and swaps with policy copy while marking status `error` to drive blocked badges.【F:src/components/futuristic-chat/AIChatInterface.tsx†L542-L612】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1249-L1282】
- Network fallback builds admin vs user diagnostic text via `buildUnavailableLines`, logs `ai_unavailable`, toggles realtime health flag, and surfaces retry label from i18n copy.【F:src/components/futuristic-chat/AIChatInterface.tsx†L208-L233】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1434-L1507】
- Backend proxy strips sensitive fields, disables compression (`Content-Encoding: identity`), and forces fallback stream when upstream errors or streaming disabled.【F:backend/routes/ai_chat.js†L11-L58】【F:backend/routes/ai_chat.js†L319-L335】【F:backend/routes/ai_chat.js†L520-L571】

## Telemetry Events
- Frontend console logs: `[GuruloTelemetry]` with role, fallback, blocked counts on state change; `ai_unavailable` for admin vs user fallback visibility; security/rate-limit increments stored locally.【F:src/components/futuristic-chat/AIChatInterface.tsx†L783-L790】【F:src/components/futuristic-chat/AIChatInterface.tsx†L1454-L1486】
- Backend streaming logs `sse_open`, `chunk_write`, `done_write`, and completion metadata; `streamingService` records chunk lengths for analytics.【F:backend/routes/ai_chat.js†L309-L420】
- AI service responses embed telemetry fields (`intent_detected`, `param_missing`, `cta_shown`, `recommendations_shown`) returned alongside structured content for greeting/availability/recommendation branches.【F:ai-service/services/gurulo_response_builder.js†L90-L286】

## Config & ENV
- Proxy consumes environment variables: `AI_SERVICE_URL`, `AI_INTERNAL_TOKEN`, `ALLOW_ANONYMOUS_AI_CHAT`, `AI_PROXY_STREAMING_MODE`, and optionally realtime provider keys (`GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) to switch streaming mode; sets signed service headers for upstream authentication.【F:backend/routes/ai_chat.js†L11-L118】
- Auth context uses `import.meta.env.DEV` for debug logging while calling `/api/auth/me` (no additional Vite vars required).【F:src/contexts/AuthContext.tsx†L220-L292】
- AIMode context persists `gurulo.aiMode` in `localStorage` but forces `live` mode regardless of stored `demo` state.【F:src/contexts/AIModeContext.tsx†L20-L76】
- Front chat itself does not reference `import.meta.env` keys, relying on proxy-relative paths (`/api/ai/chat`).

## Gaps/Risks
- **Unused intent guards**: helper constants for off-topic intent detection exist (`isNonSiteIntent` / `OFF_TOPIC_RESPONSE`) but are not invoked, so non-site prompts rely solely on backend classifiers—worth adding unit tests or wiring the frontend guard to prevent streaming chatter.【F:src/components/futuristic-chat/AIChatInterface.tsx†L560-L612】
- **Heartbeat expectations**: frontend listens for `start`/`heartbeat` events that proxy never emits; consider adding periodic heartbeat events in proxy or pruning the check to avoid silent stalls tracking stale timestamps.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1335-L1373】【F:backend/routes/ai_chat.js†L381-L433】
- **Telemetry persistence**: current metrics are console-only; integrate with central telemetry service to capture blocked/fallback counts and SSE health for monitoring.
- **Authentication dependency**: chat silently refuses when `activePersonalId` missing; add UI prompt guiding users to sign in or instrument tests ensuring `/api/auth/me` failures present actionable messaging.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1039-L1045】
