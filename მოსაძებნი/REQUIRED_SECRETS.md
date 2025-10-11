
# გამოყენებული Secrets-ები

აუცილებელი სეკრეტები Replit Secrets-ში:

> ℹ️ **ლოკალური განვითარებისთვის:** `scripts/ensureLocalSecrets.js` ავტომატურად გენერირებს საჭირო dev-secret-ებს და ინახავს მათ `config/local-secrets.json` ფაილში (gitignored).  ეს მნიშვნელობები იტვირთება Backend-სა და AI Service-ში გაშვებისას, ამიტომ Replit Secrets-ის მითითება მხოლოდ production გარემოსთვისაა აუცილებელი.

## AI Service
```
AI_INTERNAL_TOKEN=your_jwt_secret_256_bit_minimum
GROQ_API_KEY=your_groq_api_key
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your_firebase_project_id
ALLOWED_BACKEND_IPS=127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

## Backend
```
AI_INTERNAL_TOKEN=same_jwt_secret_as_ai_service
SESSION_SECRET=your_session_secret_256_bit
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your_firebase_project_id
AI_SERVICE_URL=http://127.0.0.1:5001
SECRETS_ENC_KEY=32_byte_base64_encryption_key (e.g. configure with the shared production value)
ADMIN_SETUP_TOKEN=your_admin_setup_token
```

## Frontend
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Production Security ❗
- `AI_INTERNAL_TOKEN`: 256-bit რანდომული სტრინგი (ორივე სერვისში ერთნაირი)
- `SESSION_SECRET`: 256-bit რანდომული სტრინგი
- TLS/HTTPS: ავტომატურად Replit Production-ზე
- CORS: Production domains მხოლოდ
- Cookies: `secure: true`, `sameSite: 'none'` production-ზე

## IP Allowlist
Backend-ისთვის AI Service-ზე:
- `127.0.0.1` (localhost)
- `10.0.0.0/8` (private network)
- `172.16.0.0/12` (docker networks)
- `192.168.0.0/16` (local networks)
