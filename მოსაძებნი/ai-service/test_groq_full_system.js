
const { askGroq, checkGroqHealth } = require('./services/groq_service');
const connectionManager = require('./services/groq_connection_manager');
const axios = require('axios');

// Comprehensive Groq System Test Suite
class GroqSystemTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    
    this.testResults.push({
      timestamp,
      type,
      message,
      time: Date.now() - this.startTime
    });
  }

  async runFullSystemTest() {
    console.log('🚀 Starting Comprehensive Groq System Test...\n');
    
    try {
      // Test 1: Environment Variables
      await this.testEnvironmentSetup();
      
      // Test 2: Basic API Connection
      await this.testBasicConnection();
      
      // Test 3: Connection Manager
      await this.testConnectionManager();
      
      // Test 4: Model Selection Logic
      await this.testModelSelection();
      
      // Test 5: Streaming Functionality
      await this.testStreamingFeatures();
      
      // Test 6: Error Handling
      await this.testErrorHandling();
      
      // Test 7: Performance Metrics
      await this.testPerformanceMetrics();
      
      // Test 8: Georgian Language Processing
      await this.testGeorgianLanguage();
      
      // Generate Final Report
      this.generateReport();
      
    } catch (error) {
      this.log(`Critical system error: ${error.message}`, 'error');
      this.errors.push(error);
    }
  }

  async testEnvironmentSetup() {
    this.log('Testing Environment Setup...', 'test');
    
    // Check API Key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.errors.push(new Error('GROQ_API_KEY not found in environment'));
      this.log('❌ GROQ_API_KEY missing', 'error');
      return false;
    }
    
    if (apiKey.length < 50) {
      this.errors.push(new Error('GROQ_API_KEY appears to be invalid (too short)'));
      this.log('❌ GROQ_API_KEY seems invalid', 'error');
      return false;
    }
    
    this.log('✅ Environment setup OK', 'success');
    return true;
  }

  async testBasicConnection() {
    this.log('Testing Basic Groq Connection...', 'test');
    
    try {
      const healthResult = await checkGroqHealth();
      
      if (healthResult.available) {
        this.log('✅ Basic connection successful', 'success');
        this.log(`Response time: ${healthResult.latency}ms`, 'info');
        return true;
      } else {
        this.errors.push(new Error(`Health check failed: ${healthResult.error}`));
        this.log('❌ Basic connection failed', 'error');
        return false;
      }
    } catch (error) {
      this.errors.push(error);
      this.log(`❌ Connection test error: ${error.message}`, 'error');
      return false;
    }
  }

  async testConnectionManager() {
    this.log('Testing Connection Manager...', 'test');
    
    try {
      // Test warm connections
      const poolStats = connectionManager.getPoolStats();
      this.log(`Connection pool stats: ${JSON.stringify(poolStats)}`, 'info');
      
      // Test optimal connection retrieval
      const connection = await connectionManager.getOptimalConnection();
      if (connection) {
        this.log('✅ Connection manager working', 'success');
        return true;
      } else {
        this.errors.push(new Error('Failed to get optimal connection'));
        this.log('❌ Connection manager failed', 'error');
        return false;
      }
    } catch (error) {
      this.errors.push(error);
      this.log(`❌ Connection manager error: ${error.message}`, 'error');
      return false;
    }
  }

  async testModelSelection() {
    this.log('Testing Model Selection Logic...', 'test');
    
    const testCases = [
      {
        message: 'test',
        expectedModel: 'llama3-8b-8192',
        description: 'Short message should use 8B model'
      },
      {
        message: 'სრული სისტემის ანალიზი და კოდის არქიტექტურის დეტალური შესწავლა ყველა მოდულისთვის'.repeat(3),
        expectedModel: 'llama3-70b-8192',
        description: 'Complex analysis should use 70B model'
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await askGroq([{
          role: 'user',
          content: testCase.message
        }]);

        if (response.model === testCase.expectedModel) {
          this.log(`✅ ${testCase.description}`, 'success');
        } else {
          this.log(`⚠️ Expected ${testCase.expectedModel}, got ${response.model}`, 'warning');
        }
      } catch (error) {
        this.errors.push(error);
        this.log(`❌ Model selection test failed: ${error.message}`, 'error');
      }
    }
  }

  async testStreamingFeatures() {
    this.log('Testing Streaming Features...', 'test');
    
    try {
      const response = await askGroq([{
        role: 'user',
        content: 'გამარჯობა, ეს ტესტია streaming-ისთვის'
      }], true);

      if (response && response.data) {
        this.log('✅ Streaming response received', 'success');
        return true;
      } else {
        this.log('⚠️ Non-streaming response received', 'warning');
        return false;
      }
    } catch (error) {
      this.errors.push(error);
      this.log(`❌ Streaming test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testErrorHandling() {
    this.log('Testing Error Handling...', 'test');
    
    // Test with invalid message
    try {
      await askGroq([{
        role: 'user',
        content: ''
      }]);
      this.log('⚠️ Empty message should have been rejected', 'warning');
    } catch (error) {
      this.log('✅ Empty message properly rejected', 'success');
    }

    // Test with malformed messages
    try {
      await askGroq([]);
      this.log('⚠️ Empty messages array should have been rejected', 'warning');
    } catch (error) {
      this.log('✅ Empty messages array properly rejected', 'success');
    }
  }

  async testPerformanceMetrics() {
    this.log('Testing Performance Metrics...', 'test');
    
    const startTime = Date.now();
    
    try {
      await askGroq([{
        role: 'user',
        content: 'performance test'
      }]);
      
      const latency = Date.now() - startTime;
      this.log(`Response latency: ${latency}ms`, 'info');
      
      if (latency < 2000) {
        this.log('✅ Good performance (< 2s)', 'success');
      } else if (latency < 5000) {
        this.log('⚠️ Acceptable performance (2-5s)', 'warning');
      } else {
        this.log('❌ Poor performance (> 5s)', 'error');
      }
      
    } catch (error) {
      this.errors.push(error);
      this.log(`❌ Performance test failed: ${error.message}`, 'error');
    }
  }

  async testGeorgianLanguage() {
    this.log('Testing Georgian Language Processing...', 'test');
    
    const georgianTests = [
      'გამარჯობა, როგორ ხარ?',
      'რა ფუნქცია აქვს BookingService-ს?',
      'აგიხსენი, როგორ მუშაობს სისტემა'
    ];

    for (const georgianText of georgianTests) {
      try {
        const response = await askGroq([{
          role: 'user',
          content: georgianText
        }]);

        // Check if response contains Georgian characters
        const georgianChars = (response.content || response.choices?.[0]?.message?.content || '').match(/[ა-ჰ]/g);
        
        if (georgianChars && georgianChars.length > 0) {
          this.log(`✅ Georgian response for: ${georgianText.substring(0, 30)}...`, 'success');
        } else {
          this.log(`⚠️ Non-Georgian response for: ${georgianText.substring(0, 30)}...`, 'warning');
        }
        
      } catch (error) {
        this.errors.push(error);
        this.log(`❌ Georgian test failed: ${error.message}`, 'error');
      }
    }
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const successCount = this.testResults.filter(r => r.type === 'success').length;
    const errorCount = this.errors.length;
    const warningCount = this.testResults.filter(r => r.type === 'warning').length;

    console.log('\n' + '='.repeat(60));
    console.log('🔍 GROQ SYSTEM TEST REPORT');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Test Time: ${totalTime}ms`);
    console.log(`✅ Successful Tests: ${successCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
      });
    }

    if (this.errors.length === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Groq system is working correctly.');
    } else {
      console.log('\n🔧 SYSTEM NEEDS ATTENTION. Please review errors above.');
    }

    console.log('\n📊 Detailed Results:');
    this.testResults.forEach(result => {
      const icon = result.type === 'success' ? '✅' : 
                   result.type === 'error' ? '❌' : 
                   result.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${result.time}ms] ${result.message}`);
    });
  }
}

// Auto-run tests if executed directly
async function runTests() {
  const tester = new GroqSystemTester();
  await tester.runFullSystemTest();
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { GroqSystemTester, runTests };
