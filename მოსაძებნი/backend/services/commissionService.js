const admin = require('firebase-admin');

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  try {
    // Security check for production environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ Commission Service: Running Firebase Admin in non-production mode');
    }

    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'bakhmaro-cottages',
    });

    if (process.env.NODE_ENV === 'production') {
      console.log('✅ Firebase Admin initialized in commissionService [PRODUCTION]');
    } else {
      console.log('✅ Firebase Admin initialized in commissionService [DEV MODE]');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
  }
}

const db = admin.firestore();

class CommissionService {
  constructor() {
    this.defaultRates = {
      hotel: 0.15,      // 15% for hotels/cottages
      vehicle: 0.20,    // 20% for vehicles
      horse: 0.20,      // 20% for horses  
      snowmobile: 0.20, // 20% for snowmobiles
      equipment: 0.20   // 20% for equipment
    };
  }

  // Calculate commission for a booking
  async calculateCommission(booking) {
    try {
      const provider = await db.collection('providers').doc(booking.providerId).get();
      if (!provider.exists) {
        throw new Error('Provider not found');
      }

      const providerData = provider.data();
      let commissionRate;

      // Use custom rate if exists, otherwise use default
      if (providerData.customCommission && providerData.customCommission.rate) {
        commissionRate = providerData.customCommission.rate;
      } else if (providerData.defaultCommission && providerData.defaultCommission.rate) {
        commissionRate = providerData.defaultCommission.rate;
      } else {
        // Fallback to system default based on listing type
        const listingType = this.getListingType(booking.listingType);
        commissionRate = this.defaultRates[listingType] || 0.15;
      }

      const commissionAmount = Math.round(booking.totalPrice * commissionRate * 100) / 100;

      return {
        rate: commissionRate,
        amount: commissionAmount,
        totalPrice: booking.totalPrice
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      throw error;
    }
  }

  // Get listing type from booking
  getListingType(listingType) {
    const typeMap = {
      'cottage': 'hotel',
      'hotel': 'hotel',
      'car': 'vehicle',
      'vehicle': 'vehicle',
      'horse': 'horse',
      'snowmobile': 'snowmobile'
    };
    return typeMap[listingType] || 'hotel';
  }

  // Generate invoices for a specific period
  async generateInvoices(periodStart, periodEnd) {
    try {
      console.log(`🧾 Generating invoices for period: ${periodStart} to ${periodEnd}`);

      // Get all completed bookings that haven't been invoiced yet
      const bookingsQuery = await db.collection('bookings')
        .where('status', '==', 'completed')
        .where('completedDate', '>=', periodStart)
        .where('completedDate', '<=', periodEnd)
        .where('invoiceId', '==', null)
        .get();

      if (bookingsQuery.empty) {
        console.log('No bookings to invoice for this period');
        return [];
      }

      // Group bookings by provider
      const bookingsByProvider = {};
      bookingsQuery.docs.forEach(doc => {
        const booking = { id: doc.id, ...doc.data() };
        if (!bookingsByProvider[booking.providerId]) {
          bookingsByProvider[booking.providerId] = [];
        }
        bookingsByProvider[booking.providerId].push(booking);
      });

      const invoices = [];
      const batch = db.batch();

      // Create invoice for each provider
      for (const [providerId, bookings] of Object.entries(bookingsByProvider)) {
        const totalAmount = bookings.reduce((sum, booking) => sum + (booking.commissionAmount || 0), 0);

        if (totalAmount <= 0) continue;

        const invoiceRef = db.collection('invoices').doc();
        const invoice = {
          providerId: providerId,
          issueDate: new Date().toISOString().split('T')[0],
          periodStart: periodStart,
          periodEnd: periodEnd,
          totalAmount: Math.round(totalAmount * 100) / 100,
          status: 'unpaid',
          dueDate: this.calculateDueDate(new Date()),
          paidDate: null,
          bookings: bookings.map(b => b.id),
          invoiceNumber: await this.generateInvoiceNumber()
        };

        batch.set(invoiceRef, invoice);

        // Mark bookings as invoiced
        bookings.forEach(booking => {
          const bookingRef = db.collection('bookings').doc(booking.id);
          batch.update(bookingRef, { invoiceId: invoiceRef.id });
        });

        // Update provider's outstanding balance
        const providerRef = db.collection('providers').doc(providerId);
        batch.update(providerRef, {
          totalOutstanding: admin.firestore.FieldValue.increment(invoice.totalAmount)
        });

        invoices.push({ id: invoiceRef.id, ...invoice });
      }

      await batch.commit();
      console.log(`✅ Generated ${invoices.length} invoices`);
      return invoices;

    } catch (error) {
      console.error('Error generating invoices:', error);
      throw error;
    }
  }

  // Calculate due date (5 days from issue)
  calculateDueDate(issueDate) {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 5);
    return dueDate.toISOString().split('T')[0];
  }

  // Generate invoice number
  async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const counterRef = db.collection('counters').doc('invoices');

