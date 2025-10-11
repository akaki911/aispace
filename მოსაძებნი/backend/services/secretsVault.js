const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const STORAGE_FILENAME = 'secrets_store.json';
const STORAGE_PATH = path.join(__dirname, '..', 'data', STORAGE_FILENAME);
const MAX_VALUE_SIZE_BYTES = 8 * 1024;
const VALID_VISIBILITY = new Set(['hidden', 'visible']);
const VALID_SOURCE = new Set(['app', 'account', 'scanned']);
const KEY_REGEX = /^[A-Z0-9_.:-]{2,128}$/;

class SecretsVault {
  constructor() {
    this.records = [];
    this.encryptionKey = null;
    this.initializationError = null;

    try {
      this.encryptionKey = this.resolveEncryptionKey();
      this.ensureStorage();
    } catch (error) {
      this.initializationError = error;
      console.error('❌ Failed to initialise SecretsVault:', error.message);
    }
  }

  normaliseRecord(record) {
    if (!record) {
      return record;
    }

    const normalised = { ...record };
    if (normalised.required === undefined) {
      normalised.required = false;
    } else {
      normalised.required = Boolean(normalised.required);
    }

    if (!normalised.source) {
      normalised.source = 'app';
    }

    return normalised;
  }

  ensureReady() {
    if (this.initializationError) {
      const error = new Error(this.initializationError.message);
      error.code = this.initializationError.code || 'CONFIG_ERROR';
      throw error;
    }
  }

  resolveEncryptionKey() {
    const rawKey = process.env.SECRETS_ENC_KEY;
    if (!rawKey) {
      const error = new Error('SECRETS_ENC_KEY missing');
      error.code = 'CONFIG_ERROR';
      throw error;
    }

    const attemptBuffers = [
      Buffer.from(rawKey, 'utf-8'),
    ];

    try {
      attemptBuffers.push(Buffer.from(rawKey, 'base64'));
    } catch (error) {
      // ignore base64 decoding errors
    }

    const keyBuffer = attemptBuffers.find((buf) => buf.length === 32);
    if (!keyBuffer) {
      const error = new Error('SECRETS_ENC_KEY must be 32 bytes (utf-8 or base64 encoded)');
      error.code = 'CONFIG_ERROR';
      throw error;
    }

    return keyBuffer;
  }

  ensureStorage() {
    try {
      fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
      if (!fs.existsSync(STORAGE_PATH)) {
        fs.writeFileSync(STORAGE_PATH, '[]', 'utf-8');
      }
      const payload = fs.readFileSync(STORAGE_PATH, 'utf-8');
      if (!payload.trim()) {
        this.records = [];
      } else {
        const parsed = JSON.parse(payload);
        this.records = Array.isArray(parsed) ? parsed.map((record) => this.normaliseRecord(record)) : [];
      }
    } catch (error) {
      const loadError = new Error(`Failed to initialise secrets storage: ${error.message}`);
      loadError.code = 'STORAGE_ERROR';
      throw loadError;
    }
  }

  async persist() {
    this.ensureReady();
    const serialised = JSON.stringify(this.records, null, 2);
    await fsp.writeFile(STORAGE_PATH, `${serialised}\n`, 'utf-8');
  }

