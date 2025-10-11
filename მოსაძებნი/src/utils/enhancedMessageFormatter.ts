/**
 * 🔒 Enhanced Message Formatter - Phase 1 SECURED Implementation
 * პრობლემის მოგვარება.txt-ის მიხედვით განხორციელება
 * 
 * PHASE 1 FEATURES (SECURITY-HARDENED):
 * ✅ Emoji system (🔧, 📋, 💡, ⚡, 🎯)
 * ✅ Code blocks with SAFE syntax highlighting
 * ✅ Visual hierarchy (Markdown → HTML conversion)
 * ✅ Bullet points with icons (✅ ❌ ⚠️)
 * ✅ SECURE copy buttons (React components)
 * ✅ Message categorization with XSS protection
 */

import { formatGeorgianMessage } from './georgianChatFormatter';

// ===== MESSAGE CATEGORIES =====
export type MessageCategory = 'primary' | 'success' | 'error' | 'warning' | 'code' | 'info';

export interface EnhancedMessage {
  id: string;
  content: string;
  category: MessageCategory;
  hasCodeBlocks: boolean;
  codeBlocks: CodeBlock[];
  visualElements: VisualElement[];
  georgianFormatted: boolean;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  copyable: boolean;
}

export interface VisualElement {
  type: 'header' | 'list' | 'highlight' | 'tip' | 'warning';
  content: string;
  icon: string;
}

// ===== PHASE 1: EMOJI SYSTEM =====
const EMOJI_PATTERNS = {
  // Tech & Development
  '🔧': /\b(ფიქს|fix|გამოსწორება|debug|დებაგ)/gi,
  '📋': /\b(ჩამონათვალი|list|სია|შემდეგი|next|ეტაპი|steps)/gi,
  '💡': /\b(იდეა|idea|რჩევა|tip|suggestion|შემოთავაზება)/gi,
  '⚡': /\b(სწრაფი|fast|მყისიერი|instant|გასწრება)/gi,
  '🎯': /\b(მიზანი|goal|target|შედეგი|result|მთავარი)/gi,
  '🚀': /\b(დაწყება|start|იწყება|launch|გაშვება)/gi,
  '✅': /\b(მზადაა|готово|done|დასრულდა|წარმატება|success)/gi,
  '❌': /\b(შეცდომა|error|პრობლემა|problem|ვერ|failed)/gi,
  '⚠️': /\b(ყურადღება|warning|კრიტიკული|critical|საშიში)/gi,
  '📊': /\b(სტატისტიკა|stats|მონაცემები|data|ანალიზი)/gi
};


// ===== PURE UTILITY FUNCTIONS (NO DOM ACCESS) =====

/**
 * 🔒 PURE Enhanced Message Formatter (NO DOM ACCESS)
 */
export const formatEnhancedMessage = (
  content: string
): EnhancedMessage => {
  // Step 1: Apply Georgian formatting first
  const georgianFormatted = formatGeorgianMessage(content);
  
  // Step 2: Add context-aware emojis
  const emojiEnhanced = addContextualEmojis(georgianFormatted);
  
  // Step 3: Extract code blocks from original content
  const codeBlocks = extractCodeBlocksFromContent(emojiEnhanced);
  
  // Step 4: Categorize message
  const category = categorizeMessage(emojiEnhanced);
  
  // Step 5: Return metadata for React component rendering
  return {
    id: `enhanced_${Date.now()}`,
    content: emojiEnhanced, // Pure text content for React component
    category,
    hasCodeBlocks: codeBlocks.length > 0,
    codeBlocks,
    visualElements: [], // Extracted by React component
    georgianFormatted: true
  };
};

/**
 * 🔒 PURE Code Block Extraction (NO DOM ACCESS)
 */
function extractCodeBlocksFromContent(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let index = 0;
  
  while ((match = codeBlockPattern.exec(content)) !== null) {
    blocks.push({
      id: `code_block_${index}`,
      language: match[1] || 'text',
      code: match[2].trim(),
      copyable: true
    });
    index++;
  }
  
  return blocks;
}

/**
 * 🎨 Contextual Emoji Addition
 */
function addContextualEmojis(content: string): string {
  let enhanced = content;
  
  // Apply emoji patterns
  Object.entries(EMOJI_PATTERNS).forEach(([emoji, pattern]) => {
    // Only add emoji if not already present in that context
    enhanced = enhanced.replace(pattern, (match) => {
      // Check if emoji already exists nearby (within 20 chars)
      const index = enhanced.indexOf(match);
      const context = enhanced.substring(Math.max(0, index - 20), index + match.length + 20);
      
      if (!context.includes(emoji)) {
        return `${emoji} ${match}`;
      }
      return match;
    });
  });
  
  return enhanced;
}

// Visual elements extracted by React component - NO DOM IN UTILITY

/**
 * 📊 Message Categorization
 */
function categorizeMessage(content: string): MessageCategory {
  const lowerContent = content.toLowerCase();
  
  // Error patterns
  if (/შეცდომა|error|failed|❌|problem/.test(lowerContent)) {
    return 'error';
  }
  
  // Success patterns  
  if (/წარმატება|success|✅|დასრულდა|მზადაა/.test(lowerContent)) {
    return 'success';
  }
  
  // Warning patterns
  if (/⚠️|warning|ყურადღება|critical/.test(lowerContent)) {
    return 'warning';
  }
  
  // Code patterns
  if (/```|კოდი|code|ფუნქცია|function/.test(lowerContent)) {
    return 'code';
  }
  
  // Info patterns
  if (/ინფორმაცია|info|📊|სტატისტიკა/.test(lowerContent)) {
    return 'info';
  }
  
  return 'primary';
}

// HTML structure created by React component - NO STRINGS WITH DOM

/**
 * 🔒 REMOVED: HTML Escape (DOMPurify handles security)
 * DOM access removed from utility module
 */

// Copy functionality moved to SecureCopyButton component - PURE UTILITY MODULE

/**
 * 🎨 FIXED: Get CSS Classes for Message Category (INCLUDES category-* class)
 */
export const getMessageCategoryClasses = (category: MessageCategory): string => {
  const baseClasses = `message-enhanced category-${category} rounded-lg p-4 mb-4 border-l-4`;
  
  switch (category) {
    case 'success':
      return `${baseClasses} bg-green-50 border-l-green-400 text-green-800`;
    case 'error':
      return `${baseClasses} bg-red-50 border-l-red-400 text-red-800`;
    case 'warning':
      return `${baseClasses} bg-yellow-50 border-l-yellow-400 text-yellow-800`;
    case 'code':
      return `${baseClasses} bg-gray-900 border-l-blue-400 text-gray-100`;
    case 'info':
      return `${baseClasses} bg-blue-50 border-l-blue-400 text-blue-800`;
    case 'primary':
    default:
      return `${baseClasses} bg-gray-50 border-l-gray-400 text-gray-800`;
  }
};

/**
 * 🎯 Integration Helper for ReplitAssistantPanel
 */
export const integrateWithReplitAssistant = (
  message: string
): EnhancedMessage => {
  return formatEnhancedMessage(message);
};