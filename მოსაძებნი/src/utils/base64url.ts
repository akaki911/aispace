// Node/Browser-safe atob/btoa
const _atob =
  typeof atob === 'function'
    ? atob
    : (b64: string) => Buffer.from(b64, 'base64').toString('binary');

const _btoa =
  typeof btoa === 'function'
    ? btoa
    : (bin: string) => Buffer.from(bin, 'binary').toString('base64');

export function b64urlToArrayBuffer(b64url: string): ArrayBuffer {
  if (!b64url || typeof b64url !== 'string') throw new Error('Invalid b64url');
  const pad = '==='.slice((b64url.length + 3) % 4);
  const b64 = (b64url.replace(/-/g, '+').replace(/_/g, '/')) + pad;
  const raw = _atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function arrayBufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = _btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const str = atob(base64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}