/**
 * 🎨 Enhanced Message Renderer - React Component for SECURE message display
 * Handles DOM operations and React component rendering
 */

import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Prism from 'prismjs';
import SecureCopyButton from './SecureCopyButton';
import { EnhancedMessage } from '../utils/enhancedMessageFormatter';

interface EnhancedMessageRendererProps {
  message: EnhancedMessage;
  className?: string;
}

// Configure marked for safe rendering (FORCE SYNC)
marked.setOptions({
  breaks: true,
  gfm: true,
  async: false
});

// Configure DOMPurify with strict allowlist
const SAFE_HTML_CONFIG = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br'],
  ALLOWED_ATTR: ['class'],
  FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror', 'href', 'src'],
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'meta', 'iframe'],
  KEEP_CONTENT: true
};

export const EnhancedMessageRenderer: React.FC<EnhancedMessageRendererProps> = ({ 
  message, 
  className = '' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Apply Prism highlighting to all code blocks after render
      const codeBlocks = containerRef.current.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const langMatch = block.className.match(/language-(\w+)/);
        const language = langMatch ? langMatch[1] : 'text';
        
        if (Prism.languages[language]) {
          const code = block.textContent || '';
          block.innerHTML = Prism.highlight(code, Prism.languages[language], language);
        }
      });
    }
  }, [message.content]);

  // Render sanitized HTML content (FORCE STRING TYPE)
  const markdownHtml = marked(message.content) as string;
  const sanitizedHtml = DOMPurify.sanitize(markdownHtml, SAFE_HTML_CONFIG);

  return (
    <div 
      ref={containerRef}
      className={`message-enhanced category-${message.category} ${className}`}
    >
      {/* Render sanitized HTML */}
      <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      
      {/* Render copy buttons for code blocks */}
      {message.hasCodeBlocks && message.codeBlocks.map((codeBlock, index) => (
        <div key={`copy-${index}`} className="code-block-actions mt-2">
          <SecureCopyButton 
            text={codeBlock.code}
            className="copy-button text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
          >
            📋 {codeBlock.language.toUpperCase()} კოპირება
          </SecureCopyButton>
        </div>
      ))}
    </div>
  );
};

export default EnhancedMessageRenderer;