  validateKey(key) {
    if (!key || typeof key !== 'string' || !KEY_REGEX.test(key)) {
      const error = new Error('Key must match ^[A-Z0-9_.:-]{2,128}$');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  isValidKey(key) {
    try {
      this.validateKey(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  validateVisibility(visibility) {
    if (visibility === undefined) return;
    if (!VALID_VISIBILITY.has(visibility)) {
      const error = new Error('visibility must be one of hidden|visible');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  validateSource(source) {
    if (source === undefined) return;
    if (!VALID_SOURCE.has(source)) {
      const error = new Error('source must be one of app|account|scanned');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  validateValue(value) {
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') {
      const error = new Error('value must be a string');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
    const size = Buffer.byteLength(value, 'utf-8');
    if (size > MAX_VALUE_SIZE_BYTES) {
      const error = new Error('value exceeds maximum size of 8KB');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  encrypt(value) {
    this.ensureReady();
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), encrypted.toString('base64'), authTag.toString('base64')].join('.');
  }

  decrypt(record) {
    if (!record || !record.valueEncrypted) return null;
    const [ivB64, dataB64, authTagB64] = record.valueEncrypted.split('.');
    if (!ivB64 || !dataB64 || !authTagB64) {
      const error = new Error('Invalid encrypted payload');
      error.code = 'DECRYPT_ERROR';
      throw error;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  findIndex(key) {
    return this.records.findIndex((entry) => entry.key === key);
  }

  summarise(record) {
    if (!record) return null;
    const { key, visibility, source, updatedAt, createdAt, createdBy, updatedBy, valueEncrypted, required } = record;
    return {
      key,
      visibility,
      source,
      createdAt,
      createdBy,
      updatedAt,
      updatedBy: updatedBy || createdBy,
      hasValue: Boolean(valueEncrypted),
      required: Boolean(required),
    };
  }

  reveal(key) {
    this.ensureReady();
    this.validateKey(key);

    const index = this.findIndex(key);
    if (index === -1) {
      const error = new Error('Secret not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const record = this.records[index];
    const hasValue = Boolean(record.valueEncrypted);

    if (!hasValue) {
      return { key: record.key, value: null, visibility: record.visibility, hasValue: false };
    }

    if (record.visibility !== 'visible') {
      const error = new Error('Secret is not visible');
      error.code = 'FORBIDDEN';
      throw error;
    }

    const value = this.decrypt(record);
    return { key: record.key, value, visibility: record.visibility, hasValue: true };
  }

  list({ page = 1, pageSize = 25, search = '' } = {}) {
    this.ensureReady();
    const safePage = Number.isFinite(page) ? Math.max(1, parseInt(page, 10)) : 1;
    const safeSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, parseInt(pageSize, 10))) : 25;
    const startIndex = (safePage - 1) * safeSize;
    const query = typeof search === 'string' ? search.trim() : '';

    const filtered = query
      ? this.records.filter((record) => record.key.includes(query))
      : this.records;

    const paginated = filtered.slice(startIndex, startIndex + safeSize).map((record) => this.summarise(record));

    return {
      items: paginated,
      total: filtered.length,
      page: safePage,
      pageSize: safeSize,
    };
  }

  get(key) {
    this.ensureReady();
    this.validateKey(key);
    const index = this.findIndex(key);
    if (index === -1) {
      const error = new Error('Secret not found');
      error.code = 'NOT_FOUND';
      throw error;
    }
    return this.records[index];
  }

  getAllKeys() {
    this.ensureReady();
    return new Set(this.records.map((record) => record.key));
  }

  async create({ key, value, visibility = 'hidden', source = 'app', createdBy = 'unknown', required = false }) {
    this.ensureReady();
    this.validateKey(key);
    this.validateValue(value);
    this.validateVisibility(visibility);
    this.validateSource(source);
    this.validateRequired(required);

    if (this.findIndex(key) !== -1) {
      const error = new Error('Secret with this key already exists');
      error.code = 'DUPLICATE';
      throw error;
    }

    const now = new Date().toISOString();
    const record = {
      key,
      valueEncrypted: this.encrypt(value),
      visibility,
      source,
      updatedAt: now,
      createdAt: now,
      createdBy,
      updatedBy: createdBy,
      required: Boolean(required),
    };
    this.records.push(record);
    await this.persist();
    return this.summarise(record);
  }

  async update(key, { value, visibility, source, updatedBy = 'unknown', required }) {
    this.ensureReady();
    this.validateKey(key);
    if (value !== undefined) {
      this.validateValue(value);
    }
    this.validateVisibility(visibility);
    this.validateSource(source);
    if (required !== undefined) {
      this.validateRequired(required);
    }

    const index = this.findIndex(key);
    if (index === -1) {
      const error = new Error('Secret not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const record = this.records[index];
    const hasUpdates =
      value !== undefined || visibility !== undefined || source !== undefined || required !== undefined;
    if (!hasUpdates) {
      const error = new Error('No updates provided');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (value !== undefined) {
      record.valueEncrypted = this.encrypt(value);
    }
    if (visibility !== undefined) {
      record.visibility = visibility;
    }
    if (source !== undefined) {
      record.source = source;
    }
    if (required !== undefined) {
      record.required = Boolean(required);
    }
    record.updatedAt = new Date().toISOString();
    record.updatedBy = updatedBy;

    this.records[index] = record;
    await this.persist();
    return this.summarise(record);
  }

  validateRequired(required) {
    if (required === undefined) return;
    if (typeof required !== 'boolean') {
      const error = new Error('required must be a boolean');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  async remove(key) {
    this.ensureReady();
    this.validateKey(key);
    const index = this.findIndex(key);
    if (index === -1) {
      const error = new Error('Secret not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const [removed] = this.records.splice(index, 1);
    await this.persist();
    return this.summarise(removed);
  }

  getAllSummaries() {
    this.ensureReady();
    return this.records.map((record) => this.summarise(record));
  }

  exportForSync() {
    this.ensureReady();
    return this.records.map((record) => ({
      key: record.key,
      value:
        record.valueEncrypted && record.valueEncrypted.length > 0
          ? this.decrypt(record)
          : '',
      visibility: record.visibility,
      hasValue: Boolean(record.valueEncrypted),
      required: Boolean(record.required),
    }));
  }
}

module.exports = new SecretsVault();
