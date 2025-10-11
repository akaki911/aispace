/**
 * Input Validation Middleware for Replit Assistant API
 * SOL-211 Security Hardening
 * 
 * Provides comprehensive input sanitization and validation
 */

const path = require('path');
const fs = require('fs');

/**
 * Lightweight schema validation (alternative to zod/joi)
 */
class SimpleValidator {
  static string(value, options = {}) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Must be a string' };
    }
    
    if (options.minLength && value.length < options.minLength) {
      return { valid: false, error: `Minimum length is ${options.minLength}` };
    }
    
    if (options.maxLength && value.length > options.maxLength) {
      return { valid: false, error: `Maximum length is ${options.maxLength}` };
    }
    
    if (options.pattern && !options.pattern.test(value)) {
      return { valid: false, error: 'Invalid format' };
    }
    
    return { valid: true, value: value.trim() };
  }

  static object(value, schema) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, error: 'Must be an object' };
    }

    const result = {};
    const errors = {};

    for (const [key, validator] of Object.entries(schema)) {
      const fieldValue = value[key];
      const validation = validator(fieldValue);
      
      if (!validation.valid) {
        errors[key] = validation.error;
      } else {
        result[key] = validation.value;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, value: result };
  }

  static optional(validator) {
    return (value) => {
      if (value === undefined || value === null) {
        return { valid: true, value: undefined };
      }
      return validator(value);
    };
  }

  static enum(allowedValues) {
    return (value) => {
      if (!allowedValues.includes(value)) {
        return { valid: false, error: `Must be one of: ${allowedValues.join(', ')}` };
      }
      return { valid: true, value };
    };
  }
}

/**
 * Validate tool name against allowlist
 */
function validateToolName(toolName, toolRegistry) {
  try {
    // Get available tools from registry
    const availableTools = toolRegistry.getAvailableTools();
    const toolNames = availableTools.map(tool => tool.name);
    
    if (!toolNames.includes(toolName)) {
      return {
        valid: false,
        error: `Unknown tool: ${toolName}`,
        availableTools: toolNames
      };
    }
    
    return { valid: true, value: toolName };
  } catch (error) {
    return {
      valid: false,
      error: 'Tool validation failed',
      details: error.message
    };
  }
}

/**
 * Sanitize and validate file paths
 */
function validateFilePath(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'File path is required' };
    }

    // Normalize path to prevent traversal attacks
    const normalizedPath = path.normalize(filePath);
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      return { valid: false, error: 'Path traversal not allowed' };
    }

    // Ensure path is within project root
    const projectRoot = process.cwd();
    let absolutePath;
    
    try {
      absolutePath = path.resolve(projectRoot, normalizedPath);
    } catch (error) {
      return { valid: false, error: 'Invalid path format' };
    }

    if (!absolutePath.startsWith(projectRoot)) {
      return { valid: false, error: 'Path must be within project root' };
    }

    // Check for forbidden directories
    const forbiddenDirs = ['node_modules', '.git', '.env', '.assistant_backups'];
    const relativePath = path.relative(projectRoot, absolutePath);
    
    for (const forbiddenDir of forbiddenDirs) {
      if (relativePath.startsWith(forbiddenDir) || relativePath.includes(`/${forbiddenDir}/`)) {
        return { valid: false, error: `Access to ${forbiddenDir} is forbidden` };
      }
    }

    // Check for forbidden file extensions
    const forbiddenExtensions = ['.env', '.key', '.pem', '.secret', '.credentials'];
    const extension = path.extname(absolutePath).toLowerCase();
    
    if (forbiddenExtensions.includes(extension)) {
      return { valid: false, error: `File type ${extension} is forbidden` };
    }

    return { 
      valid: true, 
      value: {
        original: filePath,
        normalized: normalizedPath,
        absolute: absolutePath,
        relative: relativePath
      }
    };
  } catch (error) {
    return { valid: false, error: 'Path validation failed', details: error.message };
  }
}

/**
 * Request timeout middleware
 */
function requestTimeout(timeoutMs = 10000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        console.warn(`⚠️ [TIMEOUT] Request timeout after ${timeoutMs}ms: ${req.method} ${req.path}`);
        res.status(408).json({
          error: 'Request Timeout',
          message: `Request exceeded ${timeoutMs}ms timeout`,
          timeout: timeoutMs,
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Payload size validation middleware
 */
function validatePayloadSize(maxSizeBytes = 1024 * 1024) { // 1MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']) || 0;
    
    if (contentLength > maxSizeBytes) {
      console.warn(`⚠️ [PAYLOAD_SIZE] Request too large: ${contentLength} bytes (max: ${maxSizeBytes})`);
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size ${contentLength} bytes exceeds limit of ${maxSizeBytes} bytes`,
        maxSize: maxSizeBytes,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * Validate Replit Assistant request
 */
function validateAssistantRequest(req, res, next) {
  try {
    const schema = {
      userRequest: (value) => SimpleValidator.string(value, { minLength: 1, maxLength: 10000 }),
      context: SimpleValidator.optional((value) => {
        if (typeof value !== 'object') {
          return { valid: false, error: 'Context must be an object' };
        }
        return { valid: true, value };
      }),
      options: SimpleValidator.optional((value) => {
        if (typeof value !== 'object') {
          return { valid: false, error: 'Options must be an object' };
        }
        return { valid: true, value };
      })
    };

    const validation = SimpleValidator.object(req.body, schema);
    
    if (!validation.valid) {
      console.log('❌ [VALIDATION] Request validation failed:', validation.errors);
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request format',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }

    // Set validated data
    req.validatedBody = validation.value;
    next();

  } catch (error) {
    console.error('❌ [VALIDATION] Validation middleware error:', error.message);
    res.status(500).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Validate tool execution request
 */
function validateToolRequest(toolRegistry) {
  return (req, res, next) => {
    try {
      const { toolName } = req.params;
      const { inputs, options = {} } = req.body;

      // Validate tool name
      const toolValidation = validateToolName(toolName, toolRegistry);
      if (!toolValidation.valid) {
        console.log('❌ [VALIDATION] Invalid tool:', toolValidation.error);
        return res.status(400).json({
          error: 'Invalid Tool',
          message: toolValidation.error,
          availableTools: toolValidation.availableTools,
          timestamp: new Date().toISOString()
        });
      }

      // Validate inputs object
      if (inputs !== undefined && typeof inputs !== 'object') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Inputs must be an object',
          timestamp: new Date().toISOString()
        });
      }

      // Validate file paths if present in inputs
      if (inputs && typeof inputs === 'object') {
        for (const [key, value] of Object.entries(inputs)) {
          if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
            if (typeof value === 'string') {
              const pathValidation = validateFilePath(value);
              if (!pathValidation.valid) {
                return res.status(400).json({
                  error: 'Invalid File Path',
                  message: pathValidation.error,
                  field: key,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
      }

      // Set validated data
      req.validatedParams = { toolName };
      req.validatedBody = { inputs: inputs || {}, options };
      
      next();

    } catch (error) {
      console.error('❌ [VALIDATION] Tool validation error:', error.message);
      res.status(500).json({
        error: 'Validation Error',
        message: 'Tool validation failed',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Content type validation
 */
function validateContentType(req, res, next) {
  const contentType = req.headers['content-type'];
  
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content Type',
        message: 'Content-Type must be application/json',
        received: contentType,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
}

module.exports = {
  SimpleValidator,
  validateToolName,
  validateFilePath,
  requestTimeout,
  validatePayloadSize,
  validateAssistantRequest,
  validateToolRequest,
  validateContentType
};