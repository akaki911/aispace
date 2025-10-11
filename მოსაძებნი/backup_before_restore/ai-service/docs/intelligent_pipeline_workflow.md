# Intelligent Answering Pipeline - Complete Workflow

## Overview
The Intelligent Answering Pipeline is a sophisticated system that dynamically routes queries to the most appropriate AI model based on complexity and type, ensuring optimal cost-efficiency and response quality.

## Complete Workflow

```
User Input → routeQuery() → Model Selection (large/small/none) → API Call (if not 'none') → sanitizeResponse() → Final Output to User
```

## Step-by-Step Process

### 1. Query Reception
- User sends message via `/api/ai/intelligent-chat` endpoint
- System validates input and extracts message, conversation history, and personal ID

### 2. Query Routing (`routeQuery()`)
**Location**: `ai-service/policy/model_router.js`

**Classification Rules**:
- **GREETING** → Model: `'none'` (Static response, no API call)
  - Keywords: გამარჯობა, hello, როგორ ხარ, etc.
  - Action: Return random greeting from static pool

- **SIMPLE_QA** → Model: `'small'` (Fast, cheap model)
  - Keywords: რა არის, what is, who is, etc.
  - Criteria: Short queries (≤25 words, ≤160 chars)
  - Action: Route to small model (e.g., groq-llama3-8b)

- **CODE_COMPLEX** → Model: `'large'` (Powerful model)
  - Keywords: დამიწერე კოდი, debug, error, fix, etc.
  - Action: Route to large model (e.g., openai-gpt-4o)

- **REASONING_COMPLEX** → Model: `'large'` (Powerful model)
  - Keywords: ამიხსენი, გაანალიზე, why, analysis, etc.
  - Criteria: Long queries (≥40 words, ≥250 chars, ≥3 sentences)
  - Action: Route to large model

### 3. Model Selection Switch
**Location**: `ai-service/core/intelligent_answering_engine.js`

```javascript
switch (model) {
  case 'none':
    response = getRandomGreeting(); // Static, instant
    break;
  case 'small':
    response = await callSmallModelAPI(message, history); // Fast, cheap
    break;
  case 'large':
    response = await callLargeModelAPI(message, history); // Powerful, accurate
    break;
}
```

### 4. Response Sanitization
**Location**: `ai-service/utils/enhanced_sanitizer.js`

**Sanitization Steps**:
1. **Persona Protection**: Replace "მე ვარ აკაკი" → "მე ვარ გურულო"
2. **Grammar Corrections**: Fix common Georgian mistakes
3. **Conditional Replit Removal**: Remove "Replit" mentions if user didn't ask about it
4. **Length Truncation**: Limit to 800 characters max

### 5. Final Response
Return comprehensive result with metadata:
```json
{
  "success": true,
  "response": "sanitized final response",
  "policy": "SIMPLE_QA",
  "model": "small",
  "apiUsed": true,
  "sanitized": true,
  "timestamp": "2025-09-10T...",
  "personalId": "user_id"
}
```

## Key Benefits

### 🚀 **Speed**
- **Instant responses** for greetings (0ms API delay)
- **Fast responses** for simple questions (~100ms)
- **Quality responses** for complex tasks (~500ms)

### 💰 **Cost Efficiency**
- **0 cost** for greetings (static responses)
- **Low cost** for simple Q&A (small model)
- **Justified cost** for complex coding/reasoning (large model)

### 🎯 **Quality Assurance**
- **Consistent persona** (always "Gurulo", never "Akaki")
- **Grammar corrections** for Georgian text
- **Policy compliance** (conditional Replit mentions)
- **Length control** (max 800 characters)

### 🔒 **Persona Lock**
- AI identity locked to "Gurulo" - witty, helpful developer from Guria
- Never identifies as Akaki, GPT, or other models
- Silent reasoning - shows only final answers
- Direct, practical responses

## File Structure

```
ai-service/
├── policy/
│   └── model_router.js          # Query classification & routing
├── core/
│   └── intelligent_answering_engine.js  # Main processing engine
├── utils/
│   └── enhanced_sanitizer.js    # Response sanitization
├── context/
│   └── system_prompts.js        # Optimized prompts with persona lock
└── routes/
    └── ai_chat.js              # Integration endpoint
```

## Testing

All components tested and verified:
- ✅ Query routing accuracy
- ✅ Persona protection
- ✅ Grammar corrections
- ✅ Replit mention handling
- ✅ Length truncation
- ✅ End-to-end pipeline

## Usage

**New Intelligent Endpoint**: `POST /api/ai/intelligent-chat`
**Legacy Endpoint**: `POST /api/ai/chat` (unchanged, for compatibility)

The intelligent pipeline provides optimal balance of speed, cost, and quality for the Gurulo AI Assistant.