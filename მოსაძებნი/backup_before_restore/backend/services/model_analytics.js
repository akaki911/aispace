
class ModelAnalytics {
  constructor() {
    this.metrics = {
      'llama3-8b-8192': {
        requests: 0,
        averageLatency: 0,
        errors: 0,
        totalTokens: 0
      },
      'llama3-70b-8192': {
        requests: 0,
        averageLatency: 0,
        errors: 0,
        totalTokens: 0
      }
    };
  }

  recordRequest(model, latency, success = true, tokens = 0) {
    if (!this.metrics[model]) return;
    
    this.metrics[model].requests++;
    this.metrics[model].totalTokens += tokens;
    
    if (success) {
      const currentAvg = this.metrics[model].averageLatency;
      const requests = this.metrics[model].requests;
      this.metrics[model].averageLatency = 
        (currentAvg * (requests - 1) + latency) / requests;
    } else {
      this.metrics[model].errors++;
    }

    // Log performance comparison
    const small = this.metrics['llama3-8b-8192'];
    const large = this.metrics['llama3-70b-8192'];
    
    if ((small.requests + large.requests) % 10 === 0) {
      console.log('📊 Model Performance Analytics:', {
        '8B_Model': {
          requests: small.requests,
          avgLatency: `${Math.round(small.averageLatency)}ms`,
          errorRate: `${((small.errors / small.requests) * 100 || 0).toFixed(1)}%`,
          tokensPerRequest: Math.round(small.totalTokens / small.requests || 0)
        },
        '70B_Model': {
          requests: large.requests,
          avgLatency: `${Math.round(large.averageLatency)}ms`,
          errorRate: `${((large.errors / large.requests) * 100 || 0).toFixed(1)}%`,
          tokensPerRequest: Math.round(large.totalTokens / large.requests || 0)
        },
        efficiency: {
          speedRatio: large.averageLatency > 0 ? 
            `${(large.averageLatency / small.averageLatency || 1).toFixed(1)}x slower` : 'N/A',
          modelDistribution: `${Math.round((small.requests / (small.requests + large.requests)) * 100 || 0)}% 8B / ${Math.round((large.requests / (small.requests + large.requests)) * 100 || 0)}% 70B`
        }
      });
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getEfficiencyReport() {
    const small = this.metrics['llama3-8b-8192'];
    const large = this.metrics['llama3-70b-8192'];
    const total = small.requests + large.requests;
    
    return {
      totalRequests: total,
      modelDistribution: {
        small: Math.round((small.requests / total) * 100 || 0),
        large: Math.round((large.requests / total) * 100 || 0)
      },
      averageLatencies: {
        small: Math.round(small.averageLatency),
        large: Math.round(large.averageLatency),
        speedImprovement: large.averageLatency > 0 ? 
          Math.round(((large.averageLatency - small.averageLatency) / large.averageLatency) * 100) : 0
      },
      errorRates: {
        small: ((small.errors / small.requests) * 100 || 0).toFixed(1),
        large: ((large.errors / large.requests) * 100 || 0).toFixed(1)
      }
    };
  }
}

module.exports = new ModelAnalytics();
