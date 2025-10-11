const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '..', 'data', 'secrets_sync_queue.json');

class SecretsSyncQueue {
  constructor() {
    this.pending = new Set();
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(STORAGE_PATH)) {
        fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
        fs.writeFileSync(STORAGE_PATH, JSON.stringify({ pending: [] }, null, 2));
        this.pending = new Set();
        return;
      }

      const payload = fs.readFileSync(STORAGE_PATH, 'utf8');
      if (!payload.trim()) {
        this.pending = new Set();
        return;
      }

      const data = JSON.parse(payload);
      if (data && Array.isArray(data.pending)) {
        this.pending = new Set(data.pending.filter((key) => typeof key === 'string'));
      } else {
        this.pending = new Set();
      }
    } catch (error) {
      console.warn('⚠️ [SecretsSyncQueue] Failed to load queue:', error.message);
      this.pending = new Set();
    }
  }

  async persist() {
    const serialised = JSON.stringify({ pending: Array.from(this.pending) }, null, 2);
    await fsp.writeFile(STORAGE_PATH, `${serialised}\n`, 'utf8');
  }

  async add(key) {
    if (!key) return;
    this.pending.add(key);
    await this.persist();
  }

  async remove(keys = []) {
    let mutated = false;
    for (const key of keys) {
      if (this.pending.delete(key)) {
        mutated = true;
      }
    }
    if (mutated) {
      await this.persist();
    }
  }

  async clear() {
    if (this.pending.size === 0) {
      return;
    }
    this.pending = new Set();
    await this.persist();
  }

  list() {
    return Array.from(this.pending);
  }
}

module.exports = new SecretsSyncQueue();
