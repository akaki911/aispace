
// Unified Role-based Access Control Guards
// SOL-424: Role leakage prevention and proper route protection

const requireSuperAdmin = (req, res, next) => {
  console.log('🔐 [Guard] SUPER_ADMIN check:', {
    hasSession: !!req.session,
    userRole: req.session?.user?.role,
    route: req.originalUrl
  });

  if (!req.session?.user || req.session.user.role !== 'SUPER_ADMIN') {
    console.log('❌ [Guard] SUPER_ADMIN access denied:', {
      currentRole: req.session?.user?.role || 'none',
      route: req.originalUrl
    });

    return res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN access required',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'SUPER_ADMIN',
      currentRole: req.session?.user?.role || null
    });
  }

  console.log('✅ [Guard] SUPER_ADMIN access granted');
  next();
};

const requireProvider = (req, res, next) => {
  console.log('🔐 [Guard] PROVIDER check:', {
    hasSession: !!req.session,
    userRole: req.session?.user?.role,
    route: req.originalUrl
  });

  if (!req.session?.user || req.session.user.role !== 'PROVIDER') {
    console.log('❌ [Guard] PROVIDER access denied:', {
      currentRole: req.session?.user?.role || 'none',
      route: req.originalUrl
    });

    return res.status(403).json({
      success: false,
      error: 'Provider access required',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'PROVIDER',
      currentRole: req.session?.user?.role || null
    });
  }

  console.log('✅ [Guard] PROVIDER access granted');
  next();
};

const requireCustomer = (req, res, next) => {
  console.log('🔐 [Guard] CUSTOMER check:', {
    hasSession: !!req.session,
    userRole: req.session?.user?.role,
    route: req.originalUrl
  });

  if (!req.session?.user || req.session.user.role !== 'CUSTOMER') {
    console.log('❌ [Guard] CUSTOMER access denied:', {
      currentRole: req.session?.user?.role || 'none',
      route: req.originalUrl
    });

    return res.status(403).json({
      success: false,
      error: 'Customer access required',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRole: 'CUSTOMER',
      currentRole: req.session?.user?.role || null
    });
  }

  console.log('✅ [Guard] CUSTOMER access granted');
  next();
};

// Multi-role guard - allows specific roles
const requireAnyRole = (allowedRoles) => {
  return (req, res, next) => {
    console.log('🔐 [Guard] Multi-role check:', {
      allowedRoles,
      currentRole: req.session?.user?.role,
      route: req.originalUrl
    });

    if (!req.session?.user || !allowedRoles.includes(req.session.user.role)) {
      console.log('❌ [Guard] Multi-role access denied:', {
        allowedRoles,
        currentRole: req.session?.user?.role || 'none',
        route: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient role permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        allowedRoles,
        currentRole: req.session?.user?.role || null
      });
    }

    console.log('✅ [Guard] Multi-role access granted');
    next();
  };
};

// Authentication check (any valid session)
const requireAuthentication = (req, res, next) => {
  console.log('🔐 [Guard] Authentication check:', {
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    route: req.originalUrl
  });

  if (!req.session?.user) {
    console.log('❌ [Guard] Authentication required:', {
      route: req.originalUrl
    });

    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NOT_AUTHENTICATED'
    });
  }

  console.log('✅ [Guard] Authentication verified');
  next();
};

// Role derivation helper - determines deviceTrust based on role and device
const deriveRolePermissions = (user, deviceInfo = null) => {
  const permissions = {
    role: user.role,
    userId: user.id,
    deviceTrust: false,
    canAccessAdmin: false,
    canAccessProvider: false,
    canAccessCustomer: false
  };

  switch (user.role) {
    case 'SUPER_ADMIN':
      permissions.canAccessAdmin = true;
      // SOL-422: deviceTrust მხოლოდ Super Admin + Trusted Device
      permissions.deviceTrust = deviceInfo?.trusted === true;
      break;
    
    case 'PROVIDER':
      permissions.canAccessProvider = true;
      break;
    
    case 'CUSTOMER':
      permissions.canAccessCustomer = true;
      break;
  }

  return permissions;
};

module.exports = {
  requireSuperAdmin,
  requireProvider,
  requireCustomer,
  requireAnyRole,
  requireAuthentication,
  deriveRolePermissions
};
