
import React, { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle, XCircle, Copy } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { 
  createPriceOverrideToken, 
  getTokensByCreator, 
  PriceOverrideToken 
} from './services/priceOverrideService';

interface PriceOverrideManagerProps {
  availableResources: {
    cottages: any[];
    hotels: any[];
    vehicles: any[];
  };
}

const PriceOverrideManager: React.FC<PriceOverrideManagerProps> = ({ availableResources }) => {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<PriceOverrideToken[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<'cottage' | 'hotel' | 'vehicle'>('cottage');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (user) {
      loadTokens();
    }
  }, [user]);

  const loadTokens = async () => {
    if (!user) return;
    
    try {
      const userTokens = await getTokensByCreator(user.id);
      // Sort by creation date, newest first
      userTokens.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setTokens(userTokens);
    } catch (error) {
      console.error('❌ Error loading tokens:', error);
    }
  };

  const handleCreateToken = async () => {
    if (!user || !selectedProductId) return;

    setIsCreating(true);
    try {
      const newToken = await createPriceOverrideToken(
        selectedProductType,
        selectedProductId,
        user.id
      );

      setTokens(prev => [newToken, ...prev]);
      setShowCreateForm(false);
      setSelectedProductId('');
      
      alert(`კოდი წარმატებით შეიქმნა: ${newToken.code}`);
    } catch (error: any) {
      alert(`შეცდომა: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('კოდი დაკოპირდა!');
  };

  const getProductName = (token: PriceOverrideToken) => {
    const { productType, productId } = token;
    
    if (productType === 'cottage') {
      const cottage = availableResources.cottages.find(c => c.id === productId);
      return cottage?.name || 'უცნობი კოტეჯი';
    } else if (productType === 'hotel') {
      const hotel = availableResources.hotels.find(h => h.id === productId);
      return hotel?.name || 'უცნობი სასტუმრო';
    } else if (productType === 'vehicle') {
      const vehicle = availableResources.vehicles.find(v => v.id === productId);
      return vehicle?.title || 'უცნობი მანქანა';
    }
    
    return 'უცნობი პროდუქტი';
  };

  const isExpired = (token: PriceOverrideToken) => {
    return token.expiresAt.toMillis() < Date.now();
  };

  const getStatusColor = (token: PriceOverrideToken) => {
    if (token.used) return 'text-gray-500';
    if (isExpired(token)) return 'text-red-500';
    return 'text-green-500';
  };

  const getStatusIcon = (token: PriceOverrideToken) => {
    if (token.used) return <CheckCircle className="w-4 h-4" />;
    if (isExpired(token)) return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getStatusText = (token: PriceOverrideToken) => {
    if (token.used) return 'გამოყენებული';
    if (isExpired(token)) return 'ვადაგასული';
    return 'აქტიური';
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'PROVIDER')) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">ინდივიდუალური ფასის კოდები</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          ახალი კოდის შექმნა
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">ახალი კოდის შექმნა</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                პროდუქტის ტიპი
              </label>
              <select
                value={selectedProductType}
                onChange={(e) => {
                  setSelectedProductType(e.target.value as any);
                  setSelectedProductId('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="cottage">კოტეჯი</option>
                <option value="hotel">სასტუმრო</option>
                <option value="vehicle">მანქანა</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                აირჩიეთ პროდუქტი
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">აირჩიეთ...</option>
                {selectedProductType === 'cottage' && 
                  availableResources.cottages.map(cottage => (
                    <option key={cottage.id} value={cottage.id}>{cottage.name}</option>
                  ))
                }
                {selectedProductType === 'hotel' && 
                  availableResources.hotels.map(hotel => (
                    <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
                  ))
                }
                {selectedProductType === 'vehicle' && 
                  availableResources.vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.title}</option>
                  ))
                }
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateToken}
                disabled={isCreating || !selectedProductId}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {isCreating ? 'იქმნება...' : 'კოდის შექმნა (12 საათი)'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
              >
                გაუქმება
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            კოდები არ მოიძებნა
          </div>
        ) : (
          tokens.map(token => (
            <div key={token.id} className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-mono font-bold text-blue-600">
                      {token.code}
                    </span>
                    <button
                      onClick={() => copyToClipboard(token.code)}
                      className="text-gray-500 hover:text-gray-700"
                      title="კოპირება"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <div className={`flex items-center gap-1 ${getStatusColor(token)}`}>
                      {getStatusIcon(token)}
                      <span className="text-sm font-medium">{getStatusText(token)}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <strong>პროდუქტი:</strong> {getProductName(token)} ({token.productType})
                    </div>
                    <div>
                      <strong>შექმნის თარიღი:</strong> {token.createdAt.toDate().toLocaleString('ka-GE')}
                    </div>
                    <div>
                      <strong>ვადა:</strong> {token.expiresAt.toDate().toLocaleString('ka-GE')}
                    </div>
                    {token.used && token.usedAt && (
                      <div>
                        <strong>გამოყენების თარიღი:</strong> {token.usedAt.toDate().toLocaleString('ka-GE')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PriceOverrideManager;
