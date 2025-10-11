const test = require('node:test');
const assert = require('node:assert');

const firestoreModulePath = require.resolve('firebase-admin/firestore');
const originalFirestoreModule = require.cache[firestoreModulePath];

require.cache[firestoreModulePath] = {
  exports: {
    getFirestore: () => ({
      collection: () => ({
        add: async () => ({ id: 'mock-id' }),
        orderBy() { return this; },
        limit() { return this; },
        where() { return this; },
        startAfter() { return this; },
        async get() { return { docs: [] }; },
      }),
    }),
    FieldValue: {
      serverTimestamp: () => new Date(),
    },
  },
};

const routeAdvice = require('../routes/route_advice');
const auditService = require('../services/audit_service');

const getRouteHandler = () => {
  const layer = routeAdvice.stack.find((stackItem) => stackItem.route?.path === '/' && stackItem.route?.methods?.get);
  if (!layer) {
    throw new Error('Route handler for GET / not found');
  }
  return layer.route.stack[0].handle;
};

test('route advice logs decisions without throwing', async () => {
  const handler = getRouteHandler();
  let recordedPayload = null;
  const original = auditService.logRouteDecision;

  auditService.logRouteDecision = async (...args) => {
    recordedPayload = args;
    return null;
  };

  const req = {
    session: {
      user: { id: 'user-123', role: 'SUPER_ADMIN' },
      isAuthenticated: true,
      deviceTrusted: false,
    },
    get: () => '',
  };

  let jsonPayload = null;
  const res = {
    json: (payload) => {
      jsonPayload = payload;
      return payload;
    },
  };

  await handler(req, res);

  assert.ok(jsonPayload, 'response payload should be returned');
  assert.strictEqual(jsonPayload.target, '/admin');
  assert.ok(Array.isArray(recordedPayload), 'audit service should be invoked');
  assert.strictEqual(recordedPayload[0], 'user-123');
  assert.strictEqual(recordedPayload[1], 'SUPER_ADMIN');

  auditService.logRouteDecision = original;
});

test.after(() => {
  if (originalFirestoreModule) {
    require.cache[firestoreModulePath] = originalFirestoreModule;
  } else {
    delete require.cache[firestoreModulePath];
  }
});
