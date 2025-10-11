const fs = require('fs');
const path = require('path');

const DEFAULT_MODE = 'plan';

const normalizeMode = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'plan' || normalized === 'build' ? normalized : null;
};

const resolveTimestamp = (value) => {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
};

class PlanModeService {
  constructor() {
    this.storagePath = path.join(__dirname, '../data/plan_mode_state.json');
    this.ensureStorage();
  }

  ensureStorage() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.storagePath)) {
        const initialState = {
          mode: DEFAULT_MODE,
          updatedAt: new Date().toISOString(),
          updatedBy: null,
        };
        fs.writeFileSync(this.storagePath, JSON.stringify(initialState, null, 2));
      }
    } catch (error) {
      console.error('❌ [PlanModeService] Failed to ensure storage file', error);
    }
  }

  readState() {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return {
          mode: DEFAULT_MODE,
          updatedAt: new Date().toISOString(),
          updatedBy: null,
        };
      }

      const raw = fs.readFileSync(this.storagePath, 'utf8');
      if (!raw.trim()) {
        return {
          mode: DEFAULT_MODE,
          updatedAt: new Date().toISOString(),
          updatedBy: null,
        };
      }

      const parsed = JSON.parse(raw);
      const mode = normalizeMode(parsed.mode || parsed.planMode || parsed.value) || DEFAULT_MODE;
      const updatedAt = resolveTimestamp(parsed.updatedAt || parsed.updated_at || parsed.timestamp);
      const updatedBy = typeof parsed.updatedBy === 'string'
        ? parsed.updatedBy
        : typeof parsed.updated_by === 'string'
          ? parsed.updated_by
          : typeof parsed.actor === 'string'
            ? parsed.actor
            : null;

      return {
        mode,
        updatedAt,
        updatedBy,
      };
    } catch (error) {
      console.error('❌ [PlanModeService] Failed to read plan mode state', error);
      return {
        mode: DEFAULT_MODE,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };
    }
  }

  writeState(state) {
    const payload = {
      mode: normalizeMode(state.mode) || DEFAULT_MODE,
      updatedAt: resolveTimestamp(state.updatedAt),
      updatedBy: typeof state.updatedBy === 'string' && state.updatedBy.trim()
        ? state.updatedBy.trim()
        : null,
    };

    fs.writeFileSync(this.storagePath, JSON.stringify(payload, null, 2));
    return payload;
  }

  updateState(input) {
    const mode = normalizeMode(input?.mode || input?.planMode || input?.value);
    if (!mode) {
      throw new Error('INVALID_MODE');
    }

    const updatedAt = resolveTimestamp(input?.updatedAt || input?.updated_at || input?.timestamp);
    const updatedByRaw = input?.updatedBy ?? input?.updated_by ?? input?.actor ?? null;
    const updatedBy = typeof updatedByRaw === 'string' && updatedByRaw.trim() ? updatedByRaw.trim() : null;

    const payload = {
      mode,
      updatedAt,
      updatedBy,
    };

    return this.writeState(payload);
  }
}

module.exports = new PlanModeService();
