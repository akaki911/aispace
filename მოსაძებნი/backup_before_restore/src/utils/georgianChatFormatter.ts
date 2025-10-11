/**
 * 🎨 Enhanced Georgian Chat Formatting System
 * PHASE 4: Georgian-Specific Features Integration
 * დოკუმენტის მიხედვით განხორციელებული Georgian formatting + AI enhancement
 */

import GeorgianLanguageEnhancer, { type GeorgianEnhancementOptions } from './georgianLanguageEnhancer';
import GeorgianCulturalAdapter from './georgianCulturalAdapter';
import GeorgianTerminologyDatabase, { SmartTerminologyMapper } from './georgianTerminologyMapper';

export interface GeorgianFormatting {
  headers: boolean;
  emojis: boolean;  
  checkpoints: boolean;
  structured: boolean;
  // PHASE 4 enhancements
  languageEnhanced: boolean;
  culturallyAdapted: boolean;
  terminologyMapped: boolean;
  errorTranslated: boolean;
}

export interface GuruloFormattedMessage {
  id: string;
  content: string;
  formatting: GeorgianFormatting;
  memoryIntegrated: boolean;
  // PHASE 4 enhancements
  languageAnalysis?: any;
  culturalContext?: any;
  terminologyEnhancements?: string[];
}

/**
 * 📝 Smart Message Formatting Functions
 * დოკუმენტიდან: Headers, Checkpoints, Lists, Highlights, Tips, Warnings
 */

// PHASE 4: Initialize enhanced systems
const languageEnhancer = new GeorgianLanguageEnhancer();
const culturalAdapter = new GeorgianCulturalAdapter();
const terminologyMapper = new SmartTerminologyMapper();

