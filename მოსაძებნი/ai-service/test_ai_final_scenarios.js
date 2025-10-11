
const axios = require('axios');

// ფინალური ტესტირების სცენარები Bakhmaro AI სისტემისთვის
const FINAL_TEST_SCENARIOS = [
  // 1. პლატფორმის მიმოხილვა
  {
    id: 'platform_overview',
    query: 'მომიყევი Bakhmaro Booking-ის ძირითადი გვერდები',
    expectedElements: ['კოტეჯები', 'სასტუმროები', 'ავტომობილები', 'ცხენები', 'თოვლმავლები', 'bullet points'],
    description: 'Platform overview with structured layout'
  },

  // 2. ჯავშნის პროცესი
  {
    id: 'booking_process',
    query: 'როგორ მოვძებნოთ კოტეჯი და გავაკეთოთ ჯავშანი?',
    expectedElements: ['ძებნა', 'კალენდარი', 'გადახდა', 'step-by-step'],
    description: 'Step-by-step booking process'
  },

  // 3. Provider როლის უფლებები
  {
    id: 'provider_permissions',
    query: 'რა დონის წვდომა აქვს Provider როლს?',
    expectedElements: ['view_dashboard', 'manage_cottages', 'view_bookings', 'admin პანელი'],
    description: 'Provider role permissions and access levels'
  },

  // 4. ტექნიკური კითხვა
  {
    id: 'technical_components',
    query: 'რომელი ფაილები და კომპონენტები პასუხისმგებელია კოტეჯების მართვაზე?',
    expectedElements: ['AdminCottages.tsx', 'CottageForm.tsx', 'CottagePage.tsx', 'firestore'],
    description: 'Technical file structure for cottage management'
  },

  // 5. სეზონური ფასები
  {
    id: 'seasonal_pricing',
    query: 'როგორ მუშაობს სეზონური ფასების სისტემა?',
    expectedElements: ['seasonPrice', 'offSeasonPrice', 'priceByMonth', 'PriceTag კომპონენტი'],
    description: 'Seasonal pricing system explanation'
  },

  // 6. გადახდის სისტემა
  {
    id: 'payment_system',
    query: 'როგორ ხდება გადახდების დამუშავება და მომხმარებლის ტიპების განსხვავება?',
    expectedElements: ['depositAmount', 'totalPrice', 'BookingModal', 'ავანსი'],
    description: 'Payment processing and user type differences'
  },

  // 7. სუპერ ადმინის ფუნქციები
  {
    id: 'super_admin_functions',
    query: 'რა შეუძლია SUPER_ADMIN როლს?',
    expectedElements: ['manage_users', 'manage_roles', 'view_logs', 'commission მართვა'],
    description: 'Super admin capabilities and permissions'
  },

  // 8. მისალმება და დახმარება
  {
    id: 'greeting_help',
    query: 'გამარჯობა, როგორ შემიძლია დახმარება?',
    expectedElements: ['მისალმება', 'დახმარების შეთავაზება', 'სერვისები'],
    description: 'Greeting and help offering'
  },

  // 9. მობილური რესპონსივობა
  {
    id: 'mobile_responsive',
    query: 'რამდენად რესპონსივია საიტი მობილურ მოწყობილობებზე?',
    expectedElements: ['Tailwind CSS', 'responsive design', 'mobile-first'],
    description: 'Mobile responsiveness and design approach'
  },

  // 10. შეცდომების მართვა
  {
    id: 'error_handling',
    query: 'როგორ ხდება შეცდომების მართვა და მონიტორინგი?',
    expectedElements: ['ErrorBoundary', 'globalErrorHandler', 'logging'],
    description: 'Error handling and monitoring systems'
  },

  // 11. მომხმარებლის ავთენტიფიკაცია
  {
    id: 'user_authentication',
    query: 'როგორ მუშაობს მომხმარებლის ავთენტიფიკაცია და ავტორიზაცია?',
    expectedElements: ['Firebase Auth', 'ProtectedRoute', 'useAuth', 'roles'],
    description: 'Authentication and authorization flow'
  },

  // 12. შეტყობინებების სისტემა
  {
    id: 'messaging_system',
    query: 'როგორ მუშაობს შეტყობინებების სისტემა ადმინებსა და მომხმარებლებს შორის?',
    expectedElements: ['MessagingSystem', 'real-time', 'notifications'],
    description: 'Internal messaging and notification system'
  },

  // 13. ბანკის ანგარიშების მართვა
  {
    id: 'bank_account_management',
    query: 'როგორ ხდება ბანკის ანგარიშების მართვა პროვაიდერებისთვის?',
    expectedElements: ['BankAccountManager', 'commission', 'payment routing'],
    description: 'Bank account management for providers'
  },

  // 14. მუქი თემა
  {
    id: 'dark_theme',
    query: 'როგორ მუშაობს მუქი/ღია თემების სისტემა?',
    expectedElements: ['ThemeContext', 'dark mode', 'localStorage', 'toggle'],
    description: 'Dark/light theme system implementation'
  },

  // 15. AI ასისტენტი
  {
    id: 'ai_assistant_functionality',
    query: 'რას აკეთებს AI ასისტენტი და როგორ მუშაობს?',
    expectedElements: ['Groq API', 'Georgian language', 'memory system', 'streaming'],
    description: 'AI assistant functionality and features'
  }
];

const BASE_URL = 'http://localhost:5001';
const AI_ENDPOINT = `${BASE_URL}/api/ai/chat`;

