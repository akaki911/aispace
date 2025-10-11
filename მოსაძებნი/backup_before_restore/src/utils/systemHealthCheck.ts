
export const runSystemHealthCheck = async () => {
  console.log('🔧 Firebase და AI სისტემის შემოწმება...');

  // 1. Firebase Persistence Check
  const checkFirebasePersistence = () => {
    const pendingMutations = Object.keys(localStorage)
      .filter(key => key.includes('firestore_mutations'))
      .length;
    
    console.log(`📊 Firebase Pending Mutations: ${pendingMutations}`);
    return pendingMutations < 20; // ნორმალური რაოდენობა
  };

  // 2. AI Assistant Visibility Check
  const checkAIAssistant = () => {
    const authUser = localStorage.getItem('authUser');
    let hasAIAccess = false;
    
    if (authUser) {
      try {
        const user = JSON.parse(authUser);
        hasAIAccess = user.personalId === "01019062020";
        console.log(`🤖 AI Assistant Access: ${hasAIAccess ? '✅ ხელმისაწვდომი' : '❌ არ არის ხელმისაწვდომი'}`);
      } catch (e) {
        console.log('❌ User parsing error:', e);
      }
    } else {
      console.log('👤 მომხმარებელი არ არის შესული');
    }
    
    return hasAIAccess;
  };

  // 3. Microservices Health Check
  const checkMicroservices = async () => {
    const services = [
      { name: 'AI Service', url: 'http://localhost:5001/health' },
      { name: 'Backend', url: 'http://localhost:5002/health' }
    ];

    const results = await Promise.allSettled(
      services.map(service => 
        fetch(service.url)
          .then(res => ({ service: service.name, status: res.ok ? 'OK' : 'Error' }))
          .catch(() => ({ service: service.name, status: 'Offline' }))
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { service, status } = result.value;
        console.log(`🏥 ${service}: ${status === 'OK' ? '✅' : '❌'} ${status}`);
      } else {
        console.log(`🏥 ${services[index].name}: ❌ Connection Failed`);
      }
    });

    return results.every(r => r.status === 'fulfilled' && r.value.status === 'OK');
  };

  // 4. Batch Operations Test
  const testBatchOperations = async () => {
    try {
      const { FirestoreBatchManager } = await import('./firestoreBatch');
      const batchManager = new FirestoreBatchManager();
      console.log('✅ Firestore Batch Manager ხელმისაწვდომია');
      console.log(`📊 Current Operations: ${batchManager.getOperationCount()}`);
      return true;
    } catch (error) {
      console.error('❌ Batch Manager Error:', error);
      return false;
    }
  };

  // Run all checks
  const persistenceOK = checkFirebasePersistence();
  const aiAccessOK = checkAIAssistant();
  const batchOK = await testBatchOperations();
  const servicesOK = await checkMicroservices();

  const summary = {
    firebase: persistenceOK,
    aiAssistant: aiAccessOK,
    batchOperations: batchOK,
    microservices: servicesOK,
    overall: persistenceOK && batchOK && servicesOK
  };

  console.log('\n📋 სისტემის მდგომარეობა:');
  console.log(`🔥 Firebase: ${summary.firebase ? '✅' : '❌'}`);
  console.log(`🤖 AI Assistant: ${summary.aiAssistant ? '✅' : '❌'}`);
  console.log(`📦 Batch Operations: ${summary.batchOperations ? '✅' : '❌'}`);
  console.log(`🏥 Microservices: ${summary.microservices ? '✅' : '❌'}`);
  console.log(`🎯 საერთო: ${summary.overall ? '✅ ყველაფერი კარგად მუშაობს' : '❌ პრობლემები არსებობს'}`);

  return summary;
};

// Global access
declare global {
  interface Window {
    runSystemHealthCheck: () => Promise<any>;
    clearPendingMutations: () => void;
  }
}

// Clear pending mutations function
window.clearPendingMutations = () => {
  const keys = Object.keys(localStorage).filter(key => 
    key.includes('firestore_mutations') && 
    key.includes('pending')
  );
  
  keys.forEach(key => localStorage.removeItem(key));
  console.log(`🧹 Cleared ${keys.length} pending mutations`);
};

window.runSystemHealthCheck = runSystemHealthCheck;

export default runSystemHealthCheck;
