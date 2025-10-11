
const testScenarios = [
  {
    id: 1,
    question: "რა ფუნქცია აქვს bookingService.ts-ში?",
    expectedTopics: ["getBookingsByUser", "createBooking", "updateBooking", "deleteBooking", "calculateProviderStats"],
    category: "service_analysis"
  },
  {
    id: 2, 
    question: "როგორ მუშაობს BookingModal კომპონენტი?",
    expectedTopics: ["booking form", "validation", "Firebase", "calendar", "pricing"],
    category: "component_analysis"
  },
  {
    id: 3,
    question: "რა ლოგიკაა transport booking სერვისში?",
    expectedTopics: ["vehicle booking", "pricing", "availability", "validation"],
    category: "business_logic"
  },
  {
    id: 4,
    question: "როგორ ითვლება ღამეების ღირებულება cottage-ებისთვის?",
    expectedTopics: ["seasonal pricing", "base rate", "utility cost", "additional guests"],
    category: "pricing_logic"
  },
  {
    id: 5,
    question: "რა არის messaging system-ის ფუნქციონალი?",
    expectedTopics: ["conversations", "real-time", "notifications", "support"],
    category: "messaging_features"
  }
];

// Test runner function
async function runAITests() {
  console.log('🧪 Starting AI Testing with Groq...');
  
  for (const scenario of testScenarios) {
    console.log(`\n📝 Test ${scenario.id}: ${scenario.question}`);
    console.log(`📊 Category: ${scenario.category}`);
    console.log(`🎯 Expected topics: ${scenario.expectedTopics.join(', ')}`);
    
    try {
      // Send question to AI
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: scenario.question,
          personalId: 'test_user_123'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ AI Response received`);
        console.log(`📄 Response: ${result.response.substring(0, 200)}...`);
        
        // Check if response contains expected topics
        const responseText = result.response.toLowerCase();
        const foundTopics = scenario.expectedTopics.filter(topic => 
          responseText.includes(topic.toLowerCase())
        );
        
        console.log(`🎯 Found topics: ${foundTopics.join(', ')}`);
        console.log(`📈 Coverage: ${foundTopics.length}/${scenario.expectedTopics.length}`);
        
        if (foundTopics.length >= scenario.expectedTopics.length * 0.5) {
          console.log(`✅ Test PASSED (>50% topic coverage)`);
        } else {
          console.log(`❌ Test FAILED (insufficient topic coverage)`);
        }
      } else {
        console.log(`❌ AI Request failed: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Test error: ${error.message}`);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 AI Testing completed!');
}

// Export for use in browser console or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testScenarios, runAITests };
} else {
  window.AITesting = { testScenarios, runAITests };
}
