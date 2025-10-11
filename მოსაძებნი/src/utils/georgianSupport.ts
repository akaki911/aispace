/**
 * 🇬🇪 Georgian Support Integration Interface
 * PHASE 4: Complete Georgian-Specific Features Integration
 * 
 * Main interface for integrating all Georgian features into ChatPanel.tsx
 * ქართული მხარდაჭერის ერთიანი სისტემა გურულო AI-სთვის
 */

import { 
  enhanceWithMemory, 
  formatGeorgianMessage,
  translateErrorToGeorgian,
  getLocalExample,
  getTermExplanation,
  getGeorgianSystemCapabilities,
  initializeGeorgianSupport,
  georgianLanguageEnhancer,
  georgianCulturalAdapter,
  georgianTerminologyMapper,
  type GuruloFormattedMessage,
  type GeorgianFormatting
} from './georgianChatFormatter';

import type { GeorgianEnhancementOptions } from './georgianLanguageEnhancer';
import type { RegionalContext } from './georgianCulturalAdapter';

// ===== GEORGIAN SUPPORT CONFIGURATION =====

export interface GeorgianSupportConfig {
  enabled: boolean;
  languageEnhancement: {
    autoCorrection: boolean;
    transliteration: boolean;
    mixedLanguageFormatting: boolean;
    georgianCodeComments: boolean;
    strictGrammarMode: boolean;
  };
  culturalAdaptation: {
    georgianTerminology: boolean;
    localExamples: boolean;
    georgianErrors: boolean;
    regionalContext: boolean;
  };
  userPreferences: {
    explanationLevel: 'beginner' | 'intermediate' | 'advanced';
    preferredTranslationStyle: 'literal' | 'explanatory' | 'mixed';
    showTerminologyHelp: boolean;
    enableCulturalContext: boolean;
    complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  ui: {
    showGeorgianControls: boolean;
    enableLanguageToggle: boolean;
    showCapabilities: boolean;
    enableQuickActions: boolean;
  };
}

export interface GeorgianSupportState {
  isInitialized: boolean;
  config: GeorgianSupportConfig;
  capabilities: string[];
  statistics: {
    messagesProcessed: number;
    terminologyEnhancements: number;
    errorsTranslated: number;
    culturalAdaptations: number;
  };
  recentTerminology: Array<{
    english: string;
    georgian: string;
    timestamp: Date;
  }>;
}

// ===== MAIN GEORGIAN SUPPORT CLASS =====

export class GeorgianSupport {
  private state: GeorgianSupportState;
  private config: GeorgianSupportConfig;

  constructor(initialConfig?: Partial<GeorgianSupportConfig>) {
    this.config = this.getDefaultConfig();
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }

    this.state = {
      isInitialized: false,
      config: this.config,
      capabilities: [],
      statistics: {
        messagesProcessed: 0,
        terminologyEnhancements: 0,
        errorsTranslated: 0,
        culturalAdaptations: 0
      },
      recentTerminology: []
    };

    this.initialize();
  }

  private getDefaultConfig(): GeorgianSupportConfig {
    return {
      enabled: true,
      languageEnhancement: {
        autoCorrection: true,
        transliteration: true,
        mixedLanguageFormatting: true,
        georgianCodeComments: true,
        strictGrammarMode: true
      },
      culturalAdaptation: {
        georgianTerminology: true,
        localExamples: true,
        georgianErrors: true,
        regionalContext: true
      },
      userPreferences: {
        explanationLevel: 'intermediate',
        preferredTranslationStyle: 'explanatory',
        showTerminologyHelp: true,
        enableCulturalContext: true,
        complexityLevel: 'intermediate'
      },
      ui: {
        showGeorgianControls: true,
        enableLanguageToggle: true,
        showCapabilities: true,
        enableQuickActions: true
      }
    };
  }

