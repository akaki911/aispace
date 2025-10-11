'use strict';

const path = require('path');
const fs = require('fs/promises');

const CONFIG_PATH = process.env.MODELS_CONFIG_PATH || path.resolve(__dirname, '..', 'models.config.json');

// მარტივი cache ფაილის mtime-ზე
let cache = {
  mtimeMs: 0,
  models: []
};

function normalizeCategory(cat) {
  return cat === 'large' ? 'large' : 'small';
}

function validateAndFilter(json) {
  if (!json || !Array.isArray(json.models)) {
    throw new Error('Invalid config: "models" array missing');
  }
  return json.models
    .filter(m => m && m.enabled === true)
    .map(m => ({
      id: String(m.id),
      label: String(m.label),
      category: normalizeCategory(m.category)
    }));
}

// Add helper to resolve config path with fallbacks
async function resolveConfigPath() {
  const paths = [
    CONFIG_PATH,
    path.resolve(process.cwd(), 'models.config.json'),
    path.resolve(__dirname, '../models.config.json'),
    path.resolve(__dirname, '../../models.config.json')
  ];

  for (const configPath of paths) {
    try {
      await fs.access(configPath, fs.constants.F_OK);
      console.log(`📍 [MODEL CONFIG] Using config: ${configPath}`);
      return configPath;
    } catch (error) {
      // Continue to next path
    }
  }
  
  throw new Error('models.config.json not found in any expected locations');
}

async function readEnabledModels() {
  try {
    const resolvedPath = await resolveConfigPath();
    const stat = await fs.stat(resolvedPath);
    if (cache.models.length && stat.mtimeMs === cache.mtimeMs) {
      return cache.models;
    }

    const raw = await fs.readFile(resolvedPath, 'utf8');
    const json = JSON.parse(raw);
    
    // Validate schema before filtering
    const { validateModelsConfig } = require('./modelSchema');
    validateModelsConfig(json);
    
    const enabled = validateAndFilter(json);

    cache = {
      mtimeMs: stat.mtimeMs,
      models: enabled
    };

    console.log('📄 [MODEL CONFIG] Loaded models:', enabled.map(m => `${m.label} (${m.category})`));
    return enabled;
  } catch (error) {
    console.error('❌ [MODEL CONFIG] Failed to read models config:', error);
    // Fallback to hardcoded models if config file fails
    return [
      {
        id: 'llama3.1-8b-instant',
        label: 'LLaMA 3.1 8B Instant',
        category: 'small'
      },
      {
        id: 'llama3.3-70b-versatile', 
        label: 'LLaMA 3.3 70B Versatile',
        category: 'large'
      }
    ];
  }
}

// Get model info by ID
async function getModelById(modelId) {
  const models = await readEnabledModels();
  return models.find(m => m.id === modelId);
}

module.exports = {
  readEnabledModels,
  getModelById,
  CONFIG_PATH
};