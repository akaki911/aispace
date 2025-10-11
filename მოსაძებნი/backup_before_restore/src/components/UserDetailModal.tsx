
import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Star, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getUserStats, type UserStats } from '../services/userStatsService';
import { User } from '../types/user';

interface UserDetailModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserDetailModal({ user, isOpen, onClose }: UserDetailModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserStats();
    }
  }, [isOpen, user]);

  const fetchUserStats = async () => {
    setLoading(true);
    try {
      const userStats = await getUserStats(user.id);
      setStats(userStats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">👤 მომხმარებლის დეტალები</h2>
            <p className="text-gray-600">{user.firstName} {user.lastName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">სტატისტიკა იტვირთება...</span>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* მომხმარებლის ძირითადი ინფორმაცია */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">ძირითადი ინფორმაცია</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">სახელი</label>
                    <p className="text-gray-800">{user.firstName} {user.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">როლი</label>
                    <p className="text-gray-800">
                      {user.role === 'SUPER_ADMIN' ? 'სუპერ ადმინი' :
                       user.role === 'PROVIDER_ADMIN' ? 'პროვაიდერ ადმინი' :
                       user.role === 'CUSTOMER' ? 'მომხმარებელი' : user.role}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ელ-ფოსტა</label>
                    <p className="text-gray-800">{user.email || 'არ არის მითითებული'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ტელეფონი</label>
                    <p className="text-gray-800">{user.phoneNumber || 'არ არის მითითებული'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">რეგისტრაციის თარიღი</label>
                    <p className="text-gray-800">{new Date(user.createdAt).toLocaleDateString('ka-GE')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">სტატუსი</label>
                    <p className={`font-medium ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {user.isActive ? 'აქტიური' : 'არააქტიური'}
                    </p>
                  </div>
                </div>
              </div>

              {/* სტატისტიკა */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <Calendar className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-blue-800 font-semibold text-lg">{stats.totalBookings}</p>
                      <p className="text-blue-600 text-sm">ჯამური ჯავშნები</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <DollarSign className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-green-800 font-semibold text-lg">{stats.totalAmountPaid}₾</p>
                      <p className="text-green-600 text-sm">გადახდილი თანხა</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center">
                    <Clock className="w-8 h-8 text-orange-600 mr-3" />
                    <div>
                      <p className="text-orange-800 font-semibold text-sm">
                        {stats.lastBookingDate 
                          ? stats.lastBookingDate.toLocaleDateString('ka-GE')
                          : 'არ არის'
                        }
                      </p>
                      <p className="text-orange-600 text-sm">ბოლო ჯავშანი</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center">
                    <Star className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <p className="text-purple-800 font-semibold text-lg">{stats.reviews.length}</p>
                      <p className="text-purple-600 text-sm">რეცენზიები</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ჯავშნების სია */}
              {stats.bookings.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    ჯავშნების ისტორია
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full bg-white rounded-lg shadow">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">თარიღები</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ობიექტი</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ფასი</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">სტატუსი</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">შექმნის თარიღი</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stats.bookings.map((booking, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-800">
                              {new Date(booking.startDate.seconds * 1000).toLocaleDateString('ka-GE')} - 
                              {new Date(booking.endDate.seconds * 1000).toLocaleDateString('ka-GE')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-800">
                              {booking.cottageName || booking.vehicleTitle || booking.hotelName || 'უცნობი'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                              {booking.totalPrice}₾
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {booking.გადასახდილია ? (
                                <span className="flex items-center text-green-600">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  გადახდილი
                                </span>
                              ) : (
                                <span className="flex items-center text-red-600">
                                  <XCircle className="w-4 h-4 mr-1" />
                                  გადაუხდელი
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(booking.createdAt.seconds * 1000).toLocaleDateString('ka-GE')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* რეცენზიები */}
              {stats.reviews.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Star className="w-5 h-5 mr-2" />
                    რეცენზიები
                  </h3>
                  <div className="space-y-4">
                    {stats.reviews.map((review, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className="flex text-yellow-400">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : ''}`} />
                              ))}
                            </div>
                            <span className="ml-2 text-sm text-gray-600">
                              {new Date(review.createdAt.seconds * 1000).toLocaleDateString('ka-GE')}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-800">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">სტატისტიკა ვერ ჩაიტვირთა</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