    try {
      const result = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newCount = 1;

        if (counterDoc.exists) {
          const data = counterDoc.data();
          if (data.year === year) {
            newCount = (data.count || 0) + 1;
          }
        }

        transaction.set(counterRef, { count: newCount, year: year });
        return newCount;
      });

      return `INV-${year}-${result.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return `INV-${year}-${Date.now()}`;
    }
  }

  // Check for overdue payments and suspend providers
  async enforcePayments() {
    try {
      console.log('🔍 Checking for overdue payments...');

      const today = new Date().toISOString().split('T')[0];
      const overdueQuery = await db.collection('invoices')
        .where('status', '==', 'unpaid')
        .where('dueDate', '<', today)
        .get();

      if (overdueQuery.empty) {
        console.log('No overdue invoices found');
        return;
      }

      const batch = db.batch();
      const suspendedProviders = new Set();

      overdueQuery.docs.forEach(doc => {
        const invoice = doc.data();
        suspendedProviders.add(invoice.providerId);

        // Update invoice status to overdue
        batch.update(doc.ref, { status: 'overdue' });
      });

      // Suspend providers and their listings
      for (const providerId of suspendedProviders) {
        const providerRef = db.collection('providers').doc(providerId);
        batch.update(providerRef, { isBlocked: true, blockedDate: new Date() });

        // Suspend all listings for this provider
        const listingsQuery = await db.collection('listings')
          .where('providerId', '==', providerId)
          .get();

        listingsQuery.docs.forEach(listingDoc => {
          batch.update(listingDoc.ref, { status: 'suspended' });
        });
      }

      await batch.commit();
      console.log(`⚠️ Suspended ${suspendedProviders.size} providers for overdue payments`);

    } catch (error) {
      console.error('Error enforcing payments:', error);
      throw error;
    }
  }

  // Send payment reminders
  async sendPaymentReminders() {
    try {
      console.log('📧 Sending payment reminders...');

      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 2);
      const reminderDateStr = reminderDate.toISOString().split('T')[0];

      const remindersQuery = await db.collection('invoices')
        .where('status', '==', 'unpaid')
        .where('dueDate', '==', reminderDateStr)
        .get();

      if (remindersQuery.empty) {
        console.log('No payment reminders to send');
        return;
      }

      for (const doc of remindersQuery.docs) {
        const invoice = doc.data();

        // Get provider details
        const providerDoc = await db.collection('providers').doc(invoice.providerId).get();
        if (!providerDoc.exists) continue;

        const provider = providerDoc.data();

        // Send reminder (you can integrate with email service here)
        console.log(`📧 Reminder sent to ${provider.name}: Invoice ${invoice.invoiceNumber} (₾${invoice.totalAmount}) due on ${invoice.dueDate}`);

        // Mark reminder as sent
        await doc.ref.update({ 
          reminderSent: true, 
          reminderDate: new Date() 
        });
      }

    } catch (error) {
      console.error('Error sending payment reminders:', error);
      throw error;
    }
  }

  // Mark invoice as paid and unblock provider
  async markInvoicePaid(invoiceId, paymentDetails = {}) {
    try {
      const batch = db.batch();

      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const invoiceDoc = await invoiceRef.get();

      if (!invoiceDoc.exists) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceDoc.data();

      // Update invoice
      batch.update(invoiceRef, {
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0],
        paymentMethod: paymentDetails.method || 'manual',
        paymentReference: paymentDetails.reference || null
      });

      // Update provider's outstanding balance
      const providerRef = db.collection('providers').doc(invoice.providerId);
      batch.update(providerRef, {
        totalOutstanding: admin.firestore.FieldValue.increment(-invoice.totalAmount)
      });

      // Check if provider has any other unpaid invoices
      const unpaidQuery = await db.collection('invoices')
        .where('providerId', '==', invoice.providerId)
        .where('status', 'in', ['unpaid', 'overdue'])
        .get();

      // If no other unpaid invoices, unblock provider
      if (unpaidQuery.docs.filter(doc => doc.id !== invoiceId).length === 0) {
        batch.update(providerRef, { 
          isBlocked: false, 
          blockedDate: null 
        });

        // Reactivate all listings
        const listingsQuery = await db.collection('listings')
          .where('providerId', '==', invoice.providerId)
          .get();

        listingsQuery.docs.forEach(listingDoc => {
          batch.update(listingDoc.ref, { status: 'active' });
        });
      }

      await batch.commit();
      console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid, provider unblocked if applicable`);

    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      throw error;
    }
  }

  // Get provider commission summary
  async getProviderCommissionSummary(providerId) {
    try {
      const [invoicesQuery, bookingsQuery] = await Promise.all([
        db.collection('invoices').where('providerId', '==', providerId).get(),
        db.collection('bookings').where('providerId', '==', providerId).where('status', '==', 'completed').get()
      ]);

      const invoices = invoicesQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalEarnings = bookingsQuery.docs.reduce((sum, doc) => sum + (doc.data().totalPrice || 0), 0);
      const totalCommissions = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const unpaidAmount = invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0);

      return {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalCommissions: Math.round(totalCommissions * 100) / 100,
        unpaidAmount: Math.round(unpaidAmount * 100) / 100,
        invoiceCount: invoices.length,
        lastPaymentDate: invoices.filter(inv => inv.status === 'paid').sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate))[0]?.paidDate || null
      };
    } catch (error) {
      console.error('Error getting provider commission summary:', error);
      throw error;
    }
  }
}

module.exports = new CommissionService();