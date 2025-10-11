const axios = require('axios');
const fs = require('fs').promises;

// Enhanced comprehensive AI testing scenarios
const TEST_SCENARIOS = [
  {
    id: 'greeting_simple',
    category: 'basic',
    query: 'გამარჯობა',
    expectedKeywords: ['გამარჯობა', 'დახმარება', 'სერვისი'],
    complexity: 'low',
    expectedResponseTime: 3000
  },
  {
    id: 'platform_overview',
    category: 'platform',
    query: 'მომიყევი Bakhmaro Booking-ის ძირითადი ფუნქციები',
    expectedKeywords: ['კოტეჯები', 'სასტუმროები', 'ავტომობილები', 'ჯავშანი', 'ბუკინგი'],
    complexity: 'medium',
    expectedResponseTime: 8000
  },
  {
    id: 'technical_deep_dive',
    category: 'technical',
    query: 'როგორ მუშაობს სეზონური ფასების სისტემა კოდის დონეზე?',
    expectedKeywords: ['seasonPrice', 'PriceTag', 'Firebase', 'კომპონენტი'],
    complexity: 'high',
    expectedResponseTime: 12000
  },
  {
    id: 'booking_process',
    category: 'process',
    query: 'ნაბიჯ-ნაბიჯ აღწერე კოტეჯის ჯავშნის პროცესი',
    expectedKeywords: ['ძებნა', 'კალენდარი', 'გადახდა', 'დასტური'],
    complexity: 'medium',
    expectedResponseTime: 10000
  },
  {
    id: 'error_handling',
    category: 'technical',
    query: 'როგორ ხდება შეცდომების მართვა აპლიკაციაში?',
    expectedKeywords: ['ErrorBoundary', 'try-catch', 'ლოგირება'],
    complexity: 'high',
    expectedResponseTime: 9000
  }
];

const BASE_URL = 'http://localhost:5001';
const AI_ENDPOINT = `${BASE_URL}/api/ai/chat`;

class ComprehensiveAITester {
  constructor() {
    this.concurrencyLimit = 3; // Parallel testing limit
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.categories = new Map();
  }

  // Configure testing parameters
  configure(options = {}) {
    if (options.concurrencyLimit) this.concurrencyLimit = options.concurrencyLimit;
    if (options.baseUrl) this.baseUrl = options.baseUrl;
    console.log(`🔧 Tester configured with concurrency limit: ${this.concurrencyLimit}`);
  }

  // Enhanced scoring system
  calculateScore(scenario, response, responseTime, error = null) {
    if (error) {
      return {
        totalScore: 0,
        maxScore: 100,
        breakdown: { error: error.message },
        passed: false
      };
    }

    const scores = {
      hasResponse: response ? 20 : 0,
      responseLength: this.scoreResponseLength(response, scenario.complexity),
      keywordMatch: this.scoreKeywordMatch(response, scenario.expectedKeywords),
      responseTime: this.scoreResponseTime(responseTime, scenario.expectedResponseTime),
      languageQuality: this.scoreLanguageQuality(response),
      contextRelevance: this.scoreContextRelevance(response, scenario.category)
    };

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const maxScore = 100;
    const passed = totalScore >= 70; // 70% threshold

    return {
      totalScore,
      maxScore,
      breakdown: scores,
      passed,
      percentage: Math.round((totalScore / maxScore) * 100)
    };
  }

  // Score response length based on complexity
  scoreResponseLength(response, complexity) {
    if (!response) return 0;

    const length = response.length;
    const thresholds = {
      low: { min: 50, optimal: 200, max: 500 },
      medium: { min: 100, optimal: 400, max: 800 },
      high: { min: 200, optimal: 600, max: 1200 }
    };

    const threshold = thresholds[complexity] || thresholds.medium;

    if (length < threshold.min) return 5;
    if (length > threshold.max) return 10;
    if (length >= threshold.optimal * 0.8 && length <= threshold.optimal * 1.2) return 20;
    return 15;
  }

