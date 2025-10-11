'use strict';

const admin = require('firebase-admin');
const { logger } = require('firebase-functions/logger');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const commissionService = require('../backend/services/commissionService');

const generateInvoicesScheduled = onSchedule(
  {
    schedule: '0 2 1,15 * *',
    timeZone: 'Asia/Tbilisi',
    retryCount: 3,
  },
  async () => {
    try {
      logger.info('🕐 Starting scheduled invoice generation...');

      const now = new Date();
      const isFirstHalf = now.getDate() === 1;

      let periodStart;
      let periodEnd;

      if (isFirstHalf) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 16);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        periodStart = prevMonth.toISOString().split('T')[0];
        periodEnd = lastDay.toISOString().split('T')[0];
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split('T')[0];
      }

      const invoices = await commissionService.generateInvoices(periodStart, periodEnd);
      logger.info('✅ Generated %d invoices for period %s to %s', invoices.length, periodStart, periodEnd);
    } catch (error) {
      logger.error('❌ Error in scheduled invoice generation', error);
      throw error;
    }
  }
);

const sendPaymentRemindersScheduled = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Asia/Tbilisi',
    retryCount: 3,
  },
  async () => {
    try {
      logger.info('📧 Starting scheduled payment reminders...');

      await commissionService.sendPaymentReminders();
      logger.info('✅ Payment reminders sent successfully');
    } catch (error) {
      logger.error('❌ Error sending payment reminders', error);
      throw error;
    }
  }
);

const enforcePaymentsScheduled = onSchedule(
  {
    schedule: '0 10 * * *',
    timeZone: 'Asia/Tbilisi',
    retryCount: 3,
  },
  async () => {
    try {
      logger.info('⚖️ Starting scheduled payment enforcement...');

      await commissionService.enforcePayments();
      logger.info('✅ Payment enforcement completed successfully');
    } catch (error) {
      logger.error('❌ Error in payment enforcement', error);
      throw error;
    }
  }
);

const onBookingCompleted = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const newValue = event.data?.after?.data();
  const previousValue = event.data?.before?.data();

  if (!newValue || !previousValue) {
    return;
  }

  try {
    if (newValue.status === 'completed' && previousValue.status !== 'completed') {
      logger.info('📋 Booking %s completed, calculating commission...', event.params.bookingId);

      const commission = await commissionService.calculateCommission({
        providerId: newValue.providerId,
        totalPrice: newValue.totalPrice,
        listingType: newValue.listingType || 'hotel',
      });

      await event.data.after.ref.update({
        commissionRate: commission.rate,
        commissionAmount: commission.amount,
        completedDate: new Date().toISOString().split('T')[0],
      });

      logger.info('✅ Commission calculated for booking %s: ₾%d', event.params.bookingId, commission.amount);
    }
  } catch (error) {
    logger.error('❌ Error calculating commission for booking', error, { bookingId: event.params.bookingId });
    throw error;
  }
});

const handleInvoicePayment = onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const { invoiceId, paymentMethod, reference } = req.body || {};

    if (!invoiceId) {
      res.status(400).send('Invoice ID required');
      return;
    }

    logger.info('💳 Processing payment for invoice %s', invoiceId);

    await commissionService.markInvoicePaid(invoiceId, {
      method: paymentMethod || 'webhook',
      reference,
    });

    logger.info('✅ Payment processed for invoice %s', invoiceId);

    res.status(200).json({ success: true, message: 'Payment processed successfully' });
  } catch (error) {
    logger.error('❌ Error processing payment webhook', error);
    res.status(500).json({ error: error.message });
  }
});

const updateProviderCommissionRate = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'User must be admin');
    }

    const { providerId, rate, model = 'percentage' } = request.data || {};

    if (!providerId || !rate || rate < 0 || rate > 1) {
      throw new HttpsError('invalid-argument', 'Invalid provider ID or commission rate');
    }

    await db.collection('providers').doc(providerId).update({
      customCommission: { model, rate },
      updatedAt: new Date(),
      updatedBy: request.auth.uid,
    });

    logger.info('✅ Updated commission rate for provider %s to %d%%', providerId, rate * 100);

    return { success: true, message: 'Commission rate updated successfully' };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error('❌ Error updating commission rate', error);
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  generateInvoicesScheduled,
  sendPaymentRemindersScheduled,
  enforcePaymentsScheduled,
  onBookingCompleted,
  handleInvoicePayment,
  updateProviderCommissionRate,
};
