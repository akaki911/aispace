const fs = require('fs');
const path = require('path');

class AdminWebAuthnStore {
  constructor() {
    this.credentialsPath = path.join(__dirname, '../data/admin_credentials.json');
    this.ensureCredentialsFile();
  }

  ensureCredentialsFile() {
    try {
      const dataDir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 Created admin data directory');
      }

      if (!fs.existsSync(this.credentialsPath)) {
        const initialData = {};
        fs.writeFileSync(this.credentialsPath, JSON.stringify(initialData, null, 2));
        console.log('📄 Created admin credentials file');
      }
    } catch (error) {
      console.error('❌ Error ensuring credentials file:', error);
    }
  }

  loadCredentials() {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        console.log('⚠️ Credentials file does not exist, returning empty object');
        return {};
      }

      const data = fs.readFileSync(this.credentialsPath, 'utf8');
      if (!data.trim()) {
        console.log('⚠️ Credentials file is empty, returning empty object');
        return {};
      }

      const parsed = JSON.parse(data);
      console.log('📖 Loaded credentials for users:', Object.keys(parsed));
      return parsed;
    } catch (error) {
      console.error('❌ Error loading credentials:', error);
      return {};
    }
  }

  saveCredentials(credentials) {
    try {
      // Ensure directory exists
      const dataDir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2));
      console.log('✅ Credentials saved successfully');
    } catch (error) {
      console.error('❌ Error saving credentials:', error);
      throw error;
    }
  }

  async getCredentials(personalId) {
    try {
      const allCredentials = this.loadCredentials();
      const userCredentials = allCredentials[personalId] || [];

      console.log(`🔍 Getting credentials for ${personalId}:`, userCredentials.length);

      // Convert stored data back to proper format
      return userCredentials.map(cred => {
        const converted = {
          ...cred,
          credentialID: Array.isArray(cred.credentialID) ?
            cred.credentialID : Array.from(new Uint8Array(Buffer.from(cred.credentialID, 'base64url'))),
          credentialPublicKey: Array.isArray(cred.credentialPublicKey) ?
            cred.credentialPublicKey : Array.from(new Uint8Array(Buffer.from(cred.credentialPublicKey, 'base64url')))
        };

        return converted;
      });
    } catch (error) {
      console.error('❌ Error getting credentials:', error);
      return [];
    }
  }

  async saveCredential(personalId, credential) {
    try {
      console.log('🔧 Starting credential save for personalId:', personalId);
      console.log('🔧 Credential data received:', {
        id: credential.id?.substring(0, 10) + '...',
        credentialID: credential.credentialID?.substring ? credential.credentialID.substring(0, 10) + '...' : 'Buffer/Array',
        hasPublicKey: !!credential.credentialPublicKey,
        counter: credential.counter
      });

      const allCredentials = this.loadCredentials();

      // Ensure personalId key exists
      if (!allCredentials[personalId]) {
        allCredentials[personalId] = [];
        console.log('🔧 Created new credential array for personalId:', personalId);
      }

      // Get credential ID - prefer the normalized string format
      const credentialID = credential.credentialID || credential.id;
      let credentialIDBase64;
      
      if (typeof credentialID === 'string') {
        // Already base64url string
        credentialIDBase64 = credentialID;
      } else if (Array.isArray(credentialID)) {
        credentialIDBase64 = Buffer.from(credentialID).toString('base64url');
      } else if (credentialID instanceof Uint8Array || Buffer.isBuffer(credentialID)) {
        credentialIDBase64 = Buffer.from(credentialID).toString('base64url');
      } else {
        throw new Error('Invalid credential ID format');
      }

      // Prepare credential for storage with consistent format
      const credentialToStore = {
        id: credentialIDBase64, // Base64url string for lookup
        credentialID: credentialIDBase64, // Store as string for consistency
        credentialPublicKey: credential.credentialPublicKey, // Keep original format for WebAuthn verification
        counter: credential.counter || 0,
        transports: credential.transports || ['internal', 'hybrid'],
        createdAt: new Date().toISOString(),
        personalId: personalId // Add personalId for debugging
      };

      // Remove any existing credential with the same ID to prevent duplicates
      const originalLength = allCredentials[personalId].length;
      allCredentials[personalId] = allCredentials[personalId].filter(
        cred => cred.id !== credentialToStore.id
      );
      
      if (allCredentials[personalId].length < originalLength) {
        console.log('🔧 Removed existing credential with same ID');
      }

      // Add the new credential
      allCredentials[personalId].push(credentialToStore);
      
      // Save to file
      this.saveCredentials(allCredentials);

      console.log('✅ Credential saved successfully for user:', personalId);
      console.log('🔑 Credential ID:', credentialIDBase64.substring(0, 10) + '...');
      console.log('🔑 Total credentials for user:', allCredentials[personalId].length);
      
      return credentialToStore;
    } catch (error) {
      console.error('❌ Error saving credential:', error);
      console.error('❌ PersonalId:', personalId);
      console.error('❌ Credential keys:', Object.keys(credential || {}));
      throw error;
    }
  }

  async hasAnyAdmin() {
    try {
      const allCredentials = this.loadCredentials();
      return Object.keys(allCredentials).length > 0;
    } catch (error) {
      console.error('Failed to check for admins:', error);
      return false;
    }
  }

  async listCredentialIds(userId, specificCredentialId = null) {
    try {
      const allCredentials = this.loadCredentials();
      const userCredentials = allCredentials[userId] || [];

      console.log(`🔍 Listing credentials for user ${userId}: found ${userCredentials.length} credentials`);
      console.log('🔍 Available users in store:', Object.keys(allCredentials));

      if (specificCredentialId) {
        // Look for specific credential
        const credential = userCredentials.find(cred => 
          cred.id === specificCredentialId || cred.credentialID === specificCredentialId
        );
        
        if (!credential) {
          console.log('❌ Specific credential not found:', specificCredentialId.substring(0, 10) + '...');
          console.log('❌ Available credential IDs for user:', userCredentials.map(c => c.id?.substring(0, 10) + '...'));
          return null;
        }
        
        console.log('✅ Found specific credential:', credential.id.substring(0, 10) + '...');
        return {
          ...credential,
          credentialID: credential.credentialID,
          credentialPublicKey: credential.credentialPublicKey,
          counter: credential.counter || 0
        };
      }

      // Return all credential IDs for this user
      const credentialIds = userCredentials.map(cred => cred.id);
      console.log('📋 All credential IDs for user:', credentialIds.map(id => id?.substring(0, 10) + '...'));
      return credentialIds;
    } catch (error) {
      console.error('❌ Failed to list credential IDs:', error);
      console.error('❌ UserId:', userId);
      console.error('❌ SpecificCredentialId:', specificCredentialId?.substring(0, 10) + '...');
      return specificCredentialId ? null : [];
    }
  }

  async addCredential(userId, credential) {
    return this.saveCredential(userId, credential);
  }
}

module.exports = new AdminWebAuthnStore();