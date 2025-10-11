import jsPDF from 'jspdf';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface InvoiceData {
  // Customer info (can come from customerInfo object or legacy fields)
  customerInfo?: {
    firstName: string;
    lastName: string;
    personalId: string;
    phoneNumber: string;
    email?: string;
    userId?: string;
    source?: string;
  };

  // Legacy customer fields (for backward compatibility)
  firstName?: string;
  lastName?: string;
  phone?: string;
  personalId?: string;

  // Booking details
  cottageId: string;
  cottageName: string;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;

  // Pricing
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  customTotalPrice?: number;
  useCustomPrice?: boolean;

  // Additional info
  notes?: string;
  createdAt: Date;
  userId?: string;
}

export const generateInvoicePdf = async (bookingData: InvoiceData): Promise<void> => {
  try {
    // Extract customer info with priority: customerInfo > legacy fields > Firestore lookup
    let customerInfo = bookingData.customerInfo;

    // If no customerInfo but we have userId, fetch from Firestore
    if (!customerInfo && bookingData.userId) {
      console.log('🔍 Customer info not found in booking, fetching from Firestore...');
      try {
        const userDoc = await getDoc(doc(db, 'users', bookingData.userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          customerInfo = {
            firstName: userData.firstName,
            lastName: userData.lastName,
            personalId: userData.personalId,
            phoneNumber: userData.phoneNumber,
            email: userData.email,
            userId: bookingData.userId,
            source: 'firestore_lookup'
          };
          console.log('✅ Customer info loaded from Firestore');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load user from Firestore:', error);
      }
    }

    // Fallback to legacy fields if still no customerInfo
    if (!customerInfo) {
      customerInfo = {
        firstName: bookingData.firstName || '',
        lastName: bookingData.lastName || '',
        personalId: bookingData.personalId || '',
        phoneNumber: bookingData.phone || '',
        source: 'legacy_fields'
      };
    }

    console.log('📄 Generating PDF invoice for:', customerInfo.firstName, customerInfo.lastName);
    console.log('📋 Customer info source:', customerInfo.source);

    // Get cottage details for bank account
    let cottageData: any = null;
    if (bookingData.cottageId) {
      const cottageDoc = await getDoc(doc(db, 'cottages', bookingData.cottageId));
      if (cottageDoc.exists()) {
        cottageData = cottageDoc.data();
      }
    }

    // Create PDF
    const pdf = new jsPDF();

    // Set font
    pdf.setFont('helvetica');

    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(41, 98, 255); // Blue color
    pdf.text('🏠 ჯავშნის ინვოისი', 20, 30);

    // Invoice details
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`ინვოისის თარიღი: ${new Date().toLocaleDateString('ka-GE')}`, 20, 45);
    pdf.text(`ჯავშნის თარიღი: ${bookingData.createdAt.toLocaleDateString('ka-GE')}`, 20, 55);

    // Customer information
    pdf.setFontSize(14);
    pdf.setTextColor(51, 51, 51);
    pdf.text('მომხმარებლის მონაცემები:', 20, 75);

    pdf.setFontSize(11);
    pdf.text(`სახელი: ${customerInfo.firstName} ${customerInfo.lastName}`, 20, 90);
    pdf.text(`ტელეფონი: ${customerInfo.phoneNumber}`, 20, 100);
    pdf.text(`პირადი ნომერი: ${customerInfo.personalId}`, 20, 110);

    // Show source info if from registered user
    if (customerInfo.source === 'authenticated' || customerInfo.source === 'firestore_lookup') {
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128);
      pdf.text('მომხმარებელი რეგისტრირებულია სისტემაში — მონაცემები აღებულია მომხმარებლის პროფილიდან', 20, 120);
      pdf.setTextColor(0, 0, 0);
    }

    // Cottage and booking details
    pdf.setFontSize(14);
    pdf.setTextColor(51, 51, 51);
    pdf.text('ჯავშნის დეტალები:', 20, 130);

    pdf.setFontSize(11);
    pdf.text(`კოტეჯი: ${bookingData.cottageName}`, 20, 145);
    pdf.text(`მოსვლის თარიღი: ${bookingData.startDate.toLocaleDateString('ka-GE')}`, 20, 155);
    pdf.text(`წასვლის თარიღი: ${bookingData.endDate.toLocaleDateString('ka-GE')}`, 20, 165);

    // Calculate nights
    const nights = Math.ceil((bookingData.endDate.getTime() - bookingData.startDate.getTime()) / (1000 * 60 * 60 * 24));
    pdf.text(`ღამეების რაოდენობა: ${nights}`, 20, 175);
    pdf.text(`ზრდასრულები: ${bookingData.adults}`, 20, 185);
    pdf.text(`ბავშვები: ${bookingData.children}`, 20, 195);

    // Pricing information
    pdf.setFontSize(14);
    pdf.setTextColor(51, 51, 51);
    pdf.text('ფასების დეტალები:', 20, 215);

    pdf.setFontSize(11);
    const finalTotalPrice = bookingData.useCustomPrice && bookingData.customTotalPrice 
      ? bookingData.customTotalPrice 
      : bookingData.totalPrice;

    if (bookingData.useCustomPrice && bookingData.customTotalPrice) {
      pdf.text(`ინდივიდუალური ფასი: ${bookingData.customTotalPrice}₾`, 20, 230);
    } else {
      pdf.text(`ჯამური ღირებულება: ${bookingData.totalPrice}₾`, 20, 230);
    }

    pdf.text(`ჯავშნის გასააქტიურებელი თანხა: ${bookingData.depositAmount}₾`, 20, 240);
    pdf.text(`დარჩენილი თანხა (ჩეკინზე): ${finalTotalPrice - bookingData.depositAmount}₾`, 20, 250);

    // Bank details if available
    if (cottageData?.bankAccount) {
      pdf.setFontSize(14);
      pdf.setTextColor(51, 51, 51);
      pdf.text('ბანკის რეკვიზიტები:', 20, 270);

      pdf.setFontSize(11);
      pdf.text(`ანგარიშის ნომერი: ${cottageData.bankAccount}`, 20, 285);
      pdf.text('გადახდა შესაძლებელია ჩეკინის დღეს ქეშად ან ანგარიშზე გადარიცხვით', 20, 295);
    }

    // Footer
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
    pdf.text('ინვოისი გენერირებულია ავტომატურად', 20, 280);
    pdf.text('დამატებითი ინფორმაციისთვის დაკავშირდით პროვაიდერთან', 20, 290);

    // Generate filename
    const startDateStr = bookingData.startDate.toLocaleDateString('ka-GE').replace(/\//g, '.');
    const endDateStr = bookingData.endDate.toLocaleDateString('ka-GE').replace(/\//g, '.');
    const filename = `invoice_${customerInfo.firstName}_${customerInfo.lastName}_${startDateStr}-${endDateStr}.pdf`;

    // Download PDF
    pdf.save(filename);

    console.log('✅ PDF invoice generated successfully:', filename);

  } catch (error) {
    console.error('❌ Error generating PDF invoice:', error);
    throw new Error('PDF ინვოისის გენერაცია ვერ მოხერხდა');
  }
};

export const downloadInvoice = async (bookingData: InvoiceData): Promise<void> => {
  try {
    await generateInvoicePdf(bookingData);
  } catch (error) {
    console.error('❌ Error downloading invoice:', error);
    alert('ინვოისის ჩამოტვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
  }
};