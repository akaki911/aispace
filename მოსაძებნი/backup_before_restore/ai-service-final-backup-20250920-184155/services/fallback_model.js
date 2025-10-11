// SOL-203: Fallback chain for model resilience
const axios = require('axios');

class FallbackModelManager {
  constructor() {
    this.models = [
      {
        name: 'primary',
        service: 'groq',
        model: 'llama-3.1-8b-instant',
        priority: 1,
        timeout: 30000
      },
      {
        name: 'secondary',
        service: 'groq',
        model: 'llama-3.3-70b-versatile',
        priority: 2,
        timeout: 45000
      }
    ];
    
    this.stats = {
      totalRequests: 0,
      fallbackUsed: 0,
      lastFallbackTime: null
    };
    
    console.log('🔗 SOL-203: Fallback Model Manager initialized');
  }

  // SOL-203: Non-blocking fallback chain
  async askWithFallback(messages, options = {}) {
    const {
      enableStreaming = false,
      maxRetries = 2,
      onFallback = null
    } = options;

    this.stats.totalRequests++;
    
    // Try primary model first
    const primaryModel = this.models.find(m => m.priority === 1);
    try {
      console.log(`🎯 SOL-203: Trying primary model: ${primaryModel.model}`);
      
      const groqService = require('./groq_service');
      const response = await groqService.askGroq(messages, enableStreaming);
      
      return {
        ...response,
        modelUsed: primaryModel.model,
        fallbackUsed: false
      };
    } catch (primaryError) {
      console.warn(`⚠️ Primary model failed: ${primaryError.message}`);
      
      // Try fallback models
      for (const fallbackModel of this.models.filter(m => m.priority > 1)) {
        try {
          console.log(`🔄 SOL-203: Trying fallback model: ${fallbackModel.model}`);
          
          this.stats.fallbackUsed++;
          this.stats.lastFallbackTime = new Date().toISOString();
          
          // Call onFallback callback if provided
          if (onFallback) {
            onFallback(fallbackModel.model, primaryError.message);
          }
          
          const groqService = require('./groq_service');
          const response = await groqService.askGroq(messages, enableStreaming);
          
          return {
            ...response,
            modelUsed: fallbackModel.model,
            fallbackUsed: true,
            primaryError: primaryError.message
          };
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback model ${fallbackModel.model} failed: ${fallbackError.message}`);
          continue;
        }
      }
      
      // All models failed - provide graceful degradation
      console.error('💥 All AI models failed, providing static fallback response');
      
      return {
        content: "ბოდიში, AI სერვისი დროებით მიუწვდომელია. გთხოვთ, რამდენიმე წუთში კვლავ სცადოთ. თუ პრობლემა მეორდება, დაუკავშირდით ადმინისტრაციას.",
        modelUsed: 'fallback_static',
        fallbackUsed: true,
        primaryError: primaryError.message,
        isStaticFallback: true,
        suggestions: [
          "შეამოწმეთ ინტერნეტ კავშირი",
          "დაელოდეთ რამდენიმე წუთს და სცადეთ კვლავ",
          "თუ პრობლემა მეორდება, გაგვიზიარეთ დეტალები"
        ]
      };
    }
  }

  // Get fallback statistics
  getStats() {
    return {
      ...this.stats,
      fallbackRate: this.stats.totalRequests > 0 ? 
        (this.stats.fallbackUsed / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      availableModels: this.models.map(m => ({
        name: m.name,
        model: m.model,
        priority: m.priority
      }))
    };
  }

  // Health check for all models
  async checkModelsHealth() {
    const healthResults = [];
    
    for (const model of this.models) {
      try {
        const groqService = require('./groq_service');
        const testResponse = await groqService.checkGroqHealth();
        
        healthResults.push({
          model: model.model,
          status: testResponse.available ? 'healthy' : 'unavailable',
          latency: testResponse.latency || null,
          priority: model.priority
        });
      } catch (error) {
        healthResults.push({
          model: model.model,
          status: 'error',
          error: error.message,
          priority: model.priority
        });
      }
    }
    
    return healthResults;
  }
}

module.exports = new FallbackModelManager();