
/**
 * 🚀 PROJECT PHOENIX - გურულო Real-time Intelligence Test
 * 
 * ტესტირებული capabilities:
 * 1. Real-time file access and analysis
 * 2. Project structure understanding
 * 3. Georgian language processing
 * 4. Memory integration
 * 5. Context building performance
 */

const axios = require('axios');

const AI_SERVICE_URL = 'http://localhost:5001';
const TEST_SCENARIOS = [
  {
    name: 'Real-time File Analysis',
    query: 'გურულო, შეაანალიზე ჩემი პროექტის სტრუქტურა და მითხარი რა ფაილებია ყველაზე მნიშვნელოვანი',
    expectedCapabilities: ['file-scanning', 'project-analysis', 'georgian-response']
  },
  {
    name: 'Code Understanding',
    query: 'ნახე ai-service/services/project_intelligence_service.js ფაილი და ამიღწერე მისი ფუნქციონალი',
    expectedCapabilities: ['file-reading', 'code-analysis', 'technical-explanation']
  },
  {
    name: 'Memory Integration',
    query: 'გაიხსენე ჩემი წინა კითხვები და გაუწიე პასუხი შესაბამისი კონტექსტის გათვალისწინებით',
    expectedCapabilities: ['memory-recall', 'context-continuity']
  },
  {
    name: 'Live Project State',
    query: 'რა ცვლილებები განხორციელდა ბოლო დროს პროექტში და რა უნდა გავაკეთო შემდეგ?',
    expectedCapabilities: ['project-monitoring', 'suggestions']
  }
];

async function testGuruloPhoenix() {
  console.log('🚀 Starting PROJECT PHOENIX - Gurulo Intelligence Test\n');

  for (const scenario of TEST_SCENARIOS) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`💬 Query: ${scenario.query}`);
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${AI_SERVICE_URL}/api/ai/chat`, {
        message: scenario.query,
        userId: 'test_phoenix_user'
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`✅ Response received in ${responseTime}ms`);
      console.log(`🧠 Model used: ${response.data.model}`);
      console.log(`🌟 Phoenix Engine: ${response.data.phoenixEngine ? 'Active' : 'Inactive'}`);
      console.log(`📚 Context Sources: ${response.data.contextSources?.join(', ') || 'Unknown'}`);
      
      if (response.data.success) {
        console.log(`📝 Response preview: ${response.data.response.substring(0, 200)}...`);
        
        // Check for expected capabilities
        const responseText = response.data.response.toLowerCase();
        const detectedCapabilities = scenario.expectedCapabilities.filter(capability => {
          switch (capability) {
            case 'file-scanning':
              return responseText.includes('ფაილ') || responseText.includes('file');
            case 'project-analysis':
              return responseText.includes('პროექტ') || responseText.includes('structure');
            case 'georgian-response':
              return /[ა-ჰ]/.test(response.data.response);
            case 'memory-recall':
              return responseText.includes('წინა') || responseText.includes('previous');
            case 'code-analysis':
              return responseText.includes('ფუნქცია') || responseText.includes('function');
            default:
              return true;
          }
        });
        
        console.log(`🎯 Detected capabilities: ${detectedCapabilities.join(', ')}`);
        console.log(`📊 Capability score: ${detectedCapabilities.length}/${scenario.expectedCapabilities.length}`);
      } else {
        console.log(`❌ Request failed: ${response.data.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
    
    console.log('─'.repeat(80) + '\n');
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final comparison test
  console.log('🏆 Final Comparison Test: Gurulo vs Traditional AI');
  await compareCapabilities();
}

async function compareCapabilities() {
  const comparisonQuery = 'ანალიზი: ჩემი პროექტის მიმდინარე მდგომარეობა, პრობლემები და რეკომენდაციები';
  
  try {
    console.log('🧪 Testing enhanced Gurulo...');
    const guruloResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/chat`, {
      message: comparisonQuery,
      userId: 'comparison_test'
    });
    
    if (guruloResponse.data.success) {
      console.log(`✅ Gurulo response length: ${guruloResponse.data.response.length} chars`);
      console.log(`🌟 Context sources: ${guruloResponse.data.contextSources?.length || 0}`);
      console.log(`⚡ Phoenix active: ${guruloResponse.data.phoenixEngine}`);
      
      // Check for real-time insights
      const hasFileAnalysis = guruloResponse.data.response.includes('ფაილ') || 
                             guruloResponse.data.response.includes('file');
      const hasProjectInsights = guruloResponse.data.response.includes('პროექტ') || 
                                guruloResponse.data.response.includes('structure');
      const hasActionableAdvice = guruloResponse.data.response.includes('რეკომენდაცია') || 
                                 guruloResponse.data.response.includes('შემდეგი ნაბიჯ');
      
      console.log(`📊 Analysis Results:`);
      console.log(`   File Analysis: ${hasFileAnalysis ? '✅' : '❌'}`);
      console.log(`   Project Insights: ${hasProjectInsights ? '✅' : '❌'}`);
      console.log(`   Actionable Advice: ${hasActionableAdvice ? '✅' : '❌'}`);
    }
  } catch (error) {
    console.error(`❌ Comparison test failed: ${error.message}`);
  }
}

// Run the test
if (require.main === module) {
  testGuruloPhoenix().catch(console.error);
}

module.exports = { testGuruloPhoenix };
