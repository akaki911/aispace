export interface ConnectorSummary {
  id: string;
  name: string;
  status: 'draft' | 'coming-soon';
}

const connectors: ConnectorSummary[] = [
  { id: 'google-oauth', name: 'Google Workspace OAuth', status: 'coming-soon' },
  { id: 'slack-webhook', name: 'Slack Webhook Relay', status: 'draft' },
];

export const integrationRegistryService = {
  async list(): Promise<ConnectorSummary[]> {
    return Promise.resolve(connectors);
  },
};

export default integrationRegistryService;
