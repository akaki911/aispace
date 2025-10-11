import { logger } from '../services/loggingService';

export const createTestLogs = async () => {
  console.log('📝 Creating comprehensive test logs...');

  try {
    // Basic action logs
    await logger.logAction('TestModule', 'Creating comprehensive test logs for demonstration', 'test-user-id', 'test@example.com');

    // Different types of errors
    await logger.logError(
      'TestComponent',
      'React Component Error - Failed to render component',
      new Error('Component rendering failed: Cannot read property of undefined'),
      'test-user-id',
      'test@example.com',
      'TestComponent.tsx',
      'at TestComponent.render (TestComponent.tsx:45:12)\n    at React.createElement'
    );

    await logger.logError(
      'FormValidation',
      'Form Validation Error - Invalid user input',
      new Error('Validation failed: Email format invalid'),
      'test-user-id',
      'test@example.com',
      'UserForm.tsx',
      'Form data: {"email": "invalid-email", "phone": "123"}'
    );

    await logger.logError(
      'NetworkError',
      'API Request Failed - Network timeout',
      new Error('Failed to fetch: Network request timeout'),
      'test-user-id',
      'test@example.com',
      'apiService.ts',
      'Request: POST /api/users/create\nStatus: 408 Timeout'
    );

    await logger.logError(
      'ConsoleError',
      'Warning: React Hook useEffect has a missing dependency',
      new Error('React Hook dependency warning'),
      'test-user-id',
      'test@example.com',
      'React DevTools',
      'at HookComponent (HookComponent.tsx:15:5)'
    );

    await logger.logError(
      'ViteError',
      '[vite] Failed to resolve import "./non-existent-module"',
      new Error('Module resolution failed'),
      'test-user-id',
      'test@example.com',
      'main.tsx',
      'Import error in development server'
    );

    // UI interaction errors
    await logger.logError(
      'UserInteraction',
      'Button click handler failed - Cannot process payment',
      new Error('Payment processing failed: Invalid card number'),
      'test-user-id',
      'test@example.com',
      'PaymentButton.tsx',
      'User action: Payment button click\nElement ID: payment-submit-btn'
    );

    // API logs with different status codes
    await logger.logAPI('TestModule', 'GET /api/cottages', 200, 'test-user-id', 'test@example.com');
    await logger.logAPI('TestModule', 'POST /api/bookings', 201, 'test-user-id', 'test@example.com');
    await logger.logAPI('TestModule', 'GET /api/users/999', 404, 'test-user-id', 'test@example.com');
    await logger.logAPI('TestModule', 'POST /api/auth/login', 401, 'test-user-id', 'test@example.com');
    await logger.logAPI('TestModule', 'PUT /api/cottages/1', 500, 'test-user-id', 'test@example.com');

    // Debug logs
    await logger.logDebug('AuthContext', 'User authentication state changed', 'test-user-id', 'test@example.com');
    await logger.logDebug('PaymentFlow', 'Initializing payment process', 'test-user-id', 'test@example.com');

    // System logs
    await logger.logAction('System', 'Database connection established', undefined, undefined);
    await logger.logAction('System', 'Scheduled backup completed', undefined, undefined);

    // Performance-related logs
    await logger.logError(
      'Performance',
      'Slow component render detected',
      new Error('Component render time exceeded 100ms threshold'),
      'test-user-id',
      'test@example.com',
      'SlowComponent.tsx',
      'Render time: 145ms\nComponent: SlowComponent\nProps count: 25'
    );

    // Memory-related logs
    await logger.logError(
      'Memory',
      'Memory usage warning - High JavaScript heap usage',
      new Error('Memory threshold exceeded'),
      'test-user-id',
      'test@example.com',
      'MemoryMonitor',
      'Heap used: 85MB / 100MB limit\nComponent: DataTable with 1000+ rows'
    );

    console.log('✅ Comprehensive test logs created successfully!');
    console.log('📊 Created logs include:');
    console.log('   - React component errors');
    console.log('   - Form validation errors');
    console.log('   - Network/API errors');
    console.log('   - Console warnings and errors');
    console.log('   - Vite development errors');
    console.log('   - User interaction errors');
    console.log('   - Performance warnings');
    console.log('   - Memory usage warnings');
    console.log('   - Various API response codes');
    console.log('   - System and debug logs');

  } catch (error) {
    console.error('❌ Failed to create test logs:', error);
    await logger.logError('TestModule', 'Failed to create comprehensive test logs', error as Error);
  }
};