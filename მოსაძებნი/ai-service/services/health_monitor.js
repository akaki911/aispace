
class AIHealthMonitor {
  constructor() {
    this.metrics = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastHealthCheck: null,
      services: {
        groq: { status: 'unknown', lastCheck: null },
        memory: { status: 'unknown', lastCheck: null },
        proxy: { status: 'unknown', lastCheck: null }
      }
    };
    
    this.alerts = [];
    this.startTime = Date.now();
    this.healthCheckInterval = 30000; // 30 seconds
    
    this.startHealthMonitoring();
    console.log('🏥 AI Health Monitor initialized');
  }

  // Record request metrics
  recordRequest(success, responseTime) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const totalSuccessful = this.metrics.successfulRequests;
    this.metrics.averageResponseTime = ((currentAvg * (totalSuccessful - 1)) + responseTime) / totalSuccessful;
  }

  // Check service health
  async checkServiceHealth() {
    const now = Date.now();
    this.metrics.uptime = now - this.startTime;
    this.metrics.lastHealthCheck = new Date().toISOString();
    
    // Check Groq API
    try {
      const groqHealth = await this.checkGroqHealth();
      this.metrics.services.groq = {
        status: groqHealth ? 'healthy' : 'unhealthy',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.services.groq = {
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
    
    // Check Memory System
    try {
      const memoryHealth = await this.checkMemoryHealth();
      this.metrics.services.memory = {
        status: memoryHealth ? 'healthy' : 'unhealthy',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.services.memory = {
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
    
    // Check Backend Proxy
    try {
      const proxyHealth = await this.checkProxyHealth();
      this.metrics.services.proxy = {
        status: proxyHealth ? 'healthy' : 'unhealthy',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.services.proxy = {
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
    
    // Generate alerts if needed
    this.generateHealthAlerts();
    
    console.log('🏥 Health check completed:', this.getHealthSummary());
  }

  // Check Groq API health
  async checkGroqHealth() {
    try {
      const groqService = require('./groq_service');
      // Simple test request
      const response = await groqService.testConnection();
      return response && response.status === 'ok';
    } catch (error) {
      console.error('❌ Groq health check failed:', error.message);
      return false;
    }
  }

  // Check memory system health
  async checkMemoryHealth() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const testPath = path.join(__dirname, '../memory_data');
      await fs.access(testPath);
      
      // Test read/write
      const testFile = path.join(testPath, 'health_test.json');
      await fs.writeFile(testFile, JSON.stringify({ test: true }));
      await fs.unlink(testFile);
      
      return true;
    } catch (error) {
      console.error('❌ Memory health check failed:', error.message);
      return false;
    }
  }

  // Check backend proxy health
  async checkProxyHealth() {
    try {
      const fetch = (await import('node-fetch')).default;
      // Try multiple backend ports for resilience
      const ports = [5003, 5002];
      
      for (const port of ports) {
        try {
          const response = await fetch(`http://0.0.0.0:${port}/api/health`, {
            timeout: 3000
          });
          if (response.ok) {
            console.log(`✅ Backend health check success on port ${port}`);
            return true;
          }
        } catch (portError) {
          console.warn(`⚠️ Port ${port} check failed:`, portError.message);
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Proxy health check failed:', error.message);
      return false;
    }
  }

  // Generate health alerts
  generateHealthAlerts() {
    const now = Date.now();
    const errorRate = this.getErrorRate();
    
    // High error rate alert
    if (errorRate > 0.1) { // 10% error rate
      this.addAlert('HIGH_ERROR_RATE', `Error rate: ${(errorRate * 100).toFixed(2)}%`, 'warning');
    }
    
    // Service down alerts
    Object.entries(this.metrics.services).forEach(([service, status]) => {
      if (status.status === 'error' || status.status === 'unhealthy') {
        this.addAlert('SERVICE_DOWN', `${service} service is ${status.status}`, 'critical');
      }
    });
    
    // Slow response time
    if (this.metrics.averageResponseTime > 5000) { // 5 seconds
      this.addAlert('SLOW_RESPONSE', `Average response time: ${this.metrics.averageResponseTime}ms`, 'warning');
    }
  }

  // Add alert
  addAlert(type, message, severity) {
    const alert = {
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      id: `${type}_${Date.now()}`
    };
    
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    console.log(`🚨 Health Alert [${severity}]: ${message}`);
  }

  // Get error rate
  getErrorRate() {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.failedRequests / this.metrics.totalRequests;
  }

  // Get health summary
  getHealthSummary() {
    return {
      overall: this.getOverallHealth(),
      uptime: this.metrics.uptime,
      errorRate: this.getErrorRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      services: this.metrics.services,
      activeAlerts: this.alerts.filter(alert => 
        Date.now() - new Date(alert.timestamp).getTime() < 300000 // Last 5 minutes
      ).length
    };
  }

  // Get overall health status
  getOverallHealth() {
    const errorRate = this.getErrorRate();
    const servicesHealthy = Object.values(this.metrics.services)
      .filter(service => service.status === 'healthy').length;
    const totalServices = Object.keys(this.metrics.services).length;
    
    if (errorRate > 0.2 || servicesHealthy < totalServices * 0.5) {
      return 'critical';
    } else if (errorRate > 0.1 || servicesHealthy < totalServices * 0.8) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  // Start health monitoring
  startHealthMonitoring() {
    setInterval(() => {
      this.checkServiceHealth();
    }, this.healthCheckInterval);
    
    console.log(`⏰ Health monitoring started with ${this.healthCheckInterval}ms interval`);
  }

  // Get detailed health report
  getDetailedHealthReport() {
    return {
      timestamp: new Date().toISOString(),
      summary: this.getHealthSummary(),
      metrics: this.metrics,
      recentAlerts: this.alerts.slice(-20),
      recommendations: this.generateRecommendations()
    };
  }

  // Generate health recommendations
  generateRecommendations() {
    const recommendations = [];
    const errorRate = this.getErrorRate();
    
    if (errorRate > 0.1) {
      recommendations.push('შეამცირეთ შეცდომების რაოდენობა API endpoints-ის ოპტიმიზაციით');
    }
    
    if (this.metrics.averageResponseTime > 3000) {
      recommendations.push('გააუმჯობესეთ response time caching-ისა და connection pooling-ის გამოყენებით');
    }
    
    Object.entries(this.metrics.services).forEach(([service, status]) => {
      if (status.status !== 'healthy') {
        recommendations.push(`შეამოწმეთ ${service} სერვისის კონფიგურაცია და კავშირი`);
      }
    });
    
    return recommendations;
  }
}

module.exports = new AIHealthMonitor();
