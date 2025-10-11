
const { askGroq } = require('./services/groq_service');

const testQuestions = [
  {
    id: 1,
    question: "რა ფუნქცია აქვს bookingService.ts-ში?",
    context: "ეს კითხვა ეხება booking service-ის ფუნქციონალს"
  },
  {
    id: 2,
    question: "როგორ მუშაობს BookingModal კომპონენტი?", 
    context: "ეს კითხვა ეხება React კომპონენტის ლოგიკას"
  },
  {
    id: 3,
    question: "რა ლოგიკაა transport booking სერვისში?",
    context: "ეს კითხვა ეხება vehicle booking ლოგიკას"
  },
  {
    id: 4,
    question: "როგორ ითვლება ღამეების ღირებულება?",
    context: "ეს კითხვა ეხება pricing ლოგიკას"
  }
];

async function testGroqResponses() {
  console.log('🧪 Testing Groq API responses...');
  
  for (const test of testQuestions) {
    console.log(`\n📝 Test ${test.id}: ${test.question}`);
    
    try {
      const response = await askGroq(test.question);
      
      console.log(`✅ Response received (length: ${response.length})`);
      console.log(`📄 First 200 chars: ${response.substring(0, 200)}...`);
      
      // Check Georgian language quality
      const georgianChars = (response.match(/[ა-ჰ]/g) || []).length;
      const totalChars = response.length;
      const georgianPercentage = (georgianChars / totalChars) * 100;
      
      console.log(`🇬🇪 Georgian content: ${georgianPercentage.toFixed(1)}%`);
      
      // Check for common Georgian grammar issues
      const hasArtificialPatterns = /შესრულება მოხდა|ანალიზის ჩატარება|მოქმედების განხორციელება/.test(response);
      console.log(`📝 Artificial patterns: ${hasArtificialPatterns ? '❌ Found' : '✅ Clean'}`);
      
      // Check response relevance 
      const keywords = ['ფუნქცია', 'მუშაობს', 'ლოგიკა', 'სერვისი', 'კომპონენტი'];
      const hasRelevantKeywords = keywords.some(keyword => response.includes(keyword));
      console.log(`🎯 Relevance: ${hasRelevantKeywords ? '✅ Good' : '❌ Poor'}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n🏁 Groq testing completed!');
}

// Run tests if script is executed directly
if (require.main === module) {
  testGroqResponses().catch(console.error);
}

module.exports = { testGroqResponses };