export const formatGeorgianMessage = (content: string, options: {
  enableLanguageEnhancement?: boolean;
  enableCulturalAdaptation?: boolean;
  enableTerminologyMapping?: boolean;
  userPreferences?: any;
} = {}): string => {
  let formatted = content;

  // PHASE 4: Language Enhancement (if enabled)
  if (options.enableLanguageEnhancement) {
    const enhanced = languageEnhancer.enhanceContent(formatted);
    formatted = enhanced.enhanced;
  }

  // PHASE 4: Terminology Mapping (if enabled)
  if (options.enableTerminologyMapping) {
    formatted = terminologyMapper.mapTextWithContext(formatted, {
      preserveEnglishTerms: true,
      addExplanations: options.userPreferences?.explanationLevel === 'detailed',
      targetAudience: options.userPreferences?.complexityLevel || 'intermediate'
    });
  }

  // PHASE 4: Cultural Adaptation (if enabled)
  if (options.enableCulturalAdaptation) {
    formatted = culturalAdapter.enhanceContentWithCulturalContext(formatted);
  }

  // Original formatting (enhanced)
  // 🎯 Headers: # 🎯 სათაური, ## 📋 ქვესათაური  
  formatted = formatted.replace(/^# (.+)/gm, '# 🎯 $1');
  formatted = formatted.replace(/^## (.+)/gm, '## 📋 $1');
  formatted = formatted.replace(/^### (.+)/gm, '### 📝 $1');

  // ✅ Checkpoints: ✅ Checkpoint 1.1: აღწერა
  formatted = formatted.replace(/Checkpoint (\d+\.\d+): (.+)/g, '✅ Checkpoint $1: $2');

  // 📊 Lists with emojis
  formatted = formatted.replace(/^- (.+)/gm, '- 📝 $1');

  // 🌟 Highlights: **🌟 მნიშვნელოვანი ინფორმაცია**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '**🌟 $1**');

  // 💡 Tips: 💡 **რჩევა:** ტექსტი
  formatted = formatted.replace(/რჩევა:\s*(.+)/gi, '💡 **რჩევა:** $1');

  // ⚠️ Warnings: ⚠️ **ყურადღება:** ტექსტი  
  formatted = formatted.replace(/ყურადღება:\s*(.+)/gi, '⚠️ **ყურადღება:** $1');

  return formatted;
};

/**
 * 🎨 Response Structure Template  
 * დოკუმენტის მიხედვით structured response generation
 */
export interface GeorgianChatResponse {
  header: string;           // 🎯 მთავარი სათაური
  sections: {
    title: string;         // 📋 სექციის სათაური
    content: string;       // 📝 შინაარსი
    checkpoints?: string[]; // ✅ ჩეკპოინტები
    tips?: string[];       // 💡 რჩევები
  }[];
  summary: string;         // 📊 შეჯამება
  nextSteps?: string[];    // 🚀 შემდეგი ნაბიჯები
}

export const createStructuredGeorgianResponse = (response: GeorgianChatResponse): string => {
  let formatted = `# 🎯 ${response.header}\n\n`;

  response.sections.forEach(section => {
    formatted += `## 📋 ${section.title}\n\n`;
    formatted += `📝 ${section.content}\n\n`;

    if (section.checkpoints && section.checkpoints.length > 0) {
      section.checkpoints.forEach((checkpoint, i) => {
        formatted += `✅ Checkpoint ${i + 1}: ${checkpoint}\n`;
      });
      formatted += '\n';
    }

    if (section.tips && section.tips.length > 0) {
      section.tips.forEach(tip => {
        formatted += `💡 **რჩევა:** ${tip}\n`;
      });
      formatted += '\n';
    }
  });

  formatted += `## 📊 შეჯამება\n\n${response.summary}\n\n`;

  if (response.nextSteps && response.nextSteps.length > 0) {
    formatted += `## 🚀 შემდეგი ნაბიჯები\n\n`;
    response.nextSteps.forEach((step, i) => {
      formatted += `${i + 1}. 📝 ${step}\n`;
    });
  }

  return formatted;
};

/**
 * 🎯 Context-aware Georgian response classification
 */
export const classifyGeorgianResponse = (content: string, enhanced?: any): GeorgianFormatting => {
  return {
    headers: content.includes('#') || content.includes('სათაური'),
    emojis: /[🎯📋📝✅💡⚠️🌟📊🚀]/.test(content),
    checkpoints: content.includes('Checkpoint') || content.includes('ჩეკპოინტ'),
    structured: content.includes('##') && content.includes('📋'),
    // PHASE 4 classifications
    languageEnhanced: enhanced?.analysis?.georgianEnhanced || false,
    culturallyAdapted: enhanced?.culturalContext !== undefined,
    terminologyMapped: enhanced?.terminologyEnhancements?.length > 0 || false,
    errorTranslated: content.includes('🔧') && /[\u10A0-\u10FF]/.test(content)
  };
};

/**
 * 🧠 Memory-integrated message enhancement
 * იყენებს useGuruloMemory hook-იდან მონაცემებს
 */
export const enhanceWithMemory = (
  content: string, 
  userPreferences?: any,
  recentInteractions?: any[]
): GuruloFormattedMessage => {
  // PHASE 4: Enhanced formatting with all systems
  const enhancedContent = formatGeorgianMessage(content, {
    enableLanguageEnhancement: userPreferences?.enableGeorgianFeatures !== false,
    enableCulturalAdaptation: userPreferences?.enableCulturalAdaptation !== false,
    enableTerminologyMapping: userPreferences?.enableTerminologyMapping !== false,
    userPreferences
  });
  
  // Get enhanced analysis
  const languageAnalysis = languageEnhancer.enhanceContent(content);
  const culturalContext = culturalAdapter.getRegionalContext(
    languageAnalysis.analysis.hasCodeBlocks ? 'ვებ განვითარება' : 'ზოგადი'
  );
  
  // Detect terminology enhancements
  const terminologyEnhancements = terminologyMapper.getDatabase()
    .searchTerminology(content)
    .slice(0, 5)
    .map(term => `${term.english} → ${term.georgian}`);
  
  const formatting = classifyGeorgianResponse(enhancedContent, {
    analysis: languageAnalysis.analysis,
    culturalContext,
    terminologyEnhancements
  });
  
  // Context-aware enhancement based on memory
  let enhanced = enhancedContent;
  
  // Add personalized greeting if first interaction of the day
  if (recentInteractions && recentInteractions.length === 0) {
    enhanced = `🎯 **გამარჯობა!** მზად ვარ დახმარებისთვის!\n\n${enhanced}`;
  }
  
  // Add relevant tips based on user preferences
  if (userPreferences?.explanationLevel === 'detailed') {
    enhanced += '\n\n💡 **რჩევა:** მეტი დეტალისთვის კითხეთ დამატებითი შეკითხვები.';
  }
  
  // Add terminology help if technical content detected
  if (terminologyEnhancements.length > 0 && userPreferences?.showTerminologyHelp !== false) {
    enhanced += `\n\n🇬🇪 **ტერმინოლოგია:** ${terminologyEnhancements.slice(0, 3).join(', ')}`;
  }
  
  return {
    id: `formatted_${Date.now()}`,
    content: enhanced,
    formatting,
    memoryIntegrated: true,
    languageAnalysis: languageAnalysis.analysis,
    culturalContext,
    terminologyEnhancements
  };
};

/**
 * 🎨 Georgian AI signature
 */
export const addGeorgianSignature = (content: string): string => {
  return `${content}\n\n✨ *გურულო AI ასისტენტი - მზადაა დახმარებისთვის!*`;
};

/**
 * 🇬🇪 PHASE 4: Enhanced Georgian Support Functions
 */

// Error translation helper
export const translateErrorToGeorgian = (errorMessage: string, errorType?: string): string => {
  if (errorType) {
    return culturalAdapter.translateError(errorType, errorMessage);
  }
  return errorMessage;
};

// Get local example helper
export const getLocalExample = (difficulty?: 'beginner' | 'intermediate' | 'advanced') => {
  return culturalAdapter.getLocalExample(difficulty);
};

// Get Georgian term explanation
export const getTermExplanation = (englishTerm: string) => {
  return culturalAdapter.translateTerm(englishTerm);
};

// Get system capabilities
export const getGeorgianSystemCapabilities = (): string[] => {
  return [
    ...languageEnhancer.getCapabilities(),
    ...culturalAdapter.getCapabilities(),
    ...terminologyMapper.getDatabase().getCapabilities()
  ];
};

// Initialize Georgian support with options
export const initializeGeorgianSupport = (options: GeorgianEnhancementOptions) => {
  languageEnhancer.updateOptions(options);
  return {
    languageEnhancer,
    culturalAdapter, 
    terminologyMapper,
    capabilities: getGeorgianSystemCapabilities()
  };
};

// Export instances for external use
export { 
  languageEnhancer as georgianLanguageEnhancer,
  culturalAdapter as georgianCulturalAdapter,
  terminologyMapper as georgianTerminologyMapper
};