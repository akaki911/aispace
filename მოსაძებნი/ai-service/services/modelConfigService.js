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
    console.log('🔍 [MODEL CONFIG] Starting model configuration load...');
    
    // First try to resolve the config path
    let resolvedPath;
    try {
      resolvedPath = await resolveConfigPath();
      console.log('📍 [MODEL CONFIG] Using config file:', resolvedPath);
    } catch (pathError) {
      console.error('❌ [MODEL CONFIG] Config file not found, using fallback models');
      return getFallbackModels();
    }
    
    // Check cache first
    try {
      const stat = await fs.stat(resolvedPath);
      if (cache.models.length && stat.mtimeMs === cache.mtimeMs) {
        console.log('📄 [MODEL CONFIG] Using cached models:', cache.models.length);
        return cache.models;
      }
    } catch (statError) {
      console.warn('⚠️ [MODEL CONFIG] Cannot stat config file:', statError.message);
      return getFallbackModels();
    }

    // Try to read and parse config file
    console.log('📄 [MODEL CONFIG] Reading fresh configuration...');
    let raw, json;
    try {
      raw = await fs.readFile(resolvedPath, 'utf8');
      console.log('📄 [MODEL CONFIG] Config file read successfully, length:', raw.length);
    } catch (readError) {
      console.error('❌ [MODEL CONFIG] Failed to read config file:', readError.message);
      return getFallbackModels();
    }

    try {
      json = JSON.parse(raw);
      console.log('🔍 [MODEL CONFIG] JSON parsed successfully, keys:', Object.keys(json));
    } catch (parseError) {
      console.error('❌ [MODEL CONFIG] Failed to parse JSON:', parseError.message);
      return getFallbackModels();
    }
    
    // Validate schema before filtering
    try {
      const { validateModelsConfig } = require('./modelSchema');
      validateModelsConfig(json);
      console.log('✅ [MODEL CONFIG] Schema validation passed');
    } catch (schemaError) {
      console.warn('⚠️ [MODEL CONFIG] Schema validation failed:', schemaError.message);
      // Continue with basic validation
    }
    
    // Validate and filter models
    let enabled;
    try {
      enabled = validateAndFilter(json);
      console.log('🔍 [MODEL CONFIG] Enabled models after filtering:', enabled.length);
      
      if (enabled.length === 0) {
        console.warn('⚠️ [MODEL CONFIG] No enabled models found, using fallback');
        return getFallbackModels();
      }
    } catch (filterError) {
      console.error('❌ [MODEL CONFIG] Failed to filter models:', filterError.message);
      return getFallbackModels();
    }

    // Update cache
    try {
      const stat = await fs.stat(resolvedPath);
      cache = {
        mtimeMs: stat.mtimeMs,
        models: enabled
      };
    } catch (cacheError) {
      console.warn('⚠️ [MODEL CONFIG] Failed to update cache:', cacheError.message);
      // Continue without cache update
    }

    console.log('📄 [MODEL CONFIG] Successfully loaded models:');
    enabled.forEach(m => console.log(`  - ${m.label} (${m.category}) [${m.id}]`));
    
    return enabled;
  } catch (error) {
    console.error('❌ [MODEL CONFIG] Critical error loading models config:', error);
    console.error('❌ [MODEL CONFIG] Stack trace:', error.stack);
    return getFallbackModels();
  }
}

// Helper function for fallback models
function getFallbackModels() {
  const fallbackModels = [
    {
      id: 'llama-3.1-8b-instant',
      label: 'LLaMA 3.1 8B Instant',
      category: 'small'
    },
    {
      id: 'llama-3.3-70b-versatile', 
      label: 'LLaMA 3.3 70B Versatile',
      category: 'large'
    }
  ];
  
  console.log('🔄 [MODEL CONFIG] Using fallback models:', fallbackModels.length);
  cache.models = fallbackModels;
  return fallbackModels;
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