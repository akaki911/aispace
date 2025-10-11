// Privacy-safe Device Fingerprinting Utility
import { v4 as uuidv4 } from 'uuid';

// Client-side device fingerprint
export interface DeviceFingerprint {
  userAgent: string;
  language: string;
  timezone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  platform: string;
  hardwareConcurrency: number;
  cookieEnabled: boolean;
  localStorageEnabled: boolean;
}

// User Agent information
export interface UAInfo {
  hash: string;
  platform: string;
  os: string;
  browser: string;
}

// Client ID management
export class ClientIDManager {
  private static readonly CLIENT_ID_KEY = 'bakhmaro_client_id';
  private static readonly CLIENT_ID_COOKIE = 'bakhmaro_device_id';
  
  // Get or create client ID
  static getClientId(): string {
    // Try localStorage first
    let clientId = localStorage.getItem(this.CLIENT_ID_KEY);
    
    // Try cookie fallback
    if (!clientId) {
      clientId = this.getCookie(this.CLIENT_ID_COOKIE);
    }
    
    // Generate new if none exists
    if (!clientId) {
      clientId = uuidv4();
      this.setClientId(clientId);
    }
    
    return clientId;
  }
  
  // Set client ID in both localStorage and cookie
  static setClientId(clientId: string): void {
    try {
      localStorage.setItem(this.CLIENT_ID_KEY, clientId);
    } catch (e) {
      console.warn('[DEVICE] localStorage not available:', e);
    }
    
    // Set secure cookie (30 days)
    this.setCookie(this.CLIENT_ID_COOKIE, clientId, 30);
  }
  
  // Cookie helpers
  private static getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }
  
  private static setCookie(name: string, value: string, days: number): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure`;
  }
}

// Generate device fingerprint
export function generateDeviceFingerprint(): DeviceFingerprint {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language || (navigator as any).userLanguage,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    cookieEnabled: navigator.cookieEnabled,
    localStorageEnabled: (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    })()
  };
}

// Parse User Agent information
export function parseUserAgent(userAgent: string): UAInfo {
  const hash = btoa(userAgent).substring(0, 32); // Simple hash for privacy
  
  let platform = 'unknown';
  let os = 'unknown';
  let browser = 'unknown';
  
  // Platform detection
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac')) platform = 'macOS';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';
  
  // OS detection
  if (userAgent.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (userAgent.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (userAgent.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  }
  else if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android ([0-9.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  }
  else if (userAgent.includes('iPhone OS')) {
    const match = userAgent.match(/iPhone OS ([0-9_]+)/);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  }
  
  // Browser detection
  if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) browser = 'Chrome';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) browser = 'Safari';
  else if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) browser = 'Opera';
  
  return { hash, platform, os, browser };
}

// Complete device information for backend
export interface DeviceInfo {
  clientId: string;
  fingerprint: DeviceFingerprint;
  uaInfo: UAInfo;
}

// Get complete device information
export function getDeviceInfo(): DeviceInfo {
  const clientId = ClientIDManager.getClientId();
  const fingerprint = generateDeviceFingerprint();
  const uaInfo = parseUserAgent(fingerprint.userAgent);
  
  return {
    clientId,
    fingerprint,
    uaInfo
  };
}

// Check if device fingerprinting is supported
export function isDeviceFingerprintingSupported(): boolean {
  return !!(
    navigator.userAgent &&
    navigator.language &&
    screen.width &&
    screen.height &&
    navigator.platform
  );
}

// Privacy-compliant logging
export function logDeviceInfo(info: DeviceInfo): void {
  console.log('📱 [DEVICE] Device Info:', {
    clientId: info.clientId.substring(0, 8) + '...',
    platform: info.uaInfo.platform,
    browser: info.uaInfo.browser,
    os: info.uaInfo.os,
    screen: `${info.fingerprint.screen.width}x${info.fingerprint.screen.height}`,
    timezone: info.fingerprint.timezone,
    language: info.fingerprint.language
  });
}