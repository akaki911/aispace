const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const commissionService = require('../services/commissionService');

const db = admin.firestore();

// Middleware to check admin access
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = { uid: decodedToken.uid, ...userDoc.data() };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Generate invoices manually (admin only)
router.post('/generate-invoices', requireAdmin, async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'Period start and end dates required' });
    }

    const invoices = await commissionService.generateInvoices(periodStart, periodEnd);
    res.json({ success: true, invoices, count: invoices.length });
  } catch (error) {
    console.error('Error generating invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all invoices (admin only)
router.get('/invoices', requireAdmin, async (req, res) => {
  try {
    const { providerId, status, limit = 50, offset = 0 } = req.query;

    let query = db.collection('invoices');

    if (providerId) {
      query = query.where('providerId', '==', providerId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('issueDate', 'desc').limit(parseInt(limit)).offset(parseInt(offset));

    const snapshot = await query.get();
    const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get provider names
    const providerIds = [...new Set(invoices.map(inv => inv.providerId))];
    const providers = {};

    if (providerIds.length > 0) {
      const providerDocs = await db.getAll(...providerIds.map(id => db.collection('providers').doc(id)));
      providerDocs.forEach(doc => {
        if (doc.exists) {
          providers[doc.id] = doc.data().name;
        }
      });
    }

    // Add provider names to invoices
    invoices.forEach(invoice => {
      invoice.providerName = providers[invoice.providerId] || 'Unknown';
    });

    res.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific invoice details
router.get('/invoices/:invoiceId', requireAdmin, async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };

    // Get provider details
    const providerDoc = await db.collection('providers').doc(invoice.providerId).get();
    invoice.provider = providerDoc.exists ? providerDoc.data() : null;

    // Get booking details
    if (invoice.bookings && invoice.bookings.length > 0) {
      const bookingDocs = await db.getAll(...invoice.bookings.map(id => db.collection('bookings').doc(id)));
      invoice.bookingDetails = bookingDocs.map(doc => doc.exists ? { id: doc.id, ...doc.data() } : null).filter(Boolean);
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark invoice as paid (admin only)
router.post('/invoices/:invoiceId/mark-paid', requireAdmin, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { method, reference } = req.body;

    await commissionService.markInvoicePaid(invoiceId, { method, reference });
    res.json({ success: true, message: 'Invoice marked as paid' });
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provider commission summary (provider or admin)
router.get('/provider/:providerId/summary', async (req, res) => {
  try {
    const { providerId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    // Check if user is admin or the provider themselves
    if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().providerId !== providerId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await commissionService.getProviderCommissionSummary(providerId);
    res.json({ summary });
  } catch (error) {
    console.error('Error getting provider summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provider's invoices
router.get('/provider/:providerId/invoices', async (req, res) => {
  try {
    const { providerId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    // Check if user is admin or the provider themselves
    if (!userDoc.exists || (userDoc.data().role !== 'admin' && userDoc.data().providerId !== providerId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const snapshot = await db.collection('invoices')
      .where('providerId', '==', providerId)
      .orderBy('issueDate', 'desc')
      .get();

    const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ invoices });
  } catch (error) {
    console.error('Error fetching provider invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update provider commission rate (admin only)
router.put('/provider/:providerId/commission-rate', requireAdmin, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { rate, model = 'percentage' } = req.body;

    if (!rate || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'Invalid commission rate' });
    }

    await db.collection('providers').doc(providerId).update({
      customCommission: { model, rate },
      updatedAt: new Date()
    });

    res.json({ success: true, message: 'Commission rate updated' });
  } catch (error) {
    console.error('Error updating commission rate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enforce payment checks (admin only)
router.post('/enforce-payments', requireAdmin, async (req, res) => {
  try {
    await commissionService.enforcePayments();
    res.json({ success: true, message: 'Payment enforcement completed' });
  } catch (error) {
    console.error('Error enforcing payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send payment reminders (admin only)
router.post('/send-reminders', requireAdmin, async (req, res) => {
  try {
    await commissionService.sendPaymentReminders();
    res.json({ success: true, message: 'Payment reminders sent' });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get commission statistics (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = db.collection('invoices');

    if (startDate) {
      query = query.where('issueDate', '>=', startDate);
    }

    if (endDate) {
      query = query.where('issueDate', '<=', endDate);
    }

    const snapshot = await query.get();
    const invoices = snapshot.docs.map(doc => doc.data());

    const stats = {
      totalInvoices: invoices.length,
      totalCommission: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paidCommission: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0),
      unpaidCommission: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0),
      overdueInvoices: invoices.filter(inv => inv.status === 'overdue').length
    };

    stats.totalCommission = Math.round(stats.totalCommission * 100) / 100;
    stats.paidCommission = Math.round(stats.paidCommission * 100) / 100;
    stats.unpaidCommission = Math.round(stats.unpaidCommission * 100) / 100;

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching commission stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;