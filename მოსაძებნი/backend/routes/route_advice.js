const express = require('express');
const router = express.Router();
const auditService = require('../services/audit_service');

// Mount at /api/auth/route-advice as route advice for login flow
router.get('/', (req, res) => {
  try {
    const session = req.session || {};
    const user = session.user || null;
    const userRole = user?.role || session.userRole || null;
    const isAuthenticated = session.isAuthenticated === true || !!user;

    const isDeviceTrusted = Boolean(
      session.deviceTrusted === true ||
      session.deviceRecognition?.device?.trusted === true ||
      session.trustedDevice === true
    );

    if (isAuthenticated && userRole) {
      let target = '/dashboard';
      let reason = 'authenticated_user';

      if (userRole === 'SUPER_ADMIN') {
        target = '/admin';
        reason = 'authenticated_super_admin';
      } else if (userRole === 'CUSTOMER') {
        target = '/dashboard';
        reason = 'authenticated_customer';
      }

      const response = {
        success: true,
        role: userRole,
        deviceTrust: isDeviceTrusted,
        target,
        reason,
        authenticated: true
      };

      if (auditService?.logRouteDecision) {
        auditService
          .logRouteDecision(user?.id || session.userId || null, userRole, target, reason, req)
          .catch((auditError) => {
            console.warn('⚠️ [ROUTE] Failed to log route decision:', auditError);
          });
      }

      return res.json(response);
    }

    const fallback = {
      success: true,
      role: null,
      deviceTrust: false,
      target: '/login/customer',
      reason: 'default_fallback',
      authenticated: false
    };

    if (auditService?.logRouteDecision) {
      auditService
        .logRouteDecision(null, null, fallback.target, fallback.reason, req)
        .catch((auditError) => {
          console.warn('⚠️ [ROUTE] Failed to log fallback decision:', auditError);
        });
    }

    return res.json(fallback);
  } catch (error) {
    console.error('❌ [ROUTE] Route advice error:', error);

    return res.json({
      success: true,
      role: null,
      deviceTrust: false,
      target: '/login/customer',
      reason: 'error_fallback',
      authenticated: false
    });
  }
});

module.exports = router;