  // Enhanced keyword matching with weighting
  scoreKeywordMatch(response, expectedKeywords) {
    if (!response || !expectedKeywords.length) return 0;

    const lowerResponse = response.toLowerCase();
    const matchedKeywords = expectedKeywords.filter(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );

    const matchRatio = matchedKeywords.length / expectedKeywords.length;
    return Math.round(matchRatio * 25); // Max 25 points
  }

  // Score response time
  scoreResponseTime(responseTime, expectedTime) {
    if (responseTime <= expectedTime * 0.7) return 20; // Excellent
    if (responseTime <= expectedTime) return 15; // Good
    if (responseTime <= expectedTime * 1.5) return 10; // Acceptable
    if (responseTime <= expectedTime * 2) return 5; // Poor
    return 0; // Very poor
  }

  // Score Georgian language quality
  scoreLanguageQuality(response) {
    if (!response) return 0;

    const georgianChars = (response.match(/[ა-ჰ]/g) || []).length;
    const totalChars = response.length;
    const georgianRatio = georgianChars / totalChars;

    if (georgianRatio > 0.3) return 10; // Good Georgian content
    if (georgianRatio > 0.1) return 5; // Some Georgian content
    return 2; // Minimal Georgian content
  }

  // Score context relevance
  scoreContextRelevance(response, category) {
    if (!response) return 0;

    const categoryKeywords = {
      basic: ['დახმარება', 'სერვისი', 'ინფორმაცია'],
      platform: ['პლატფორმა', 'სისტემა', 'ფუნქცია'],
      technical: ['კოდი', 'ფაილი', 'ფუნქცია', 'კომპონენტი'],
      process: ['პროცესი', 'ნაბიჯი', 'ეტაპი']
    };

    const keywords = categoryKeywords[category] || [];
    const matches = keywords.filter(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    return Math.min(10, matches * 3); // Max 10 points
  }

  // Run single test scenario
  async runSingleTest(scenario, testIndex, totalTests) {
    console.log(`\n🧪 Test ${testIndex}/${totalTests}: ${scenario.id}`);
    console.log(`📂 Category: ${scenario.category}, Complexity: ${scenario.complexity}`);
    console.log(`❓ Query: "${scenario.query}"`);

    const startTime = Date.now();

    try {
      const response = await axios.post(AI_ENDPOINT, {
        message: scenario.query,
        userId: `test_user_${scenario.id}`
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - startTime;
      const aiResponse = response.data.response || '';

      const score = this.calculateScore(scenario, aiResponse, responseTime);

      const result = {
        scenario: scenario.id,
        category: scenario.category,
        complexity: scenario.complexity,
        query: scenario.query,
        response: aiResponse,
        responseTime,
        score,
        timestamp: new Date().toISOString()
      };

      if (score.passed) {
        this.passedTests++;
        console.log(`✅ PASSED (${score.percentage}%) - ${responseTime}ms`);
      } else {
        console.log(`❌ FAILED (${score.percentage}%) - ${responseTime}ms`);
      }

      console.log(`📊 Score breakdown:`, score.breakdown);

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const score = this.calculateScore(scenario, null, responseTime, error);

      console.log(`❌ ERROR: ${error.message}`);

      return {
        scenario: scenario.id,
        category: scenario.category,
        complexity: scenario.complexity,
        query: scenario.query,
        response: null,
        responseTime,
        score,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Run tests with parallel processing
  async runTestsParallel(scenarios) {
    console.log(`🚀 Running ${scenarios.length} tests with concurrency limit: ${this.concurrencyLimit}`);

    const results = [];

    // Process tests in batches
    for (let i = 0; i < scenarios.length; i += this.concurrencyLimit) {
      const batch = scenarios.slice(i, i + this.concurrencyLimit);

      console.log(`\n📦 Processing batch ${Math.floor(i / this.concurrencyLimit) + 1}`);

      const batchPromises = batch.map((scenario, batchIndex) => 
        this.runSingleTest(scenario, i + batchIndex + 1, scenarios.length)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pause between batches
      if (i + this.concurrencyLimit < scenarios.length) {
        console.log('⏸️ Pausing between batches...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  // Analyze results by category
  analyzeByCategory(results) {
    const categories = new Map();

    results.forEach(result => {
      if (!categories.has(result.category)) {
        categories.set(result.category, {
          total: 0,
          passed: 0,
          averageScore: 0,
          averageTime: 0,
          tests: []
        });
      }

      const categoryData = categories.get(result.category);
      categoryData.total++;
      if (result.score.passed) categoryData.passed++;
      categoryData.averageScore += result.score.percentage;
      categoryData.averageTime += result.responseTime;
      categoryData.tests.push(result);
    });

    // Calculate averages
    categories.forEach((data, category) => {
      data.averageScore = Math.round(data.averageScore / data.total);
      data.averageTime = Math.round(data.averageTime / data.total);
      data.successRate = Math.round((data.passed / data.total) * 100);
    });

    return categories;
  }

  // Generate detailed report
  async generateReport(results) {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.score.passed).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    const averageScore = Math.round(
      results.reduce((sum, r) => sum + r.score.percentage, 0) / totalTests
    );
    const averageTime = Math.round(
      results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests
    );

    const categoryAnalysis = this.analyzeByCategory(results);

    const report = {
      summary: {
        totalTests,
        passedTests,
        successRate,
        averageScore,
        averageTime,
        timestamp: new Date().toISOString()
      },
      categoryBreakdown: Object.fromEntries(categoryAnalysis),
      detailedResults: results,
      recommendations: this.generateRecommendations(results, categoryAnalysis)
    };

    // Save report to JSON
    await fs.writeFile(
      'ai_test_report.json',
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  // Generate recommendations based on results
  generateRecommendations(results, categoryAnalysis) {
    const recommendations = [];

    if (results.filter(r => r.score.passed).length / results.length < 0.8) {
      recommendations.push('მოდელის ზოგადი წარმადობა საჭიროებს გაუმჯობესებას');
    }

    const slowTests = results.filter(r => r.responseTime > 10000);
    if (slowTests.length > 0) {
      recommendations.push(`${slowTests.length} ტესტი ნელია (>10s) - ოპტიმიზაცია საჭიროა`);
    }

    categoryAnalysis.forEach((data, category) => {
      if (data.successRate < 70) {
        recommendations.push(`${category} კატეგორია საჭიროებს გაუმჯობესებას (${data.successRate}%)`);
      }
    });

    return recommendations;
  }

  // Main test runner
  async runComprehensiveTests() {
    console.log('🚀 Starting comprehensive AI testing...\n');

    this.totalTests = TEST_SCENARIOS.length;
    this.passedTests = 0;

    const results = await this.runTestsParallel(TEST_SCENARIOS);
    const report = await this.generateReport(results);

    // Test RAG functionality
  await testRAGQueries();

  // Test file protection
  await testFileProtection();

  // Test Georgian search expansion
  await testGeorgianSearchExpansion();

  console.log('🎯 All AI tests completed successfully!');
}

async function testFileProtection() {
  console.log('\n🛡️ Testing file protection...');

  try {
    const FileAccessService = require('./file_access_service');

    const protectedFile = '.env';
    const isProtected = FileAccessService.isProtectedFile(protectedFile);

    if (isProtected) {
      console.log('✅ Protected file detection works');
    } else {
      console.log('❌ Protected file detection failed');
    }

  } catch (error) {
    console.error('❌ File protection test failed:', error.message);
  }
}

async function testGeorgianSearchExpansion() {
  console.log('\n🔍 Testing Georgian search expansion...');

  try {
    const FileAccessService = require('./file_access_service');

    const expanded = FileAccessService.expandSearchTerms('ჯავშანი');

    if (expanded.includes('booking') && expanded.includes('reservation')) {
      console.log('✅ Georgian search expansion works');
    } else {
      console.log('❌ Georgian search expansion failed');
    }

  } catch (error) {
    console.error('❌ Georgian search test failed:', error.message);
  }
}

// Export for use as module
module.exports = { ComprehensiveAITester, TEST_SCENARIOS };

// Run if called directly
if (require.main === module) {
  const tester = new ComprehensiveAITester();
  tester.runComprehensiveTests().catch(console.error);
}