
import { logger } from '../services/loggingService';

export const createDemoLogs = async () => {
  // Create some demo logs for testing
  await logger.logAction('CottageForm', 'Cottage saved successfully', 'admin@example.com', 'admin@example.com', { cottageId: 'demo-cottage-1' });
  
  await logger.logError('ImageUpload', 'Failed to upload cottage image', new Error('Network timeout'), 'admin@example.com', 'admin@example.com');
  
  await logger.logAPI('POST', '/api/cottages', 201, 234, 'admin@example.com', 'admin@example.com');
  
  await logger.logAPI('GET', '/api/bank-accounts', 200, 156, 'admin@example.com', 'admin@example.com');
  
  await logger.logAction('BankAccount', 'Bank account linked to cottage', 'admin@example.com', 'admin@example.com', { 
    cottageId: 'demo-cottage-1', 
    bankAccount: 'GE29NB0000000101904917' 
  });
  
  await logger.logError('AuthContext', 'Session expired during cottage save', undefined, 'admin@example.com', 'admin@example.com');
  
  await logger.logAction('AdminLogs', 'Logs page accessed', 'admin@example.com', 'admin@example.com');
  
  console.log('✅ Demo logs created successfully');
};
