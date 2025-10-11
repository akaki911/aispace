const connectors = [
  { id: 'google-oauth', name: 'Google Workspace OAuth', status: 'coming-soon' },
  { id: 'slack-webhook', name: 'Slack Webhook Relay', status: 'draft' },
];

const list = () => connectors;

module.exports = {
  list,
};
