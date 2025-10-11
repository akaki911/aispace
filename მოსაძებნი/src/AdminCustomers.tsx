import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Phone, Calendar, Shield, Trash2, Eye, UserCheck, UserX, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { User } from './types/user';
import { getAllUsers, deleteUser, updateUser, canDeleteUser } from './services/userService';
import { useAuth } from './contexts/useAuth';
import { usePermissions } from './hooks/usePermissions';
import { useTheme } from './contexts/useTheme';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<User | null>(null);

  const { user: currentUser } = useAuth();
  const { canManageUsers } = usePermissions();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();

  const hasPermission = canManageUsers();

  useEffect(() => {
    if (!hasPermission) {
      navigate('/admin');
      return;
    }
    loadCustomers();
  }, [hasPermission, navigate]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const userList = await getAllUsers();
      console.log(`👥 Loaded ${userList.length} total users`);

      // Filter to show ONLY customers
      const customerUsers = userList.filter(user => {
        const isCustomer = user.role === 'CUSTOMER';

        if (isCustomer) {
          console.log(`✅ Including customer: "${user.firstName} ${user.lastName}" with role "${user.role}"`);
        }

        return isCustomer;
      });

      console.log(`👤 AdminCustomers page: Showing ${customerUsers.length} customers out of ${userList.length} total users`);

      setCustomers(customerUsers);
    } catch (err) {
      console.error('Error loading customers:', err);
      setError('შეცდომა მომხმარებლების ჩატვირთვისას');
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerStatus = async (customerId: string, isActive: boolean) => {
    if (processing) return;

    try {
      setProcessing(true);
      await updateUser(customerId, { isActive });

      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, isActive, updatedAt: new Date() } : c
      ));

      alert(`მომხმარებელი ${isActive ? 'აქტივირდა' : 'დეაქტივირდა'}`);
    } catch (err) {
      console.error('Error updating customer status:', err);
      alert('შეცდომა სტატუსის განახლებისას');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCustomer = (customer: User) => {
    if (!canDeleteUser(customer)) {
      alert('ამ მომხმარებლის წაშლა შეუძლებელია');
      return;
    }
    setCustomerToDelete(customer);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      setProcessing(true);
      await deleteUser(customerToDelete.id);

      // Remove from local state and reload
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      await loadCustomers();

      alert('მომხმარებელი წარმატებით წაიშალა');
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      alert(error.message || 'მომხმარებლის წაშლისას მოხდა შეცდომა');
    } finally {
      setProcessing(false);
      setShowDeleteConfirm(false);
      setCustomerToDelete(null);
    }
  };

  // Permission check
  if (!hasPermission) {
    return (
      <div className="p-8">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">წვდომა შეზღუდულია</h3>
          <p className="text-gray-500 mb-4">თქვენ არ გაქვთ მომხმარებლების მართვის უფლება</p>
          <button
            onClick={() => navigate('/admin')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            მთავარ გვერდზე დაბრუნება
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">მომხმარებლების ჩატვირთვა...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">შეცდომა</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadCustomers}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            თავიდან ცდა
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">მომხმარებლები (Customers)</h1>
          <p className="text-gray-600">რეგისტრირებული მომხმარებლები-ჯავშნის გამკეთებლები ({customers.length})</p>
        </div>

         <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleTheme}
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-md dark:shadow-lg border border-gray-300 dark:border-gray-600"
                >
                  {isDarkMode ? <Sun className="w-5 h-5 mr-2" /> : <Moon className="w-5 h-5 mr-2" />}
                  <span className="font-bold">{isDarkMode ? 'ნათელი რეჟიმი' : 'მუქი რეჟიმი'}</span>
                </motion.button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  მომხმარებელი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ტელეფონი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  პირადი ნომერი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  სტატუსი
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  რეგისტრაცია
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  მოქმედებები
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{customer.email || 'ელ-ფოსტა არ არის'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      {customer.phoneNumber || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {customer.personalId || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      customer.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {customer.isActive ? (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          აქტიური
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 mr-1" />
                          არააქტიური
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('ka-GE') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => toggleCustomerStatus(customer.id, !customer.isActive)}
                        disabled={processing}
                        className={`${
                          customer.isActive 
                            ? 'text-orange-600 hover:text-orange-900' 
                            : 'text-green-600 hover:text-green-900'
                        } disabled:opacity-50 transition-colors`}
                        title={customer.isActive ? 'დეაქტივაცია' : 'აქტივაცია'}
                      >
                        {customer.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer)}
                        disabled={processing}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
                        title="წაშლა"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {customers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">მომხმარებლები ვერ მოიძებნა</p>
            <p className="text-gray-400 text-sm">მომხმარებლები ავტომატურად ემატება ჯავშნისას</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && customerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">მომხმარებლის წაშლის დადასტურება</h3>
            <p className="text-gray-600 mb-6">
              დარწმუნებული ხართ, რომ გსურთ წაშალოთ მომხმარებელი{' '}
              <span className="font-semibold">{customerToDelete.firstName} {customerToDelete.lastName}</span>?
              <br />
              <span className="text-red-600 text-sm">ეს მოქმედება შეუქცევადია და წაიშლება Firebase-დანაც.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCustomerToDelete(null);
                }}
                disabled={processing}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                გაუქმება
              </button>
              <button
                onClick={confirmDeleteCustomer}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {processing ? 'იშლება...' : 'წაშლა'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}