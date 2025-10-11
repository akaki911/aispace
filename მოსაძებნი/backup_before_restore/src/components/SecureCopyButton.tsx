/**
 * 🔒 Secure Copy Button Component - Phase 1 Security Fix
 * React component to replace unsafe inline onclick handlers
 */

import React, { useState } from 'react';

/**
 * 🔒 SECURE Copy Handler (React Component Only)
 */
const createCopyHandler = (text: string) => {
  return async (): Promise<boolean> => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  };
};

interface SecureCopyButtonProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
}

export const SecureCopyButton: React.FC<SecureCopyButtonProps> = ({ 
  text, 
  className = "copy-button", 
  children 
}) => {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const copyHandler = createCopyHandler(text);
    const success = await copyHandler();
    
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    
    setIsLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isLoading}
      className={`${className} transition-all ${copied ? 'text-green-500' : ''}`}
      aria-label={copied ? 'ტექსტი კოპირებულია' : 'ტექსტის კოპირება'}
      title={copied ? 'კოპირებულია!' : 'კოპირება'}
    >
      {isLoading ? (
        '⏳ კოპირდება...'
      ) : copied ? (
        '✅ კოპირდა!'
      ) : (
        children || '📋 კოპირება'
      )}
    </button>
  );
};

export default SecureCopyButton;