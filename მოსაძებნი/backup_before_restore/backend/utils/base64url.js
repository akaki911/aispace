const toBase64Url = (input) => {
  let buffer;

  if (input instanceof ArrayBuffer) {
    buffer = Buffer.from(input);
  } else if (input instanceof Uint8Array) {
    buffer = Buffer.from(input);
  } else if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    buffer = Buffer.from(input);
  } else {
    throw new Error('Invalid input type for base64url encoding');
  }

  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (base64url) => {
  if (!base64url || typeof base64url !== 'string') {
    throw new Error('Valid base64url string is required');
  }

  // Add padding if needed
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  return Buffer.from(base64, 'base64');
};

module.exports = { toBase64Url, fromBase64Url };