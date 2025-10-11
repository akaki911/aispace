# Gurulo Admin Chat Overview

## High-Level Structure
- **Admin navigation** exposes "გურულოს მართვა" (Gurulo management) entries exclusively to super administrators from the main admin shell (`src/AdminPanel.tsx`). That navigation routes into the AI Developer area and allows switching to the "ჩატის პრომპტები" (Chat Prompts) section.【F:src/AdminPanel.tsx†L260-L317】
- The dedicated management surface is orchestrated in `src/components/admin/AIDeveloperManagementPanel.tsx`, which wires together discrete overview, configuration, user management, customization, analytics, and integration panels under `src/components/admin/ai-panel`. Each section focuses on a dedicated concern, keeping the admin experience modular and maintainable.【F:src/components/admin/AIDeveloperManagementPanel.tsx†L52-L438】【F:src/components/admin/ai-panel/OverviewSection.tsx†L30-L135】【F:src/components/admin/ai-panel/ChatConfigSection.tsx†L21-L143】【F:src/components/admin/ai-panel/UserManagementSection.tsx†L19-L173】【F:src/components/admin/ai-panel/UICustomizationSection.tsx†L21-L128】【F:src/components/admin/ai-panel/AnalyticsSection.tsx†L13-L88】【F:src/components/admin/ai-panel/IntegrationsSection.tsx†L13-L102】

## Admin Chat Configuration UI
- The "ჩატის კონფიგურაცია" section (`ChatConfigSection.tsx`) renders a Monaco editor for prompt tuning together with slider-based controls for token limits, rate limiting, and content filter strength.【F:src/components/admin/ai-panel/ChatConfigSection.tsx†L35-L143】
- User session tooling (`UserManagementSection.tsx`), UI controls (`UICustomizationSection.tsx`), analytics (`AnalyticsSection.tsx`), and integration shortcuts (`IntegrationsSection.tsx`) surface the remaining admin capabilities while the parent panel persists state and simulation helpers.【F:src/components/admin/ai-panel/UserManagementSection.tsx†L31-L160】【F:src/components/admin/ai-panel/UICustomizationSection.tsx†L35-L128】【F:src/components/admin/ai-panel/AnalyticsSection.tsx†L13-L88】【F:src/components/admin/ai-panel/IntegrationsSection.tsx†L13-L102】【F:src/components/admin/AIDeveloperManagementPanel.tsx†L191-L438】
- All `/api/ai/admin/*` maintenance calls now flow through `src/services/adminAiApi.ts`, centralising fetch logic for prompts, error logs, user moderation, key rotation, backup, and restore tasks.【F:src/services/adminAiApi.ts†L1-L73】【F:src/components/admin/AIDeveloperManagementPanel.tsx†L179-L269】

## Live Chat Client (Gurulo UI)
- The reusable chat front end lives in `src/components/futuristic-chat/AIChatInterface.tsx`. It enforces cooldowns, rate limiting, and security rules before emitting a request to `/api/ai/chat`, tagging it with `X-Gurulo-Client` and the current user role for policy-aware responses.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1080-L1191】
- The component understands server-sent events, decoding streamed `event: chunk` payloads, applying sanitation, and rendering structured output while tracking telemetry for blocked, fallback, or offline cases.【F:src/components/futuristic-chat/AIChatInterface.tsx†L1200-L1393】
- Extensive dangerous-input/output regexes block secret exfiltration, privileged backend calls, and risky shell/code execution instructions, ensuring the admin assistant cannot leak or execute sensitive operations.【F:src/components/futuristic-chat/AIChatInterface.tsx†L58-L99】

## Backend Proxy Layer
- Browser requests to `/api/ai/chat` are handled by `backend/routes/ai_chat.js`, which mints a signed service token, forwards headers such as `X-Gurulo-Client` and `X-User-Role`, and proxies either to streaming (`/api/ai/stream`) or classic (`/api/ai/chat`) endpoints on the dedicated AI service. It retries transient failures and relays SSE chunks directly to the browser.【F:backend/routes/ai_chat.js†L1-L207】

## AI Service and Model Selection
- The AI microservice (`ai-service`) exposes `/api/ai/stream` via `routes/ai_stream.js`. It wraps Groq's chat completions API, sending a Gurulo-specific system prompt and relaying streaming chunks back to the backend with heartbeat keep-alives.【F:ai-service/routes/ai_stream.js†L1-L118】【F:ai-service/routes/ai_stream.js†L118-L198】
- `ai-service/services/groq_service.js` decides which Groq model to use. Routine queries use `llama-3.1-8b-instant`, while longer system/code-analysis prompts escalate to `llama-3.3-70b-versatile`. If no Groq key is configured or offline mode is forced, the service emits a branded offline response instead of contacting an external LLM.【F:ai-service/services/groq_service.js†L5-L78】【F:ai-service/services/groq_service.js†L59-L148】

## Fallback Handling
- Backend fallbacks are handled by a lightweight responder (`backend/services/fallbackResponder.js`) that generates deterministic replies for math, greetings, and generic support flows when the Groq microservice is unavailable.【F:backend/services/fallbackResponder.js†L1-L52】
- `backend/services/ai_client.js` consumes that responder, producing structured fallback chat payloads whenever circuit-breaker policies trip or the upstream Groq call fails, keeping the admin experience responsive even during outages.【F:backend/services/ai_client.js†L3-L503】

## Summary of Data Flow
1. Admin selects Gurulo management in the main admin shell and uses the prompt/limit controls rendered by `AIDeveloperManagementPanel`.
2. Operators and regular admins chat through `AIChatInterface`, which validates input and posts to the backend proxy.
3. `backend/routes/ai_chat.js` signs and forwards the request to the AI service, opting into SSE streaming when supported.
4. `ai-service/routes/ai_stream.js` uses `groq_service.askGroq` to reach Groq's LLaMA 3 models (or offline fallback), streaming responses back.
5. The chat UI renders streamed chunks with safety filters; admin tools can rotate keys, backup data, or tweak prompts as needed.

This pipeline explains which files participate in Gurulo's admin chat, how models are chosen, and how the backend's fallback responder preserves continuity when Groq connectivity is interrupted.
