
# Replit Secrets Setup for Firebase

Follow these steps to configure Firebase environment variables in Replit:

## 1. Open Replit Secrets Tab
- Click on the "Secrets" tab in your Replit workspace (lock icon in sidebar)

## 2. Add Firebase Configuration Variables
Add each of these secrets with their respective values:

```
VITE_FIREBASE_API_KEY=AIzaSyBH0-yeuoUIWOiO1ZXGDcuJ7_vP6BkugBw
VITE_FIREBASE_AUTH_DOMAIN=bakhmaro-cottages.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bakhmaro-cottages
VITE_FIREBASE_STORAGE_BUCKET=bakhmaro-cottages.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=815060315119
VITE_FIREBASE_APP_ID=1:815060315119:web:a1f33d920bcd52e536a41a
VITE_FIREBASE_MEASUREMENT_ID=G-NT97B9E4YL
```

## 3. Restart Development Server
After adding secrets, restart your development server:
- Stop current processes (Ctrl+C)
- Click the "Run" button again

## 4. Verification
Check browser console for: "✅ Firebase initialized successfully"

## Troubleshooting
- Ensure all variable names start with `VITE_`
- No spaces around the `=` sign
- Restart if variables don't appear immediately
