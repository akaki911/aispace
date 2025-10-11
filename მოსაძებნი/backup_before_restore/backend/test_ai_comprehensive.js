
const axios = require('axios');

// Comprehensive test scenarios for Bakhmaro AI system
const testScenarios = [
  {
    id: 1,
    question: "მომწერე Bakhmaro booking-ის ძირითადი ფუნქციები",
    category: "platform_overview",
    expectedKeywords: ["კოტეჯები", "ბუკინგი", "ბრონირება", "ფასები", "პროვაიდერი"],
    complexity: "medium"
  },
  {
    id: 2,
    question: "როგორ ხდება კოტეჯების ჯავშნის გამოთვლა?",
    category: "pricing_logic",
    expectedKeywords: ["ღამეების", "ღირებულება", "ფასი", "თარიღი", "pricing"],
    complexity: "high"
  },
  {
    id: 3,
    question: "რა როლი აქვს პროვაიდერს admin პანელში?",
    category: "roles_permissions",
    expectedKeywords: ["პროვაიდერი", "ადმინ", "როლი", "უფლებები", "მართვა"],
    complexity: "medium"
  },
  {
    id: 4,
    question: "რა ფუნქციებია BookingService.ts-ში?",
    category: "code_analysis",
    expectedKeywords: ["createBooking", "updateBooking", "getBookings", "validation"],
    complexity: "high"
  },
  {
    id: 5,
    question: "როგორ მუშაობს BookingModal კომპონენტი?",
    category: "component_analysis",
    expectedKeywords: ["React", "modal", "form", "useState", "validation"],
    complexity: "high"
  },
  {
    id: 6,
    question: "რა არის სასტუმროების ბუკინგის პროცესი?",
    category: "business_process",
    expectedKeywords: ["სასტუმრო", "hotel", "ბუკინგი", "ნომერი", "ღამე"],
    complexity: "medium"
  },
  {
    id: 7,
    question: "როგორ ემატება ახალი მომხმარებელი სისტემაში?",
    category: "user_management",
    expectedKeywords: ["მომხმარებელი", "რეგისტრაცია", "Firebase", "auth"],
    complexity: "medium"
  },
  {
    id: 8,
    question: "რამდენია 5 + 3 * 2?",
    category: "calculation",
    expectedKeywords: ["11", "გამოთვლა", "მათემატიკა"],
    complexity: "low"
  },
  {
    id: 9,
    question: "რა ტიპის ტრანსპორტია ხელმისაწვდომი?",
    category: "vehicle_types",
    expectedKeywords: ["ტრანსპორტი", "vehicle", "მანქანა", "სნოუმობილი"],
    complexity: "low"
  },
  {
    id: 10,
    question: "როგორ იმუშავებს AI ასისტენტი ამ პლატფორმაზე?",
    category: "ai_functionality",
    expectedKeywords: ["AI", "ასისტენტი", "Groq", "RAG", "ანალიზი"],
    complexity: "medium"
  },
  {
    id: 11,
    question: "გამარჯობა, შემიძლია დახმარება?",
    category: "greeting",
    expectedKeywords: ["გამარჯობა", "დახმარება", "როგორ", "შეკითხვა"],
    complexity: "low"
  },
  {
    id: 12,
    question: "რა სტრუქტურული ცვლილებებია საჭირო მონაცემთა ბაზაში?",
    category: "database_analysis",
    expectedKeywords: ["მონაცემთა ბაზა", "Firebase", "structure", "collections"],
    complexity: "high"
  }
];

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:5001',
  timeout: 30000, // 30 seconds timeout
  userId: '01019062020',
  retryAttempts: 2
};

// Test results storage
let testResults = [];
let successCount = 0;
let failureCount = 0;

/**
 * Execute a single test scenario
 */
