
const path = require('path');
const fs = require('fs').promises;
const memorySyncService = require('./memory_sync_service');

/**
 * გურულოს მეხსიერების სპეციალიზებული სერვისი
 * მართავს გურულო-სპეციფიკურ მეხსიერების ოპერაციებს
 */
class GuruloMemoryService {
  constructor() {
    this.memoryPath = path.join(__dirname, '../memory_data');
    console.log('🧠 გურულოს მეხსიერების სერვისი ინიციალიზდა');
  }

  /**
   * მომხმარებლის გურულო მეხსიერების წაკითხვა
   */
  async getGuruloMemory(userId) {
    try {
      const memoryFile = path.join(this.memoryPath, `${userId}.json`);
      const data = await fs.readFile(memoryFile, 'utf8');
      const memoryData = JSON.parse(data);
      
      // უზრუნველვყოფთ გურულოს მეხსიერების კომპონენტების არსებობას
      const guruloMemory = {
        guruloInteractions: memoryData.guruloInteractions || [],
        guruloContext: memoryData.guruloContext || [],
        guruloPreferences: memoryData.guruloPreferences || {
          responseStyle: 'detailed',
          language: 'ka',
          codeCommentStyle: 'georgian',
          explanationLevel: 'intermediate'
        },
        guruloFacts: memoryData.guruloFacts || []
      };
      
      console.log(`🧠 გურულოს მეხსიერება წაკითხულია მომხმარებლისთვის: ${userId}`);
      return guruloMemory;
    } catch (error) {
      console.log(`🧠 ახალი გურულო მეხსიერება იქმნება მომხმარებლისთვის: ${userId}`);
      return this.createEmptyGuruloMemory();
    }
  }

  /**
   * ცარიელი გურულო მეხსიერების შექმნა
   */
  createEmptyGuruloMemory() {
    return {
      guruloInteractions: [],
      guruloContext: [],
      guruloPreferences: {
        responseStyle: 'detailed',
        language: 'ka',
        codeCommentStyle: 'georgian',
        explanationLevel: 'intermediate'
      },
      guruloFacts: []
    };
  }

  /**
   * ინტერაქციის დამახსოვრება
   */
  async rememberInteraction(userId, query, response, context = '') {
    try {
      const memoryData = await this.getFullMemoryData(userId);
      const interaction = {
        id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        response,
        context,
        timestamp: Date.now()
      };

      memoryData.guruloInteractions.push(interaction);
      
      // მხოლოდ უახლესი 50 ინტერაქცია შევინახოთ
      if (memoryData.guruloInteractions.length > 50) {
        memoryData.guruloInteractions = memoryData.guruloInteractions.slice(-50);
      }

      await this.saveMemoryData(userId, memoryData);
      console.log(`💬 გურულო ინტერაქცია შენახულია: ${userId}`);
      
      return interaction;
    } catch (error) {
      console.error(`❌ ინტერაქციის შენახვის შეცდომა: ${error.message}`);
      throw error;
    }
  }

  /**
   * კონტექსტის განახლება
   */
  async updateContext(userId, projectName, currentTask, workingFiles = []) {
    try {
      const memoryData = await this.getFullMemoryData(userId);
      const contextEntry = {
        id: `context_${Date.now()}`,
        projectName,
        currentTask,
        workingFiles,
        lastActivity: new Date().toISOString(),
        timestamp: Date.now()
      };

      memoryData.guruloContext.push(contextEntry);
      
      // მხოლოდ უახლესი 10 კონტექსტი შევინახოთ
      if (memoryData.guruloContext.length > 10) {
        memoryData.guruloContext = memoryData.guruloContext.slice(-10);
      }

      await this.saveMemoryData(userId, memoryData);
      console.log(`🎯 გურულო კონტექსტი განახლდა: ${userId}`);
      
      return contextEntry;
    } catch (error) {
      console.error(`❌ კონტექსტის განახლების შეცდომა: ${error.message}`);
      throw error;
    }
  }

