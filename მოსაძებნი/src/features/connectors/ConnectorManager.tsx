import { useMemo } from 'react';
import { ShieldCheck, PlugZap } from 'lucide-react';
import { useAssistantMode } from '../../contexts/useAssistantMode';

interface ConnectorDefinition {
  id: string;
  name: string;
  status: 'draft' | 'coming-soon';
  category: 'oauth' | 'webhook' | 'data-stream';
}

const stubConnectors: ConnectorDefinition[] = [
  { id: 'google-oauth', name: 'Google Workspace OAuth', status: 'coming-soon', category: 'oauth' },
  { id: 'slack-webhook', name: 'Slack Webhook Relay', status: 'draft', category: 'webhook' },
  { id: 'postgres-stream', name: 'PostgreSQL CDC Stream', status: 'coming-soon', category: 'data-stream' },
];

const statusBadgeStyles: Record<ConnectorDefinition['status'], string> = {
  draft: 'bg-amber-100 text-amber-700',
  'coming-soon': 'bg-blue-100 text-blue-700',
};

export const ConnectorManager = () => {
  const { isReadOnly } = useAssistantMode();
  const connectors = useMemo(() => stubConnectors, []);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Connector Platform</h1>
          <p className="text-sm text-gray-600">
            OAuth and webhook connectors will be registered here. The stub keeps routing intact without provisioning credentials.
          </p>
        </div>
        <button
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-blue-300"
          type="button"
          disabled={isReadOnly}
        >
          <PlugZap className="mr-2 h-4 w-4" />
          Add connector
        </button>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-1 divide-y divide-gray-100">
          {connectors.map((connector) => (
            <div key={connector.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800">{connector.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{connector.category.replace('-', ' ')}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusBadgeStyles[connector.status]}`}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {connector.status === 'draft' ? 'Draft stub' : 'Coming soon'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ConnectorManager;
