'use strict';

/**
 * JSON Schema validation for models.config.json
 */

// Simple schema definition for model configuration
const MODEL_SCHEMA = {
  type: 'object',
  properties: {
    models: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 },
          label: { type: 'string', minLength: 1 },
          category: { 
            type: 'string', 
            enum: ['small', 'large'] 
          },
          enabled: { type: 'boolean' }
        },
        required: ['id', 'label', 'category', 'enabled'],
        additionalProperties: false
      }
    }
  },
  required: ['models'],
  additionalProperties: false
};

/**
 * Validate models configuration against schema
 * @param {Object} config - Parsed JSON configuration
 * @throws {Error} - CONFIG_SCHEMA_ERROR if validation fails
 */
function validateModelsConfig(config) {
  if (!config || typeof config !== 'object') {
    const error = new Error('Config must be an object');
    error.code = 'CONFIG_SCHEMA_ERROR';
    throw error;
  }

  if (!Array.isArray(config.models)) {
    const error = new Error('Config must have "models" array property');
    error.code = 'CONFIG_SCHEMA_ERROR';
    throw error;
  }

  for (let i = 0; i < config.models.length; i++) {
    const model = config.models[i];
    
    if (!model || typeof model !== 'object') {
      const error = new Error(`Model at index ${i} must be an object`);
      error.code = 'CONFIG_SCHEMA_ERROR';
      throw error;
    }

    // Check required fields
    const required = ['id', 'label', 'category', 'enabled'];
    for (const field of required) {
      if (!(field in model)) {
        const error = new Error(`Model at index ${i} missing required field: ${field}`);
        error.code = 'CONFIG_SCHEMA_ERROR';
        throw error;
      }
    }

    // Validate field types
    if (typeof model.id !== 'string' || model.id.length === 0) {
      const error = new Error(`Model at index ${i}: "id" must be a non-empty string`);
      error.code = 'CONFIG_SCHEMA_ERROR';
      throw error;
    }

    if (typeof model.label !== 'string' || model.label.length === 0) {
      const error = new Error(`Model at index ${i}: "label" must be a non-empty string`);
      error.code = 'CONFIG_SCHEMA_ERROR';
      throw error;
    }

    if (!['small', 'large'].includes(model.category)) {
      const error = new Error(`Model at index ${i}: "category" must be "small" or "large"`);
      error.code = 'CONFIG_SCHEMA_ERROR';
      throw error;
    }

    if (typeof model.enabled !== 'boolean') {
      const error = new Error(`Model at index ${i}: "enabled" must be a boolean`);
      error.code = 'CONFIG_SCHEMA_ERROR';
      throw error;
    }
  }

  return true;
}

module.exports = {
  MODEL_SCHEMA,
  validateModelsConfig
};