async function runFinalTests() {
  console.log('🚀 დაწყებულია AI სისტემის ფინალური ტესტირება...\n');
  
  const results = [];
  let passedTests = 0;
  let totalResponseTime = 0;

  for (let i = 0; i < FINAL_TEST_SCENARIOS.length; i++) {
    const scenario = FINAL_TEST_SCENARIOS[i];
    console.log(`\n📝 ტესტი ${i + 1}/${FINAL_TEST_SCENARIOS.length}: ${scenario.id}`);
    console.log(`❓ კითხვა: "${scenario.query}"`);
    console.log(`📋 მოსალოდნელი: ${scenario.description}`);

    try {
      const startTime = Date.now();
      
      const response = await axios.post(AI_ENDPOINT, {
        message: scenario.query,
        userId: 'test_final_user'
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;
      totalResponseTime += responseTime;

      if (response.status === 200 && response.data.response) {
        const aiResponse = response.data.response;
        const metadata = response.data.metadata || {};

        // შევამოწმოთ პასუხის ხარისხი
        const qualityChecks = {
          hasResponse: !!aiResponse,
          notEmpty: aiResponse.length > 50,
          containsBullets: /[•·▪▫]|\d+\.|\-\s/.test(aiResponse),
          inGeorgian: /[ა-ჰ]/.test(aiResponse),
          reasonableLength: aiResponse.length > 100 && aiResponse.length < 2000,
          fastResponse: responseTime < 15000,
          containsExpectedElements: scenario.expectedElements.some(element => 
            aiResponse.toLowerCase().includes(element.toLowerCase())
          )
        };

        const qualityScore = Object.values(qualityChecks).filter(Boolean).length;
        const maxScore = Object.keys(qualityChecks).length;
        const passed = qualityScore >= (maxScore * 0.7); // 70% threshold

        if (passed) {
          passedTests++;
          console.log(`✅ PASSED (${qualityScore}/${maxScore}) - ${responseTime}ms`);
        } else {
          console.log(`❌ FAILED (${qualityScore}/${maxScore}) - ${responseTime}ms`);
        }

        console.log(`📏 პასუხის სიგრძე: ${aiResponse.length} სიმბოლო`);
        console.log(`⚡ პასუხის დრო: ${responseTime}ms`);
        console.log(`🎯 ხარისხის ქულა: ${qualityScore}/${maxScore}`);
        
        // ვაჩვენოთ პასუხის ნაწილი
        const preview = aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : '');
        console.log(`💬 პასუხის preview: "${preview}"`);

        results.push({
          scenario: scenario.id,
          passed,
          responseTime,
          qualityScore,
          maxScore,
          qualityChecks,
          responseLength: aiResponse.length,
          metadata
        });

      } else {
        console.log(`❌ FAILED - არასწორი response status: ${response.status}`);
        results.push({
          scenario: scenario.id,
          passed: false,
          error: `HTTP ${response.status}`,
          responseTime
        });
      }

    } catch (error) {
      console.log(`❌ FAILED - შეცდომა: ${error.message}`);
      results.push({
        scenario: scenario.id,
        passed: false,
        error: error.message,
        responseTime: Date.now() - Date.now()
      });
    }

    // პაუზა ტესტებს შორის
    if (i < FINAL_TEST_SCENARIOS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // ფინალური შედეგები
  console.log('\n' + '='.repeat(60));
  console.log('🏁 ფინალური ტესტირების შედეგები');
  console.log('='.repeat(60));
  
  console.log(`✅ გავლილი ტესტები: ${passedTests}/${FINAL_TEST_SCENARIOS.length}`);
  console.log(`📊 წარმატების პროცენტი: ${Math.round((passedTests / FINAL_TEST_SCENARIOS.length) * 100)}%`);
  console.log(`⚡ საშუალო პასუხის დრო: ${Math.round(totalResponseTime / FINAL_TEST_SCENARIOS.length)}ms`);

  // ყველაზე ჩაშლილი ტესტები
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ ჩაშლილი ტესტები:');
    failedTests.forEach(test => {
      console.log(`  • ${test.scenario}: ${test.error || 'quality issues'}`);
    });
  }

  // ყველაზე ნელი ტესტები
  const slowTests = results.filter(r => r.responseTime > 10000);
  if (slowTests.length > 0) {
    console.log('\n🐌 ნელი ტესტები (>10s):');
    slowTests.forEach(test => {
      console.log(`  • ${test.scenario}: ${test.responseTime}ms`);
    });
  }

  // რეკომენდაციები
  console.log('\n📋 რეკომენდაციები:');
  if (passedTests === FINAL_TEST_SCENARIOS.length) {
    console.log('🎉 ყველა ტესტი წარმატებით გაიარა! AI სისტემა მზადაა პროდუქციისთვის.');
  } else if (passedTests >= FINAL_TEST_SCENARIOS.length * 0.8) {
    console.log('✨ AI სისტემა კარგ მდგომარეობაშია, მცირე გაუმჯობესებები საჭიროა.');
  } else {
    console.log('⚠️ AI სისტემას სჭირდება მნიშვნელოვანი გაუმჯობესებები.');
  }

  return results;
}

// მთავარი ფუნქცია
async function main() {
  try {
    await runFinalTests();
  } catch (error) {
    console.error('💥 ტესტირების შეცდომა:', error.message);
    process.exit(1);
  }
}

// გავუშვათ ტესტები
if (require.main === module) {
  main();
}

module.exports = {
  runFinalTests,
  FINAL_TEST_SCENARIOS
};
