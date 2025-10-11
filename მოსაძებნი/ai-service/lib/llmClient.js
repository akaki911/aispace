'use strict';

const groqService = require('../services/groq_service');
const { getModelById } = require('../services/modelConfigService');

// Timeouts for different model categories
const TIMEOUTS = {
  small: 8000,  // 8 seconds for small models
  large: 20000  // 20 seconds for large models
};

// Custom error types
class LLMError extends Error {
  constructor(code, detail, originalError = null) {
    super(`LLM ${code}: ${detail}`);
    this.name = 'LLMError';
    this.code = code;
    this.detail = detail;
    this.originalError = originalError;
  }
}

/**
 * Call small model API with timeout and error handling
 * @param {Array} messages - Chat messages array
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} - Response with content, policy, model info
 */
async function callSmallModelAPI(messages, opts = {}) {
  const startTime = Date.now();
  const requestId = opts.requestId || Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`🏃 [LLM CLIENT] Small model call started (ID: ${requestId})`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new LLMError('TIMEOUT', `Small model timeout after ${TIMEOUTS.small}ms`));
      }, TIMEOUTS.small);
    });
    
    // Create the API call promise
    const apiPromise = groqService.askGroq(messages, false);
    
    // Race between timeout and API call
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [LLM CLIENT] Small model success (${duration}ms, ID: ${requestId})`);
    
    // Get model info for response
    const modelInfo = await getModelById('llama3.1-8b-instant');
    
    return {
      content: response?.content || response,
      policy: opts.policy || 'SIMPLE_QA',
      model: 'small',
      modelLabel: modelInfo?.label || 'LLaMA 3.1 8B Instant',
      requestId,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [LLM CLIENT] Small model failed (${duration}ms, ID: ${requestId}):`, error);
    
    if (error instanceof LLMError) {
      throw error;
    }
    
    // Convert other errors to LLM errors
    throw new LLMError('API_ERROR', 'Small model API call failed', error);
  }
}

/**
 * Call large model API with timeout and error handling  
 * @param {Array} messages - Chat messages array
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} - Response with content, policy, model info
 */
async function callLargeModelAPI(messages, opts = {}) {
  const startTime = Date.now();
  const requestId = opts.requestId || Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`🚀 [LLM CLIENT] Large model call started (ID: ${requestId})`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new LLMError('TIMEOUT', `Large model timeout after ${TIMEOUTS.large}ms`));
      }, TIMEOUTS.large);
    });
    
    // Create the API call promise  
    const apiPromise = groqService.askGroq(messages, false);
    
    // Race between timeout and API call
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [LLM CLIENT] Large model success (${duration}ms, ID: ${requestId})`);
    
    // Get model info for response
    const modelInfo = await getModelById('llama3.3-70b-versatile');
    
    return {
      content: response?.content || response,
      policy: opts.policy || 'CODE_COMPLEX',
      model: 'large', 
      modelLabel: modelInfo?.label || 'LLaMA 3.3 70B Versatile',
      requestId,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [LLM CLIENT] Large model failed (${duration}ms, ID: ${requestId}):`, error);
    
    if (error instanceof LLMError) {
      throw error;
    }
    
    // Convert other errors to LLM errors
    throw new LLMError('API_ERROR', 'Large model API call failed', error);
  }
}

/**
 * Main LLM call with fallback strategy
 * @param {Array} messages - Chat messages array
 * @param {string} preferredModel - 'small' or 'large' 
 * @param {Object} opts - Additional options
 * @returns {Promise<Object>} - Response or fallback error
 */
async function callLLMWithFallback(messages, preferredModel, opts = {}) {
  const requestId = opts.requestId || Math.random().toString(36).substr(2, 9);
  
  console.log(`🎯 [LLM CLIENT] Starting LLM call with fallback (${preferredModel} preferred, ID: ${requestId})`);
  
  try {
    // Try preferred model first
    if (preferredModel === 'large') {
      return await callLargeModelAPI(messages, { ...opts, requestId });
    } else {
      return await callSmallModelAPI(messages, { ...opts, requestId });
    }
    
  } catch (error) {
    console.log(`⚠️ [LLM CLIENT] Primary model (${preferredModel}) failed, attempting fallback (ID: ${requestId})`);
    
    // If large model failed, try small model as fallback
    if (preferredModel === 'large') {
      try {
        const fallbackResult = await callSmallModelAPI(messages, { 
          ...opts, 
          requestId,
          policy: opts.policy || 'FALLBACK'
        });
        
        console.log(`🔄 [LLM CLIENT] Fallback to small model successful (ID: ${requestId})`);
        return {
          ...fallbackResult,
          isFallback: true,
          originalError: error.code
        };
        
      } catch (fallbackError) {
        console.error(`💥 [LLM CLIENT] Both large and small models failed (ID: ${requestId})`);
        return createErrorResponse(requestId, [error, fallbackError]);
      }
    } else {
      // Small model failed initially
      console.error(`💥 [LLM CLIENT] Small model failed, no fallback available (ID: ${requestId})`);
      return createErrorResponse(requestId, [error]);
    }
  }
}

/**
 * Create standardized error response
 * @param {string} requestId - Request identifier
 * @param {Array} errors - Array of errors that occurred
 * @returns {Object} - Standardized error response
 */
function createErrorResponse(requestId, errors = []) {
  return {
    content: "ბოდიში, მოხდა ტექნიკური შეცდომა. გთხოვთ, სცადოთ მოგვიანებით.",
    policy: 'ERROR',
    model: 'none',
    modelLabel: 'System Error',
    requestId,
    isError: true,
    errors: errors.map(err => ({
      code: err.code || 'UNKNOWN',
      detail: err.detail || err.message
    }))
  };
}

module.exports = {
  callSmallModelAPI,
  callLargeModelAPI, 
  callLLMWithFallback,
  LLMError,
  TIMEOUTS
};