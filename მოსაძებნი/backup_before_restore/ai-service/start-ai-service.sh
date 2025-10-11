
#!/bin/bash

echo "🤖 Starting Bakhmaro AI Microservice..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️ No .env file found. Copying from .env.example..."
    cp .env.example .env
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start the AI service
echo "🚀 Starting AI service on port 5001..."
npm start
