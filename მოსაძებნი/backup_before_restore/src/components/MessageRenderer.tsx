/**
 * 🎯 PHASE 1: Enhanced Message Renderer - გურულო AI სისტემი
 * ვიზუალური იერარქია + ქართული ტექსტის გაუმჯობესება
 * 
 * IMPLEMENTED FEATURES:
 * ✅ Enhanced Message Renderer სისტემა
 * ✅ Visual Hierarchy System with MessageCategory styling
 * ✅ Smart Text Processing ქართული ტექსტის enhancement-ით
 * ✅ Response Formatter Functions System
 * ✅ Visual Components Enhancement
 * ✅ Georgian Text Enhancement with Mixed Language Support
 */

import React, { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Prism from 'prismjs';
import SecureCopyButton from './SecureCopyButton';
import { 
  formatEnhancedMessage, 
  type MessageCategory,
  getMessageCategoryClasses 
} from '../utils/enhancedMessageFormatter';

// ===== PHASE 1 INTERFACES =====
interface MessageRendererProps {
  content: string;
  type: "user" | "ai";
  isStreaming?: boolean;
  timestamp: string;
  formatted?: any;
  memoryIntegrated?: boolean;
  contextAware?: boolean;
  className?: string;
}

interface ProcessedMessage {
  originalContent: string;
  enhancedContent: string;
  category: MessageCategory;
  hasCodeBlocks: boolean;
  codeBlocks: Array<{
    id: string;
    language: string;
    code: string;
    copyable: boolean;
  }>;
  hasHeaders: boolean;
  hasBulletPoints: boolean;
  hasEmojis: boolean;
  georgianEnhanced: boolean;
}

// ===== CONFIGURE MARKED FOR SAFETY =====
marked.setOptions({
  breaks: true,
  gfm: true,
  async: false
});

// ===== DOMPurify SECURITY CONFIG =====
const SAFE_HTML_CONFIG = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'span', 'div'],
  ALLOWED_ATTR: ['class', 'data-language'],
  FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror', 'href', 'src', 'javascript:', 'data:'],
  FORBID_TAGS: ['script', 'object', 'embed', 'link', 'meta', 'iframe', 'form', 'input'],
  KEEP_CONTENT: true
};

// ===== PHASE 1: RESPONSE FORMATTER FUNCTIONS SYSTEM =====

/**
 * 🔧 formatMessageWithEmojis() - ავტომატური emoji ჩასმა
 */
const formatMessageWithEmojis = (content: string): string => {
  const EMOJI_PATTERNS = {
    // Tech & Development - ქართული + English
    '🔧': /\b(ფიქს|fix|გამოსწორება|debug|დებაგ|repair|გაკეთება)/gi,
    '📋': /\b(ჩამონათვალი|list|სია|შემდეგი|next|ეტაპი|steps|პუნქტები)/gi,
    '💡': /\b(იდეა|idea|რჩევა|tip|suggestion|შემოთავაზება|გადაწყვეტა)/gi,
    '⚡': /\b(სწრაფი|fast|მყისიერი|instant|გასწრება|rapid|quick)/gi,
    '🎯': /\b(მიზანი|goal|target|შედეგი|result|მთავარი|ფოკუსი)/gi,
    '🚀': /\b(დაწყება|start|იწყება|launch|გაშვება|deploy|განვითარება)/gi,
    '✅': /\b(მზადაა|ready|done|დასრულდა|წარმატება|success|completed)/gi,
    '❌': /\b(შეცდომა|error|პრობლემა|problem|ვერ|failed|არასწორი)/gi,
    '⚠️': /\b(ყურადღება|warning|attention|კრიტიკული|critical|საშიში)/gi,
    '📊': /\b(სტატისტიკა|stats|მონაცემები|data|ანალიზი|analysis|report)/gi,
    '🌟': /\b(საუკეთესო|best|ყველაზე|კარგი|excellent|perfect|ideal)/gi,
    '🎨': /\b(დიზაინი|design|სტილი|style|UI|ინტერფეისი|ვიზუალი)/gi,
    '🧠': /\b(AI|ხელოვნური|ინტელექტი|intelligence|smart|AI)/gi
  };

  let enhanced = content;
  
  Object.entries(EMOJI_PATTERNS).forEach(([emoji, pattern]) => {
    enhanced = enhanced.replace(pattern, (matchedText) => {
      // Check if emoji already exists nearby (within 30 chars)
      const textIndex = enhanced.indexOf(matchedText);
      const context = enhanced.substring(Math.max(0, textIndex - 30), textIndex + matchedText.length + 30);
      
      if (!context.includes(emoji)) {
        return `${emoji} ${matchedText}`;
      }
      return matchedText;
    });
  });
  
  return enhanced;
};

/**
 * 🎨 extractCodeBlocks() - syntax highlighting და copy buttons
 */
