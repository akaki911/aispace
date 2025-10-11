import { bankAccountService } from '../services/bankAccountService';

export const testDebugConsole = () => {
  const testBankAccountService = async () => {
    try {
      console.log('[INFO][DebugTest] Testing bank account service...');

      const accounts = await bankAccountService.getAllBankAccounts();

      console.log(`[INFO][DebugTest] Bank account test completed: ${accounts.length} accounts found`, {
        accountCount: accounts.length,
        accounts: accounts.map(acc => ({ id: acc.id, bank: acc.bank, status: acc.status }))
      });

    } catch (error) {
      console.error(`[ERROR][DebugTest] Bank account test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { error });
    }
  };

  const runTests = () => {
    console.log('[INFO][DebugTest] Debug console tests started...');

    // Test 1: Info log
    console.log('[INFO][DebugTest] This is an info log for testing', { timestamp: new Date().toISOString() });

    // Test 2: Warning log
    console.warn('[WARN][DebugTest] This is a warning log for testing', { warningType: 'dataLoss', timestamp: new Date().toISOString() });

    // Test 3: Error log
    console.error('[ERROR][DebugTest] This is an error log for testing', { errorType: 'network', timestamp: new Date().toISOString() });

    // Test 4: Modal test
    console.log('[MODAL][DebugTest] Modal opened for testing', { modalType: 'test', timestamp: new Date().toISOString() });

    // Test 5: Bank Account Service Test
    testBankAccountService();

    console.log('🔍 Debug tests completed!');
  };

  runTests();
};

// Global function for testing
(window as any).testDebugConsole = testDebugConsole;

// Auto-run after short delay
setTimeout(testDebugConsole, 1000);