  /**
   * ფაქტის დამახსოვრება
   */
  async rememberFact(userId, category, fact, confidence = 0.8, source = 'gurulo_inferred') {
    try {
      const memoryData = await this.getFullMemoryData(userId);
      const factEntry = {
        id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category,
        fact,
        confidence,
        timestamp: Date.now(),
        source
      };

      memoryData.guruloFacts.push(factEntry);
      
      // მხოლოდ უახლესი 100 ფაქტი შევინახოთ
      if (memoryData.guruloFacts.length > 100) {
        memoryData.guruloFacts = memoryData.guruloFacts.slice(-100);
      }

      await this.saveMemoryData(userId, memoryData);
      console.log(`💡 გურულო ფაქტი შენახულია: ${fact.substring(0, 50)}...`);
      
      return factEntry;
    } catch (error) {
      console.error(`❌ ფაქტის შენახვის შეცდომა: ${error.message}`);
      throw error;
    }
  }

  /**
   * პრეფერენსების განახლება
   */
  async updatePreferences(userId, preferences) {
    try {
      const memoryData = await this.getFullMemoryData(userId);
      memoryData.guruloPreferences = {
        ...memoryData.guruloPreferences,
        ...preferences
      };

      await this.saveMemoryData(userId, memoryData);
      console.log(`⚙️ გურულო პრეფერენსები განახლდა: ${userId}`);
      
      return memoryData.guruloPreferences;
    } catch (error) {
      console.error(`❌ პრეფერენსების განახლების შეცდომა: ${error.message}`);
      throw error;
    }
  }

  /**
   * სრული მეხსიერების მონაცემების წაკითხვა
   */
  async getFullMemoryData(userId) {
    try {
      const memoryFile = path.join(this.memoryPath, `${userId}.json`);
      const data = await fs.readFile(memoryFile, 'utf8');
      const memoryData = JSON.parse(data);
      
      // უზრუნველვყოფთ გურულოს კომპონენტების არსებობას
      if (!memoryData.guruloInteractions) memoryData.guruloInteractions = [];
      if (!memoryData.guruloContext) memoryData.guruloContext = [];
      if (!memoryData.guruloPreferences) {
        memoryData.guruloPreferences = {
          responseStyle: 'detailed',
          language: 'ka',
          codeCommentStyle: 'georgian',
          explanationLevel: 'intermediate'
        };
      }
      if (!memoryData.guruloFacts) memoryData.guruloFacts = [];
      
      return memoryData;
    } catch (error) {
      // თუ ფაილი არ არსებობს, ვქმნით ახალ სტრუქტურას
      return {
        personalInfo: {
          name: "Developer",
          preferredLanguage: "ka",
          role: "developer"
        },
        facts: [],
        grammarFixes: [],
        savedRules: [],
        errorLogs: [],
        contextActions: [],
        codePreferences: [],
        stats: {
          totalRules: 0,
          activeRules: 0,
          resolvedErrors: 0,
          totalActions: 0,
          accuracyRate: 0,
          memoryUsage: 0
        },
        ...this.createEmptyGuruloMemory(),
        lastSync: new Date().toISOString()
      };
    }
  }

  /**
   * მეხსიერების მონაცემების შენახვა
   */
  async saveMemoryData(userId, memoryData) {
    // სინქრონიზაცია memory sync service-ის გავლით
    memorySyncService.queueSync(userId, memoryData, 'gurulo_update');
    console.log(`💾 გურულო მეხსიერება შენახულია სინქრონიზაციის რიგში: ${userId}`);
  }

  /**
   * მეხსიერების სტატისტიკა
   */
  async getMemoryStats(userId) {
    try {
      const guruloMemory = await this.getGuruloMemory(userId);
      return {
        totalInteractions: guruloMemory.guruloInteractions.length,
        totalFacts: guruloMemory.guruloFacts.length,
        contextEntries: guruloMemory.guruloContext.length,
        preferences: guruloMemory.guruloPreferences,
        lastInteraction: guruloMemory.guruloInteractions.length > 0 
          ? guruloMemory.guruloInteractions[guruloMemory.guruloInteractions.length - 1].timestamp
          : null
      };
    } catch (error) {
      console.error(`❌ მეხსიერების სტატისტიკის წაკითხვის შეცდომა: ${error.message}`);
      return null;
    }
  }
}

module.exports = new GuruloMemoryService();
