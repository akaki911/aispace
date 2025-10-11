
# Bakhmaro AI Microservice

🤖 **Standalone AI service for the Bakhmaro booking platform**

## Overview

This is a fully independent AI microservice that handles all AI-related functionality for the Bakhmaro platform, including:

- 💬 AI Chat (`/api/ai/chat`)
- 🌊 Streaming responses (`/api/ai/stream`)
- 🏥 Health monitoring (`/api/ai/health`, `/api/ai/status`)
- 🧠 Memory management
- 🔍 Code analysis and RAG
- 📊 Performance monitoring

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Groq API key and other settings
```

3. **Start the service:**
```bash
npm start
# or for development:
npm run dev
```

The AI service will be available at: `http://0.0.0.0:5001`

## API Endpoints

- `GET /health` - Service health check
- `GET /api/ai/health` - AI system health
- `GET /api/ai/status` - Groq API status
- `POST /api/ai/chat` - Main chat endpoint
- `POST /api/ai/stream` - Streaming chat
- `GET /api/ai/resources` - Resource monitoring

## Environment Variables

```bash
AI_PORT=5001                    # Service port
GROQ_API_KEY=your_key_here     # Groq AI API key
MEMORY_STORAGE_PATH=./memory_data
MEMORY_FACTS_PATH=./memory_facts
NODE_ENV=development
DEBUG_MODE=true
```

## Architecture

```
ai-service/
├── server.js                 # Main Express server
├── controllers/
│   └── ai_controller.js      # AI request handling
├── services/
│   ├── groq_service.js       # Groq API integration
│   ├── memory_controller.js  # Memory management
│   ├── prompt_manager.js     # Prompt optimization
│   └── ...                   # Other AI services
├── utils/
│   └── enhanced_georgian_validator.js
├── routes/
│   └── memory_*.js           # Memory routes
└── memory_data/              # User memory storage
```

## Testing

```bash
npm test
# or run specific tests:
node test_ai_comprehensive.js
```

## Integration

The main backend proxies AI requests to this microservice:
- Main Backend: `http://0.0.0.0:5002`
- AI Microservice: `http://0.0.0.0:5001`
- Frontend: `http://0.0.0.0:3000`

## Production Deployment

On Replit, this service can be deployed independently or as part of the full stack using the provided workflows.
