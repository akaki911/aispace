
module.exports = function requireAdminSetupToken(req, res, next) {
  // allow if already authenticated as admin/super-admin
  if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')) {
    return next();
  }

  const headerToken = req.header('x-admin-setup-token');
  
  console.log('🔐 Admin Setup Token Check:', {
    hasToken: !!headerToken,
    tokenLength: headerToken ? headerToken.length : 0,
    isDevelopment: process.env.NODE_ENV === 'development'
  });

  if (!headerToken) {
    console.log('❌ No admin setup token provided');
    return res.status(401).json({ error: 'Admin setup token required' });
  }

  // In development, accept tokens with specific prefixes
  const isValidDevToken = process.env.NODE_ENV === 'development' && 
    (headerToken.startsWith('DEV_ADMIN_SETUP_TOKEN_') || 
     headerToken.startsWith('admin_setup_token_') ||
     headerToken.startsWith('DEV_')) && 
    headerToken.length >= 20;

  // Production token validation
  const expectedToken = process.env.ADMIN_SETUP_TOKEN || 'DEV_OK';
  const isValidProdToken = headerToken === expectedToken;

  if (!isValidDevToken && !isValidProdToken) {
    console.log('❌ Invalid admin setup token provided');
    return res.status(401).json({ 
      error: 'Invalid admin setup token',
      debug: {
        tokenLength: headerToken.length,
        expectedLength: expectedToken.length,
        isValidDevFormat: headerToken.startsWith('DEV_') || headerToken.startsWith('admin_setup_token_')
      }
    });
  }
  
  console.log('✅ Admin setup token validated successfully');
  return next();
};
