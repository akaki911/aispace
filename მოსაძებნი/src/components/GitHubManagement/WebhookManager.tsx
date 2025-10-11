
import React, { useState, useEffect } from 'react';
import { Webhook, Trash2, RotateCcw, ExternalLink, AlertCircle } from 'lucide-react';

interface WebhookInfo {
  id: number;
  name: string;
  config: {
    url: string;
    content_type: string;
    secret?: string;
  };
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/github/webhooks');
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeWebhook = async (webhookId: number) => {
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ webhook-ის წაშლა?')) return;
    
    try {
      setActionLoading(webhookId);
      const response = await fetch(`/api/ai/github/webhooks/${webhookId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== webhookId));
        console.log('✅ Webhook წარმატებით წაიშალა');
      } else {
        throw new Error('Failed to delete webhook');
      }
    } catch (error) {
      console.error('❌ Webhook წაშლა ვერ მოხერხდა:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const rotateSecret = async (webhookId: number) => {
    if (!confirm('დარწმუნებული ხართ, რომ გსურთ secret key-ის განახლება?')) return;
    
    try {
      setActionLoading(webhookId);
      const response = await fetch(`/api/ai/github/webhooks/${webhookId}/rotate-secret`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Secret key განახლდა:', data.newSecret);
        await loadWebhooks(); // Reload to get updated info
      } else {
        throw new Error('Failed to rotate secret');
      }
    } catch (error) {
      console.error('❌ Secret rotation ვერ მოხერხდა:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleWebhook = async (webhookId: number, active: boolean) => {
    try {
      setActionLoading(webhookId);
      const response = await fetch(`/api/ai/github/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active })
      });
      
      if (response.ok) {
        setWebhooks(prev => prev.map(w => 
          w.id === webhookId ? { ...w, active: !active } : w
        ));
      }
    } catch (error) {
      console.error('❌ Webhook toggle ვერ მოხერხდა:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Webhooks იტვირთება...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Webhook size={20} />
          Webhook Lifecycle Management
        </h3>
        <button
          onClick={loadWebhooks}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
        >
          🔄 განახლება
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Webhook size={48} className="mx-auto mb-2 opacity-50" />
          <p>Webhooks არ არის კონფიგურირებული</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="border rounded-lg p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{webhook.name || `Webhook #${webhook.id}`}</h4>
                    <span className={`px-2 py-1 text-xs rounded ${
                      webhook.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {webhook.active ? 'აქტიური' : 'გათიშული'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={14} />
                      <span className="font-mono">{webhook.config.url}</span>
                    </div>
                    <div>Events: {webhook.events.join(', ')}</div>
                    <div>შექმნილია: {new Date(webhook.created_at).toLocaleDateString('ka-GE')}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleWebhook(webhook.id, webhook.active)}
                    disabled={actionLoading === webhook.id}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      webhook.active
                        ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200'
                        : 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200'
                    } ${actionLoading === webhook.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {webhook.active ? 'გათიშვა' : 'ჩართვა'}
                  </button>

                  <button
                    onClick={() => rotateSecret(webhook.id)}
                    disabled={actionLoading === webhook.id}
                    className={`px-3 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-200 rounded transition-colors ${
                      actionLoading === webhook.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Secret Key-ის განახლება"
                  >
                    <RotateCcw size={14} />
                  </button>

                  <button
                    onClick={() => removeWebhook(webhook.id)}
                    disabled={actionLoading === webhook.id}
                    className={`px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200 rounded transition-colors ${
                      actionLoading === webhook.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Webhook-ის წაშლა"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {webhook.config.secret && (
                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <AlertCircle size={12} />
                    Secret configured და უსაფრთხოდ იცავს webhook-ს
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhookManager;
