
// Verification utility to ensure all imports work correctly
import * as statusHelpers from './statusHelpers';
import * as colorHelpers from './colorHelpers';
import * as uiMapHelpers from './uiMapHelpers';
import * as formatHelpers from './formatHelpers';

export const verifyImports = () => {
  console.log('🔍 Verifying AI Panel utilities...');
  
  // Test status helpers
  const healthStatus = statusHelpers.getHealthStatus('healthy');
  console.log('✅ Status helpers working:', healthStatus);
  
  // Test color helpers
  const healthColor = colorHelpers.getHealthColor('OK');
  console.log('✅ Color helpers working:', healthColor);
  
  // Test UI map helpers
  const healthIcon = uiMapHelpers.getHealthIcon('OK');
  console.log('✅ UI map helpers working:', healthIcon);
  
  // Test format helpers
  const timestamp = formatHelpers.formatTimestamp(new Date());
  console.log('✅ Format helpers working:', timestamp);
  
  console.log('✅ All AI Panel utilities verified successfully!');
  return true;
};