async function executeTest(scenario) {
  console.log(`\n🧪 ტესტი ${scenario.id}: ${scenario.question}`);
  console.log(`📊 კატეგორია: ${scenario.category} | სირთულე: ${scenario.complexity}`);
  
  const startTime = Date.now();
  
  try {
    // Send request to AI chat endpoint
    const response = await axios.post(
      `${TEST_CONFIG.baseURL}/api/ai/chat`,
      {
        message: scenario.question,
        userId: TEST_CONFIG.userId,
        conversationHistory: []
      },
      {
        timeout: TEST_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const responseTime = Date.now() - startTime;
    const aiResponse = response.data.response || response.data.reply || '';

    // Analyze response quality
    const analysis = analyzeResponse(aiResponse, scenario);
    
    const testResult = {
      id: scenario.id,
      question: scenario.question,
      response: aiResponse,
      responseTime: responseTime,
      status: analysis.status,
      score: analysis.score,
      keywordsFound: analysis.keywordsFound,
      keywordsMissing: analysis.keywordsMissing,
      service: response.data.service || 'unknown',
      model: response.data.model || 'unknown',
      cached: response.data.cached || false,
      analysis: analysis
    };

    testResults.push(testResult);

    // Log results
    console.log(`✅ პასუხი მიღებულია: ${responseTime}ms`);
    console.log(`🔍 ქულა: ${analysis.score}/100`);
    console.log(`📝 სერვისი: ${testResult.service}`);
    console.log(`🎯 ნაპოვნი საკვანძო სიტყვები: ${analysis.keywordsFound.join(', ') || 'არც ერთი'}`);
    
    if (analysis.keywordsMissing.length > 0) {
      console.log(`⚠️ დაკარგული საკვანძო სიტყვები: ${analysis.keywordsMissing.join(', ')}`);
    }

    if (analysis.score >= 70) {
      successCount++;
      console.log(`🎉 ტესტი წარმატებულია!`);
    } else {
      failureCount++;
      console.log(`❌ ტესტი ვერ გაიარა (ქულა < 70)`);
    }

    // Print response preview
    const preview = aiResponse.length > 200 ? aiResponse.substring(0, 200) + '...' : aiResponse;
    console.log(`📄 პასუხის ნაწყვეტი: "${preview}"`);

    return testResult;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error(`❌ ტესტი ვერ შესრულდა: ${error.message}`);
    
    const errorResult = {
      id: scenario.id,
      question: scenario.question,
      response: null,
      responseTime: responseTime,
      status: 'error',
      score: 0,
      error: error.message,
      service: 'error',
      analysis: { status: 'error', score: 0, issues: [error.message] }
    };

    testResults.push(errorResult);
    failureCount++;
    
    return errorResult;
  }
}

/**
 * Analyze AI response quality
 */
function analyzeResponse(response, scenario) {
  if (!response || response.trim().length === 0) {
    return {
      status: 'empty',
      score: 0,
      keywordsFound: [],
      keywordsMissing: scenario.expectedKeywords,
      issues: ['ცარიელი პასუხი']
    };
  }

  const responseLower = response.toLowerCase();
  const keywordsFound = [];
  const keywordsMissing = [];

  // Check for expected keywords
  scenario.expectedKeywords.forEach(keyword => {
    if (responseLower.includes(keyword.toLowerCase())) {
      keywordsFound.push(keyword);
    } else {
      keywordsMissing.push(keyword);
    }
  });

  // Calculate score based on multiple factors
  let score = 0;
  
  // Keyword coverage (40 points)
  const keywordCoverage = keywordsFound.length / scenario.expectedKeywords.length;
  score += keywordCoverage * 40;

  // Response length appropriateness (20 points)
  if (response.length > 50 && response.length < 2000) {
    score += 20;
  } else if (response.length >= 2000) {
    score += 10; // Too long
  }

  // Georgian language quality (20 points)
  const georgianChars = response.match(/[ა-ჰ]/g);
  if (georgianChars && georgianChars.length > response.length * 0.3) {
    score += 20;
  } else if (georgianChars) {
    score += 10;
  }

  // Relevance and structure (20 points)
  if (response.includes('ფუნქცია') || response.includes('სისტემა') || 
      response.includes('პლატფორმა') || response.includes('ბუკინგი')) {
    score += 10;
  }
  
  if (response.includes('•') || response.includes('📁') || 
      response.includes('**') || response.match(/\d+\./)) {
    score += 10; // Well structured
  }

  // Determine status
  let status = 'success';
  const issues = [];

  if (score < 30) {
    status = 'poor';
    issues.push('ძალიან დაბალი ქულა');
  } else if (score < 70) {
    status = 'needs_improvement';
    issues.push('საჭიროებს გაუმჯობესებას');
  }

  if (keywordsMissing.length > scenario.expectedKeywords.length / 2) {
    issues.push('ძირითადი საკვანძო სიტყვები არ მოიძებნა');
  }

  return {
    status,
    score: Math.round(score),
    keywordsFound,
    keywordsMissing,
    issues,
    keywordCoverage,
    responseLength: response.length
  };
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n🎯 ═══════════════════════════════════════════════════════');
  console.log('📊 AI ტესტირების სრული ანგარიში');
  console.log('═══════════════════════════════════════════════════════');

  // Overall statistics
  const totalTests = testResults.length;
  const averageScore = testResults.reduce((sum, test) => sum + (test.score || 0), 0) / totalTests;
  const averageResponseTime = testResults.reduce((sum, test) => sum + test.responseTime, 0) / totalTests;

  console.log(`\n📈 მთლიანი სტატისტიკა:`);
  console.log(`   • სულ ტესტები: ${totalTests}`);
  console.log(`   • წარმატებული: ${successCount}`);
  console.log(`   • წარუმატებელი: ${failureCount}`);
  console.log(`   • წარმატების კოეფიციენტი: ${Math.round((successCount / totalTests) * 100)}%`);
  console.log(`   • საშუალო ქულა: ${Math.round(averageScore)}/100`);
  console.log(`   • საშუალო რესპონს ტაიმი: ${Math.round(averageResponseTime)}ms`);

  // Category performance
  const categoryStats = {};
  testResults.forEach(test => {
    const scenario = testScenarios.find(s => s.id === test.id);
    if (scenario) {
      if (!categoryStats[scenario.category]) {
        categoryStats[scenario.category] = { scores: [], count: 0 };
      }
      categoryStats[scenario.category].scores.push(test.score || 0);
      categoryStats[scenario.category].count++;
    }
  });

  console.log(`\n📊 კატეგორიების მიხედვით შედეგები:`);
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.count;
    console.log(`   • ${category}: ${Math.round(avgScore)}/100 (${stats.count} ტესტი)`);
  });

  // Detailed results
  console.log(`\n🔍 დეტალური შედეგები:`);
  testResults.forEach(test => {
    const scenario = testScenarios.find(s => s.id === test.id);
    const statusEmoji = test.score >= 70 ? '✅' : test.score >= 30 ? '⚠️' : '❌';
    
    console.log(`\n${statusEmoji} ტესტი ${test.id}: ${scenario?.complexity || 'unknown'} სირთულე`);
    console.log(`   📝 კითხვა: ${test.question}`);
    console.log(`   🎯 ქულა: ${test.score || 0}/100`);
    console.log(`   ⏱️ დრო: ${test.responseTime}ms`);
    console.log(`   🔧 სერვისი: ${test.service}`);
    
    if (test.analysis?.issues && test.analysis.issues.length > 0) {
      console.log(`   ⚠️ საკითხები: ${test.analysis.issues.join(', ')}`);
    }
  });

  // Recommendations
  console.log(`\n💡 რეკომენდაციები:`);
  
  if (averageScore < 70) {
    console.log(`   • AI პასუხების ხარისხი საჭიროებს გაუმჯობესებას`);
  }
  
  if (averageResponseTime > 5000) {
    console.log(`   • პასუხის დრო ძალიან ნელაა (>${averageResponseTime}ms)`);
  }

  const failedCategories = Object.entries(categoryStats)
    .filter(([_, stats]) => stats.scores.reduce((a, b) => a + b, 0) / stats.count < 60)
    .map(([category]) => category);

  if (failedCategories.length > 0) {
    console.log(`   • ამ კატეგორიებს ესაჭიროება დამატებითი მუშაობა: ${failedCategories.join(', ')}`);
  }

  // Performance insights
  const groqTests = testResults.filter(t => t.service?.includes('groq'));
  const fallbackTests = testResults.filter(t => t.service?.includes('fallback'));
  
  if (groqTests.length > 0 && fallbackTests.length > 0) {
    const groqAvg = groqTests.reduce((sum, test) => sum + (test.score || 0), 0) / groqTests.length;
    const fallbackAvg = fallbackTests.reduce((sum, test) => sum + (test.score || 0), 0) / fallbackTests.length;
    
    console.log(`\n⚡ Groq vs Fallback შედარება:`);
    console.log(`   • Groq საშუალო ქულა: ${Math.round(groqAvg)}/100 (${groqTests.length} ტესტი)`);
    console.log(`   • Fallback საშუალო ქულა: ${Math.round(fallbackAvg)}/100 (${fallbackTests.length} ტესტი)`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
}

/**
 * Main test execution
 */
async function runComprehensiveTests() {
  console.log('🚀 AI სისტემის სრული ტესტირება იწყება...');
  console.log(`📋 სულ ${testScenarios.length} ტესტი`);
  
  // Test API health first
  try {
    const healthCheck = await axios.get(`${TEST_CONFIG.baseURL}/api/ai/health`, {
      timeout: 5000
    });
    console.log('✅ AI API ხელმისაწვდომია');
  } catch (error) {
    console.error('❌ AI API მიუწვდომელია:', error.message);
    console.log('⚠️ ტესტირება გაგრძელდება fallback რეჟიმში...');
  }

  // Execute all tests
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    
    await executeTest(scenario);
    
    // Wait between tests to avoid overwhelming the system
    if (i < testScenarios.length - 1) {
      console.log('⏳ მოლოდინის 2 წამი...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate and display final report
  generateTestReport();
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `ai_test_results_${timestamp}.json`;
  
  require('fs').writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults.length,
      successCount,
      failureCount,
      averageScore: testResults.reduce((sum, test) => sum + (test.score || 0), 0) / testResults.length
    },
    results: testResults
  }, null, 2));

  console.log(`\n💾 დეტალური ანგარიში შენახულია: ${reportFile}`);
}

// Export for potential external use
module.exports = {
  runComprehensiveTests,
  testScenarios,
  executeTest,
  analyzeResponse
};

// Run tests if called directly
if (require.main === module) {
  runComprehensiveTests().catch(error => {
    console.error('❌ ტესტირების კრიტიკული შეცდომა:', error);
    process.exit(1);
  });
}