  private initialize(): void {
    try {
      // Initialize Georgian systems with config
      const enhancementOptions: GeorgianEnhancementOptions = {
        enableAutoCorrection: this.config.languageEnhancement.autoCorrection,
        enableTransliteration: this.config.languageEnhancement.transliteration,
        enableMixedLanguageFormatting: this.config.languageEnhancement.mixedLanguageFormatting,
        enableCodeCommentHighlighting: this.config.languageEnhancement.georgianCodeComments,
        preserveEnglishTerms: this.config.userPreferences.preferredTranslationStyle !== 'literal',
        regionalDialect: 'standard',
        enableStrictGrammarMode: this.config.languageEnhancement.strictGrammarMode,
        grammarExampleLimit: 10
      };

      initializeGeorgianSupport(enhancementOptions);
      
      this.state.capabilities = getGeorgianSystemCapabilities();
      this.state.isInitialized = true;

      console.log('🇬🇪 Georgian Support initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Georgian Support:', error);
      this.state.isInitialized = false;
    }
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Process message with Georgian enhancement
   */
  processMessage(
    content: string, 
    userPreferences?: any, 
    recentInteractions?: any[]
  ): GuruloFormattedMessage {
    if (!this.state.isInitialized || !this.config.enabled) {
      return {
        id: `basic_${Date.now()}`,
        content,
        formatting: {
          headers: false,
          emojis: false,
          checkpoints: false,
          structured: false,
          languageEnhanced: false,
          culturallyAdapted: false,
          terminologyMapped: false,
          errorTranslated: false
        },
        memoryIntegrated: false
      };
    }

    const enhanced = enhanceWithMemory(
      content,
      { ...this.config.userPreferences, ...userPreferences },
      recentInteractions
    );

    if (this.config.languageEnhancement.strictGrammarMode) {
      const grammarCheck = georgianLanguageEnhancer.parseGeorgianSentence(enhanced.content);
      if (grammarCheck.correctedText && grammarCheck.correctedText !== enhanced.content) {
        enhanced.content = grammarCheck.correctedText;
      }
      enhanced.languageAnalysis = {
        ...enhanced.languageAnalysis,
        grammarBreakdown: grammarCheck.breakdown,
        grammarErrors: grammarCheck.errors
      };
      enhanced.grammarSuggestions = grammarCheck.suggestions;
    } else if (!enhanced.languageAnalysis?.grammarBreakdown) {
      const grammarCheck = georgianLanguageEnhancer.parseGeorgianSentence(enhanced.content);
      enhanced.languageAnalysis = {
        ...enhanced.languageAnalysis,
        grammarBreakdown: grammarCheck.breakdown
      };
      enhanced.grammarSuggestions = grammarCheck.suggestions;
    }

    // Update statistics
    this.state.statistics.messagesProcessed++;
    if (enhanced.languageAnalysis?.georgianEnhanced) {
      this.state.statistics.terminologyEnhancements++;
    }
    if (enhanced.culturalContext) {
      this.state.statistics.culturalAdaptations++;
    }

    // Track recent terminology
    if (enhanced.terminologyEnhancements) {
      enhanced.terminologyEnhancements.forEach(term => {
        const [english, georgian] = term.split(' → ');
        if (english && georgian) {
          this.state.recentTerminology.unshift({
            english: english.trim(),
            georgian: georgian.trim(),
            timestamp: new Date()
          });
          // Keep only last 10 terms
          this.state.recentTerminology = this.state.recentTerminology.slice(0, 10);
        }
      });
    }

    return enhanced;
  }

  /**
   * Translate error message to Georgian
   */
  translateError(errorMessage: string, errorType?: string): string {
    if (!this.config.culturalAdaptation.georgianErrors) {
      return errorMessage;
    }

    const translated = translateErrorToGeorgian(errorMessage, errorType);
    if (translated !== errorMessage) {
      this.state.statistics.errorsTranslated++;
    }
    return translated;
  }

  /**
   * Get local platform example
   */
  getLocalPlatformExample(difficulty?: 'beginner' | 'intermediate' | 'advanced') {
    if (!this.config.culturalAdaptation.localExamples) {
      return null;
    }

    return getLocalExample(difficulty || this.config.userPreferences.complexityLevel);
  }

  /**
   * Get Georgian term explanation
   */
  getTerminologyHelp(englishTerm: string) {
    if (!this.config.culturalAdaptation.georgianTerminology) {
      return null;
    }

    return getTermExplanation(englishTerm);
  }

  /**
   * Get regional context for topic
   */
  getRegionalContext(topic: string): RegionalContext | null {
    if (!this.config.culturalAdaptation.regionalContext) {
      return null;
    }

    return georgianCulturalAdapter.getRegionalContext(topic);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GeorgianSupportConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.state.config = this.config;
    
    // Re-initialize if language enhancement settings changed
    if (newConfig.languageEnhancement) {
      this.initialize();
    }
  }

  /**
   * Get current state
   */
  getState(): GeorgianSupportState {
    return { ...this.state };
  }

  /**
   * Get capabilities
   */
  getCapabilities(): string[] {
    return [...this.state.capabilities];
  }

  /**
   * Get quick actions for UI
   */
  getQuickActions(): Array<{
    id: string;
    label: string;
    icon: string;
    action: () => void;
    enabled: boolean;
  }> {
    return [
      {
        id: 'toggle_terminology',
        label: 'ტერმინოლოგიის მხარდაჭერა',
        icon: '📚',
        action: () => this.updateConfig({
          culturalAdaptation: {
            ...this.config.culturalAdaptation,
            georgianTerminology: !this.config.culturalAdaptation.georgianTerminology
          }
        }),
        enabled: this.config.culturalAdaptation.georgianTerminology
      },
      {
        id: 'toggle_cultural_context',
        label: 'კულტურული კონტექსტი',
        icon: '🏛️',
        action: () => this.updateConfig({
          culturalAdaptation: {
            ...this.config.culturalAdaptation,
            regionalContext: !this.config.culturalAdaptation.regionalContext
          }
        }),
        enabled: this.config.culturalAdaptation.regionalContext
      },
      {
        id: 'toggle_auto_correction',
        label: 'ავტო-გასწორება',
        icon: '🔧',
        action: () => this.updateConfig({
          languageEnhancement: {
            ...this.config.languageEnhancement,
            autoCorrection: !this.config.languageEnhancement.autoCorrection
          }
        }),
        enabled: this.config.languageEnhancement.autoCorrection
      },
      {
        id: 'toggle_strict_grammar',
        label: 'გრამატიკის კონტროლი',
        icon: '📐',
        action: () => this.updateConfig({
          languageEnhancement: {
            ...this.config.languageEnhancement,
            strictGrammarMode: !this.config.languageEnhancement.strictGrammarMode
          }
        }),
        enabled: this.config.languageEnhancement.strictGrammarMode
      },
      {
        id: 'get_local_example',
        label: 'ლოკალური მაგალითი',
        icon: '🏔️',
        action: () => {
          const example = this.getLocalPlatformExample();
          console.log('🇬🇪 Local Example:', example);
        },
        enabled: this.config.culturalAdaptation.localExamples
      },
      {
        id: 'show_capabilities',
        label: 'შესაძლებლობები',
        icon: '⚡',
        action: () => {
          console.log('🇬🇪 Georgian Support Capabilities:', this.getCapabilities());
        },
        enabled: this.config.ui.showCapabilities
      }
    ];
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      statistics: this.state.statistics,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(jsonConfig: string): boolean {
    try {
      const data = JSON.parse(jsonConfig);
      if (data.config) {
        this.updateConfig(data.config);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to import Georgian Support config:', error);
      return false;
    }
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.state.statistics = {
      messagesProcessed: 0,
      terminologyEnhancements: 0,
      errorsTranslated: 0,
      culturalAdaptations: 0
    };
    this.state.recentTerminology = [];
    this.initialize();
  }

  /**
   * Get status for UI display
   */
  getStatus(): {
    enabled: boolean;
    ready: boolean;
    features: {
      name: string;
      enabled: boolean;
      status: 'active' | 'inactive' | 'error';
    }[];
    statistics: GeorgianSupportState['statistics'];
  } {
    return {
      enabled: this.config.enabled,
      ready: this.state.isInitialized,
      features: [
        {
          name: 'ქართული ენის გაუმჯობესება',
          enabled: Object.values(this.config.languageEnhancement).some(v => v),
          status: this.state.isInitialized ? 'active' : 'inactive'
        },
        {
          name: 'კულტურული ადაპტაცია',
          enabled: Object.values(this.config.culturalAdaptation).some(v => v),
          status: this.state.isInitialized ? 'active' : 'inactive'
        },
        {
          name: 'ტერმინოლოგიის მხარდაჭერა',
          enabled: this.config.culturalAdaptation.georgianTerminology,
          status: this.state.isInitialized ? 'active' : 'inactive'
        },
        {
          name: 'რეგიონული კონტექსტი',
          enabled: this.config.culturalAdaptation.regionalContext,
          status: this.state.isInitialized ? 'active' : 'inactive'
        },
        {
          name: 'სტრიქტი გრამატიკის რეჟიმი',
          enabled: this.config.languageEnhancement.strictGrammarMode,
          status: this.config.languageEnhancement.strictGrammarMode && this.state.isInitialized ? 'active' : 'inactive'
        }
      ],
      statistics: this.state.statistics
    };
  }
}

// ===== DEFAULT EXPORT AND UTILITIES =====

// Create singleton instance
export const defaultGeorgianSupport = new GeorgianSupport();

// Export utilities for direct use
export {
  formatGeorgianMessage,
  translateErrorToGeorgian,
  getLocalExample,
  getTermExplanation,
  getGeorgianSystemCapabilities
};

// Hook for React integration
export const useGeorgianSupport = (initialConfig?: Partial<GeorgianSupportConfig>) => {
  const georgianSupport = initialConfig 
    ? new GeorgianSupport(initialConfig)
    : defaultGeorgianSupport;

  return {
    processMessage: georgianSupport.processMessage.bind(georgianSupport),
    translateError: georgianSupport.translateError.bind(georgianSupport),
    getLocalExample: georgianSupport.getLocalPlatformExample.bind(georgianSupport),
    getTerminologyHelp: georgianSupport.getTerminologyHelp.bind(georgianSupport),
    getRegionalContext: georgianSupport.getRegionalContext.bind(georgianSupport),
    updateConfig: georgianSupport.updateConfig.bind(georgianSupport),
    getState: georgianSupport.getState.bind(georgianSupport),
    getCapabilities: georgianSupport.getCapabilities.bind(georgianSupport),
    getQuickActions: georgianSupport.getQuickActions.bind(georgianSupport),
    getStatus: georgianSupport.getStatus.bind(georgianSupport),
    exportConfig: georgianSupport.exportConfig.bind(georgianSupport),
    importConfig: georgianSupport.importConfig.bind(georgianSupport),
    resetToDefaults: georgianSupport.resetToDefaults.bind(georgianSupport)
  };
};

export default GeorgianSupport;