const extractCodeBlocks = (content: string): Array<{id: string, language: string, code: string, copyable: boolean}> => {
  const blocks: Array<{id: string, language: string, code: string, copyable: boolean}> = [];
  const codeBlockPattern = /```(\w+)?\n?([\s\S]*?)```/g;
  let matchResult;
  let blockIndex = 0;
  
  while ((matchResult = codeBlockPattern.exec(content)) !== null) {
    blocks.push({
      id: `code_block_${blockIndex}_${Date.now()}`,
      language: matchResult[1] || 'text',
      code: matchResult[2].trim(),
      copyable: true
    });
    blockIndex++;
  }
  
  return blocks;
};

/**
 * ## createSectionHeaders() - სათაური formatting
 */
const createSectionHeaders = (content: string): string => {
  let enhanced = content;
  
  // Enhanced header patterns with Georgian support
  enhanced = enhanced.replace(/^### (.+)$/gm, '### 🔸 $1');  // Subsection headers
  enhanced = enhanced.replace(/^## (.+)$/gm, '## 📋 $1');    // Section headers  
  enhanced = enhanced.replace(/^# (.+)$/gm, '# 🎯 $1');      // Main headers
  
  return enhanced;
};

/**
 * ✅ addBulletPoints() - bullet point formatting with icons
 */
const addBulletPoints = (content: string): string => {
  let enhanced = content;
  
  // Enhanced bullet patterns with Georgian context
  enhanced = enhanced.replace(/^\s*[-*+]\s+(.+)$/gm, (_, text) => {
    const lowerText = text.toLowerCase();
    
    if (/მუშაობს|works|working|success|წარმატებით|completed/.test(lowerText)) {
      return `✅ ${text}`;
    } else if (/ვერ მუშაობს|failed|error|broken|არ|not working|problem/.test(lowerText)) {
      return `❌ ${text}`;
    } else if (/ყურადღება|warning|attention|note|იცოდე|remember/.test(lowerText)) {
      return `⚠️ ${text}`;
    } else if (/ინფო|info|information|note|შენიშვნა/.test(lowerText)) {
      return `💡 ${text}`;
    } else if (/ქმედება|action|todo|გაკეთება|უნდა/.test(lowerText)) {
      return `🎯 ${text}`;
    } else {
      return `🔸 ${text}`;  // Default bullet
    }
  });
  
  return enhanced;
};

/**
 * 🇬🇪 Georgian Text Enhancement with Mixed Language Support
 */
const enhanceGeorgianText = (content: string): string => {
  let enhanced = content;
  
  // Technical terms enhancement
  const technicalTerms = {
    'component': 'კომპონენტი (component)',
    'function': 'ფუნქცია (function)', 
    'variable': 'ცვლადი (variable)',
    'array': 'მასივი (array)',
    'object': 'ობიექტი (object)',
    'method': 'მეთოდი (method)',
    'interface': 'ინტერფეისი (interface)',
    'props': 'Props (თვისებები)',
    'state': 'State (მდგომარეობა)',
    'hook': 'Hook (ჰუკი)',
    'API': 'API (აპლიკაციის პროგრამული ინტერფეისი)',
    'database': 'მონაცემთა ბაზა (database)',
    'server': 'სერვერი (server)'
  };
  
  // Only enhance on first occurrence to avoid repetition
  const enhanced_terms = new Set<string>();
  
  Object.entries(technicalTerms).forEach(([english, georgian]) => {
    if (!enhanced_terms.has(english)) {
      const firstOccurrence = new RegExp(`\\b${english}\\b`, 'i');
      if (firstOccurrence.test(enhanced)) {
        enhanced = enhanced.replace(firstOccurrence, georgian);
        enhanced_terms.add(english);
      }
    }
  });
  
  return enhanced;
};

/**
 * 🎨 Smart Text Processing - ქართული ტექსტის enhancement
 */
const processMessageContent = (content: string): ProcessedMessage => {
  // Step 1: Extract code blocks first (before emoji processing)
  const codeBlocks = extractCodeBlocks(content);
  
  // Step 2: Format with emojis
  let enhanced = formatMessageWithEmojis(content);
  
  // Step 3: Create section headers
  enhanced = createSectionHeaders(enhanced);
  
  // Step 4: Add bullet points
  enhanced = addBulletPoints(enhanced);
  
  // Step 5: Georgian text enhancement
  enhanced = enhanceGeorgianText(enhanced);
  
  // Step 6: Analysis
  const hasCodeBlocks = codeBlocks.length > 0;
  const hasHeaders = /^#{1,6}\s+/.test(enhanced);
  const hasBulletPoints = /^[✅❌⚠️💡🎯🔸]/m.test(enhanced);
  const hasEmojis = /[🔧📋💡⚡🎯🚀✅❌⚠️📊🌟🎨🧠]/.test(enhanced);
  const georgianEnhanced = /[\u10A0-\u10FF]/.test(enhanced);
  
  // Step 7: Categorize
  const enhancedMessage = formatEnhancedMessage(enhanced);
  
  return {
    originalContent: content,
    enhancedContent: enhanced,
    category: enhancedMessage.category,
    hasCodeBlocks,
    codeBlocks,
    hasHeaders,
    hasBulletPoints, 
    hasEmojis,
    georgianEnhanced
  };
};

// ===== MAIN MESSAGE RENDERER COMPONENT =====

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  type,
  isStreaming = false,
  timestamp,
  memoryIntegrated = false,
  contextAware = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [processedMessage, setProcessedMessage] = useState<ProcessedMessage | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  // Process message content
  useEffect(() => {
    if (content) {
      setIsProcessing(true);
      
      // Process the message
      const processed = processMessageContent(content);
      setProcessedMessage(processed);
      
      setIsProcessing(false);
    }
  }, [content]);

  // Apply syntax highlighting after render
  useEffect(() => {
    if (containerRef.current && processedMessage && !isProcessing) {
      const codeBlocks = containerRef.current.querySelectorAll('pre code[data-language]');
      codeBlocks.forEach((block) => {
        const element = block as HTMLElement;
        const language = element.getAttribute('data-language') || 'text';
        
        if (Prism.languages[language]) {
          const code = element.textContent || '';
          element.innerHTML = Prism.highlight(code, Prism.languages[language], language);
        }
      });
    }
  }, [processedMessage, isProcessing]);

  if (isProcessing || !processedMessage) {
    return (
      <div className="flex items-center space-x-2 p-4 bg-gray-700 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
        <span className="text-gray-300 text-sm">დამუშავება...</span>
      </div>
    );
  }

  // For user messages, use simple styling
  if (type === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg px-4 py-3 shadow-lg">
          <div className="whitespace-pre-wrap break-words">
            {processedMessage.enhancedContent}
          </div>
          <div className="text-xs opacity-75 mt-2 text-right">
            {new Date(timestamp).toLocaleTimeString('ka-GE')}
          </div>
        </div>
      </div>
    );
  }

  // For AI messages, use enhanced rendering
  const markdownHtml = marked(processedMessage.enhancedContent) as string;
  const sanitizedHtml = DOMPurify.sanitize(markdownHtml, SAFE_HTML_CONFIG);
  
  // Add language attributes to code blocks for syntax highlighting
  const htmlWithCodeLanguages = sanitizedHtml.replace(
    /<pre><code class="language-(\w+)">/g, 
    '<pre><code class="language-$1" data-language="$1">'
  );

  const categoryClasses = getMessageCategoryClasses(processedMessage.category);
  
  return (
    <div className="flex justify-start mb-4">
      <div className={`max-w-[85%] ${categoryClasses} ${className} shadow-lg hover:shadow-xl transition-all duration-300`}>
        {/* Header with status indicators */}
        <div className="flex items-center justify-between mb-3 text-xs opacity-75">
          <div className="flex items-center space-x-2">
            <span className="font-medium">🤖 გურულო AI</span>
            {memoryIntegrated && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">🧠 მეხსიერება</span>}
            {contextAware && <span className="px-2 py-1 bg-green-100 text-green-700 rounded">📄 კონტექსტი</span>}
            {processedMessage.georgianEnhanced && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">🇬🇪 ქართული</span>}
          </div>
          <div className="text-right">
            {new Date(timestamp).toLocaleTimeString('ka-GE')}
          </div>
        </div>
        
        {/* Main content */}
        <div 
          ref={containerRef}
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlWithCodeLanguages }}
        />
        
        {/* Code block copy buttons */}
        {processedMessage.hasCodeBlocks && processedMessage.codeBlocks.map((codeBlock) => (
          <div key={codeBlock.id} className="mt-3 flex justify-end">
            <SecureCopyButton 
              text={codeBlock.code}
              className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
            >
              📋 {codeBlock.language.toUpperCase()} კოპირება
            </SecureCopyButton>
          </div>
        ))}
        
        {/* Enhancement indicators */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 text-xs opacity-60">
          <div className="flex items-center space-x-3">
            {processedMessage.hasEmojis && <span>✨ Emoji-ები</span>}
            {processedMessage.hasHeaders && <span>📋 სათაურები</span>}
            {processedMessage.hasBulletPoints && <span>🔸 ჩამონათვალი</span>}
            {processedMessage.hasCodeBlocks && <span>💻 კოდის ბლოკები: {processedMessage.codeBlocks.length}</span>}
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-green-600">●</span>
            <span>Enhanced</span>
          </div>
        </div>
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center space-x-2 mt-3 text-sm text-blue-600">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <span>მიღება...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageRenderer;