
#!/bin/bash

echo "🚀 Deploying Firebase Functions for log cleanup..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase (if not already logged in)
echo "🔐 Checking Firebase authentication..."
firebase login --no-localhost

# Install function dependencies
echo "📦 Installing function dependencies..."
cd functions
npm install
cd ..

# Deploy functions
echo "🚀 Deploying functions to Firebase..."
firebase deploy --only functions

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Check Firebase Console → Functions to verify deployment"
echo "2. The cleanup function will run daily at midnight UTC"
echo "3. You can test it manually using the Firebase Console"
echo "4. Monitor logs in Firebase Console → Functions → Logs"
