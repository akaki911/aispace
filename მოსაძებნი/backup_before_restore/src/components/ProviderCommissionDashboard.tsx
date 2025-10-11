
import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, AlertTriangle, CheckCircle, Clock, Download, DollarSign, TrendingUp } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  paidDate?: string;
  periodStart: string;
  periodEnd: string;
  bookings: string[];
  bookingDetails?: any[];
}

interface CommissionSummary {
  totalEarnings: number;
  totalCommissions: number;
  unpaidAmount: number;
  invoiceCount: number;
  lastPaymentDate?: string;
}

interface ProviderCommissionDashboardProps {
  providerId: string;
  isBlocked?: boolean;
}

const ProviderCommissionDashboard: React.FC<ProviderCommissionDashboardProps> = ({ 
  providerId, 
  isBlocked = false 
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    fetchCommissionData();
  }, [providerId]);

  const fetchCommissionData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const [invoicesResponse, summaryResponse] = await Promise.all([
        fetch(`/api/commission/provider/${providerId}/invoices`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/commission/provider/${providerId}/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        setInvoices(invoicesData.invoices || []);
      }

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary);
      }
    } catch (error) {
      console.error('Error fetching commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'გადახდილი';
      case 'overdue':
        return 'ვადაგადაცილებული';
      default:
        return 'გადასახდელი';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'overdue':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Status Alert */}
      {isBlocked && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <div>
              <h4 className="font-semibold text-red-800 dark:text-red-200">
                ანგარიში შეჩერებულია
              </h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                თქვენი ლისტინგები არ არის ხილული მომხმარებლებისთვის გადაუხდელი კომისიის გამო.
                გთხოვთ გადაიხადოთ ₾{totalUnpaid.toFixed(2)} ანგარიშის აღსადგენად.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding Amount */}
      {totalUnpaid > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="w-5 h-5 text-yellow-600 mr-3" />
              <div>
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  გადასახდელი კომისია: ₾{totalUnpaid.toFixed(2)}
                </h4>
                <p className="text-sm text-yellow-600 dark:text-yellow-300">
                  {unpaidInvoices.length} გადაუხდელი ინვოისი
                </p>
              </div>
            </div>
            <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors">
              გადახდა
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">მთლიანი შემოსავალი</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ₾{summary.totalEarnings.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">გადახდილი კომისია</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ₾{(summary.totalCommissions - summary.unpaidAmount).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">გადაუხდელი კომისია</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ₾{summary.unpaidAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">სულ ინვოისები</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {summary.invoiceCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            ინვოისების ისტორია
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ინვოისი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  პერიოდი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  თანხა
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ვადა
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  სტატუსი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  მოქმედება
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {invoice.issueDate}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.periodStart} - {invoice.periodEnd}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    ₾{invoice.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.dueDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      <span className="ml-1">{getStatusText(invoice.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowInvoiceModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                    >
                      დეტალები
                    </button>
                    <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invoices.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">ინვოისები არ მოიძებნა</p>
          </div>
        )}
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  ინვოისის დეტალები - {selectedInvoice.invoiceNumber}
                </h3>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">გამოშვების თარიღი</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedInvoice.issueDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ვადა</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedInvoice.dueDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">პერიოდი</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedInvoice.periodStart} - {selectedInvoice.periodEnd}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">სტატუსი</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedInvoice.status)}`}>
                    {getStatusIcon(selectedInvoice.status)}
                    <span className="ml-1">{getStatusText(selectedInvoice.status)}</span>
                  </span>
                </div>
              </div>

              {selectedInvoice.bookingDetails && selectedInvoice.bookingDetails.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">ბრონირებები</h4>
                  <div className="space-y-2">
                    {selectedInvoice.bookingDetails.map((booking, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              ბრონირება #{booking.id?.slice(-6) || index + 1}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {booking.startDate} - {booking.endDate}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900 dark:text-white">
                              ₾{booking.totalPrice?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              კომისია: ₾{booking.commissionAmount?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    სულ კომისია:
                  </span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ₾{selectedInvoice.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedInvoice.status !== 'paid' && (
                <div className="flex justify-center pt-4">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    გადახდა
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderCommissionDashboard;
