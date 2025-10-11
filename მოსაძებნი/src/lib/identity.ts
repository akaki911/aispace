
// src/lib/identity.ts
export type Identity = {
  personalId?: string | null;
  firebaseUid?: string | null;
  email?: string | null;
};

export function resolveMemoryKey(id: Identity) {
  return id.personalId || id.firebaseUid || id.email || 'anonymous';
}
