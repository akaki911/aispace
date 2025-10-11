export interface SecretDescriptor {
  key: string;
  scope: string;
  managed: boolean;
}

const stubbedSecrets: SecretDescriptor[] = [
  { key: 'PLAYWRIGHT_API_KEY', scope: 'browser-testing', managed: false },
  { key: 'OAUTH_GOOGLE_CLIENT_ID', scope: 'connectors', managed: false },
];

export const secretsVaultService = {
  async list(): Promise<SecretDescriptor[]> {
    return Promise.resolve(stubbedSecrets);
  },
  async importBundle(): Promise<{ accepted: boolean }> {
    return Promise.resolve({ accepted: true });
  },
};

export default secretsVaultService;
