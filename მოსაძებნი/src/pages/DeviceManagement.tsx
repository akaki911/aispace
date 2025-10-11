import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { Shield, Smartphone, Monitor, Trash2, Calendar, MapPin, Info, CheckCircle, AlertTriangle } from 'lucide-react';

interface TrustedDevice {
  deviceId: string;
  clientId: string;
  registeredRole: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  firstSeenIP: string;
  uaInfo: {
    browser: string;
    os: string;
    device: string;
  };
  credentialId?: string;
  isCurrentDevice: boolean;
}

const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConsentBanner, setShowConsentBanner] = useState(false);

  const { user, deviceRecognition } = useAuth();

  useEffect(() => {
    fetchTrustedDevices();
    checkConsentStatus();
  }, [user]);

  const fetchTrustedDevices = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/auth/devices/list', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      } else {
        setError('მოწყობილობების ჩამონათვალის მიღება ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('❌ Failed to fetch devices:', error);
      setError('მოწყობილობების მონაცემების მიღება ვერ მოხერხდა');
    } finally {
      setLoading(false);
    }
  };

  const checkConsentStatus = () => {
    const hasConsent = localStorage.getItem('device-tracking-consent');
    if (!hasConsent) {
      setShowConsentBanner(true);
    }
  };

  const handleConsentAccept = () => {
    localStorage.setItem('device-tracking-consent', 'accepted');
    localStorage.setItem('device-tracking-consent-date', new Date().toISOString());
    setShowConsentBanner(false);
    setSuccess('თქვენი თანხმობა შენახულია. მოწყობილობის ზეთვალისარულება გააქტიურდა.');
  };

  const handleConsentDecline = () => {
    localStorage.setItem('device-tracking-consent', 'declined');
    localStorage.setItem('device-tracking-consent-date', new Date().toISOString());
    setShowConsentBanner(false);
  };

  const removeDevice = async (deviceId: string) => {
    if (!confirm('ნამდვილად გსურთ ამ მოწყობილობის მოცილება?')) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setDevices(devices.filter(d => d.deviceId !== deviceId));
        setSuccess('მოწყობილობა წარმატებით მოცილდა');
      } else {
        setError('მოწყობილობის მოცილება ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('❌ Failed to remove device:', error);
      setError('მოწყობილობის მოცილებისას შეცდომა მოხდა');
    }
  };

  const getDeviceIcon = (uaInfo: any) => {
    if (uaInfo?.device?.toLowerCase().includes('mobile')) {
      return <Smartphone className="h-6 w-6" />;
    }
    return <Monitor className="h-6 w-6" />;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PROVIDER': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CUSTOMER': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCurrentDeviceId = () => {
    return deviceRecognition?.currentDevice?.deviceId;
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">ავტორიზაცია საჭიროა მოწყობილობების მართვისთვის</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Consent Banner */}
      {showConsentBanner && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <Info className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                მოწყობილობის ზეთვალისწარება
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  ჩვენ გვსურს მოწყობილობის ზოგადი ინფორმაციის შენახვა უსაფრთხოების მიზნებისთვის. 
                  ეს მოიცავს ბრაუზერის ტიპს, ოპერაციული სისტემის ინფორმაციას და IP მისამართის ნაწილს.
                  ბიომეტრული მონაცემები ან პირადი ფაილები არ ინახება.
                </p>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handleConsentAccept}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  ვეთანხმები
                </button>
                <button
                  onClick={handleConsentDecline}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  არ ვეთანხმები
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Shield className="h-8 w-8 text-blue-600 mr-3" />
          მოწყობილობების მართვა
        </h1>
        <p className="mt-2 text-gray-600">
          მართეთ თქვენი აღიარებული მოწყობილობები და უსაფრთხოების პარამეტრები
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Device Info */}
      {deviceRecognition?.isRecognizedDevice && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-green-900 mb-2">მიმდინარე მოწყობილობა</h3>
          <div className="flex items-center text-green-700">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>ამ მოწყობილობა აღიარებულია როგორც {deviceRecognition.currentDevice?.registeredRole}</span>
          </div>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            აღიარებული მოწყობილობები ({devices.length})
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            მოწყობილობები რომლებიც გამოიყენება თქვენი ანგარიშისთვის
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-500">მოწყობილობების ჩატვირთვა...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">აღიარებული მოწყობილობები არ მოიძებნა</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {devices.map((device) => (
              <li key={device.deviceId} className="px-4 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 text-gray-400">
                      {getDeviceIcon(device.uaInfo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {device.uaInfo?.browser || 'უცნობი ბრაუზერი'} ზე {device.uaInfo?.os || 'უცნობი სისტემა'}
                        </p>
                        {device.deviceId === getCurrentDeviceId() && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            მიმდინარე
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(device.registeredRole)}`}>
                          {device.registeredRole === 'SUPER_ADMIN' ? 'სუპერ ადმინი' :
                           device.registeredRole === 'PROVIDER' ? 'პროვაიდერი' :
                           device.registeredRole === 'CUSTOMER' ? 'მომხმარებელი' : device.registeredRole}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          პირველად: {new Date(device.firstSeenAt).toLocaleDateString('ka-GE')}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          IP: {device.firstSeenIP}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        ID: {device.deviceId}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {device.deviceId !== getCurrentDeviceId() && (
                      <button
                        onClick={() => removeDevice(device.deviceId)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs leading-4 font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        მოცილება
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Privacy Information */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">პრივატულობის ინფორმაცია</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• IP მისამართები ნაწილობრივ ინახება უსაფრთხოების მიზნებისთვის</p>
          <p>• მოწყობილობის ზოგადი ინფორმაცია (ბრაუზერი, OS) ინახება რეპუტაციისთვის</p>
          <p>• ბიომეტრული მონაცემები არ ინახება ჩვენს სერვერებზე</p>
          <p>• Passkey-ები ინახება მხოლოდ თქვენს მოწყობილობაზე</p>
          <p>• მონაცემები იშლება ანგარიშის გაუქმების შემდეგ</p>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagement;