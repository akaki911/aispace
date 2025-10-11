
#!/bin/bash

echo "🔄 Preparing Bakhmaro Platform Services..."

echo "🧹 Cleaning npm cache..."
cd ai-service && npm cache clean --force --silent 2>/dev/null || true
cd ../backend && npm cache clean --force --silent 2>/dev/null || true
cd .. && npm cache clean --force --silent 2>/dev/null || true

echo "📦 Installing dependencies..."
cd ai-service && npm install --silent 2>/dev/null || true
cd ../backend && npm install --silent 2>/dev/null || true  
cd .. && npm install --silent 2>/dev/null || true

echo "✅ Setup completed!"
echo "🚀 Use the Run button to start all services"
echo "Services will start on ports:"
echo "  - Frontend: 3000"
echo "  - Backend: 5002" 
echo "  - AI Service: 5001"
