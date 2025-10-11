
import React from 'react';
import { Navigate } from 'react-router-dom';
import RoleSelection from '../pages/RoleSelection';

const RoleSelectionWithDebug: React.FC = () => {
  // Only show role selection if debug=1 is in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isDebugMode = urlParams.get('debug') === '1';

  if (!isDebugMode) {
    console.log('🧭 [DEBUG] Role selection accessed without debug flag, redirecting to customer login');
    return <Navigate to="/login/customer" replace />;
  }

  console.log('🧭 [DEBUG] Role selection shown with debug flag');
  return <RoleSelection />;
};

export default RoleSelectionWithDebug;
