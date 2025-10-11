# AI Chat Streaming Diagnostic Summary

## Scope & Constraints
- Investigation performed within local repository snapshot; live infrastructure (browser UI, running backend, Groq provider) was not available.
- Could not obtain runtime network captures, correlation-id aligned logs, or environment snapshots referenced in the request due to missing access to deployed services.
- Analysis therefore focused on static inspection of frontend/backend/AI-service source code to infer the failure point in the chat → stream pipeline.

## Key Findings
1. **Backend expects genuine SSE stream from AI service**
   - `backend/routes/ai_chat.js` proxies `/api/ai/chat` to the AI service's `/api/ai/stream`, forwarding the correlation id and directly piping the upstream `Readable` body back to the client.【F:backend/routes/ai_chat.js†L59-L130】
   - Any upstream response that does not expose a real streaming body (i.e., `responseType: 'stream'`) results in truncated or missing incremental updates.

2. **AI service disables streaming inadvertently**
   - `/api/ai/stream` builds a Groq request via `groqService.askGroq(...)` and intends to enable streaming with the third argument set to `true` (per inline comment).【F:ai-service/routes/ai_stream.js†L113-L123】
   - `askGroq` is defined as `askGroq(messages, enableStreaming = 'auto', retryCount = 0)`; the second positional argument controls streaming mode.【F:ai-service/services/groq_service.js†L52-L119】
   - Prior code mistakenly passed `(messages, personalId, true)`, causing the Georgian personal identifier to be treated as `enableStreaming`. Because the value is a non-boolean string, `enableStreaming === true` resolves to `false`, so Groq requests were issued in non-streaming mode. The `true` argument shifted into the `retryCount` slot, breaking retry semantics as well.
   - Without streaming, the AI service fell back to synthesizing a single `chunk` event from the full response, which is observable downstream as "instant completion" rather than progressive streaming.

3. **Root cause & fix**
   - Root cause: incorrect argument ordering when invoking `groqService.askGroq` inside the streaming route.
   - Fix applied: call `groqService.askGroq([...], true)` so the `enableStreaming` flag is correctly set while preserving default retry logic.【F:ai-service/routes/ai_stream.js†L118-L121】

## Recommendations & Next Steps
- Deploy updated AI service to environment that exhibited the streaming issue.
- During verification capture:
  1. Frontend network trace for `/api/ai/chat` and `/api/ai/stream` with correlation id.
  2. Backend logs confirming SSE proxy (look for `Live mode: ON`).
  3. AI service logs confirming `🚀 Groq API Request` with `streaming: true`.
- Confirm browser now receives incremental `chunk` events prior to `end`.
- Optional: extend `askGroq` signature to accept an options object (e.g., `{ personalId, stream: true }`) to avoid future positional mistakes.
