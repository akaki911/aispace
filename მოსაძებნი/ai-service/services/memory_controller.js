const fs = require('fs').promises;
const path = require('path');
const { saveMemory, retrieveMemories } = require('../context/user_preferences');

// Memory storage configuration
const MEMORY_BASE_PATH = process.env.MEMORY_STORAGE_PATH || './memory_data';
const FACTS_BASE_PATH = process.env.MEMORY_FACTS_PATH || './memory_facts';

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(MEMORY_BASE_PATH, { recursive: true });
    await fs.mkdir(FACTS_BASE_PATH, { recursive: true });
    console.log('🧠 Memory directories initialized');
  } catch (error) {
    console.error('❌ Failed to create memory directories:', error);
  }
}

// Initialize on load
ensureDirectories();

// Get user memory
async function getMemory(userId) {
  try {
    const memoryPath = path.join(MEMORY_BASE_PATH, `${userId}.json`);
    const data = await fs.readFile(memoryPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`📝 No existing memory for user ${userId}, creating new`);
    return { data: '', timestamp: new Date().toISOString() };
  }
}

async function detectAndStoreMemories(userId, content) {
  if (!content || typeof content !== 'string') {
    return;
  }

  try {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return;
    }

    let existingMemories = [];
    try {
      const { memories } = await retrieveMemories(userId, null, { limit: 20 });
      existingMemories = Array.isArray(memories) ? memories : [];
    } catch (error) {
      console.warn('⚠️ Memory retrieval skipped during extraction:', error.message);
    }

    const existingByKey = new Map(
      existingMemories.map(memory => [memory.key, memory])
    );

    const patterns = [
      {
        key: 'personal.name',
        regex: /(?:ჩემი\s+სახელი\s+არის|მე\s+მქვია|I\s+am\s+called|my\s+name\s+is)\s+([A-Za-zა-ჰ\s]{2,60})/i
      },
      {
        key: 'preferences.communicationStyle',
        regex: /(?:მე\s+მირჩევნია|I\s+prefer)\s+([^.!?\n]{3,80})/i
      },
      {
        key: 'preferences.language',
        regex: /(?:პასუხი|response).{0,20}(?:ქართული|Georgian|ინგლისური|English)/i,
        transform: match => (/ქართული|Georgian/i.test(match[0]) ? 'ქართული' : 'ინგლისური')
      },
      {
        key: 'personal.role',
        regex: /(?:ვმუშაობ\s+როგორც|I\s+work\s+as)\s+([^.!?\n]{3,80})/i
      }
    ];

    const operations = [];

    for (const descriptor of patterns) {
      const match = normalized.match(descriptor.regex);
      if (!match) {
        continue;
      }

      const rawValue = typeof descriptor.transform === 'function'
        ? descriptor.transform(match)
        : match[1] || match[0];

      if (!rawValue) {
        continue;
      }

      const cleanValue = String(rawValue).trim();
      if (!cleanValue) {
        continue;
      }

      const existing = existingByKey.get(descriptor.key);
      if (existing && String(existing.value).toLowerCase() === cleanValue.toLowerCase()) {
        continue;
      }

      operations.push(
        saveMemory(userId, {
          key: descriptor.key,
          value: cleanValue,
          userConfirmed: false,
          source: 'conversation',
          createdAt: new Date()
        }).catch(error => {
          console.warn('⚠️ Memory auto-save skipped:', error.message);
        })
      );
    }

    // Additional heuristic for explicit Georgian preference phrases
    if (/ქართული\s+პასუხები/i.test(normalized) || /prefer\s+Georgian/i.test(normalized)) {
      const existingPreference = existingByKey.get('preferences.language');
      if (!existingPreference || existingPreference.value !== 'ქართული') {
        operations.push(
          saveMemory(userId, {
            key: 'preferences.language',
            value: 'ქართული',
            userConfirmed: false,
            source: 'conversation',
            createdAt: new Date()
          }).catch(error => {
            console.warn('⚠️ Language memory save failed:', error.message);
          })
        );
      }
    }

    await Promise.all(operations);
  } catch (error) {
    console.warn('⚠️ Memory extraction failure:', error.message);
  }
}

// Add to memory
async function addToMemory(userId, content) {
  try {
    const existing = await getMemory(userId);
    const updated = {
      data: existing.data + '\n' + content,
      timestamp: new Date().toISOString()
    };

    const memoryPath = path.join(MEMORY_BASE_PATH, `${userId}.json`);
    await fs.writeFile(memoryPath, JSON.stringify(updated, null, 2));
    console.log(`🧠 Memory updated for user ${userId}`);
    await detectAndStoreMemories(userId, content);
    return updated;
  } catch (error) {
    console.error('❌ Failed to add to memory:', error);
    throw error;
  }
}

// Store grammar correction
async function storeGrammarCorrection(userId, originalText, correctedText) {
  try {
    const factsPath = path.join(FACTS_BASE_PATH, `${userId}.json`);
    let facts = [];

    try {
      const data = await fs.readFile(factsPath, 'utf8');
      facts = JSON.parse(data);
    } catch (readError) {
      // File doesn't exist, start with empty array
    }

    facts.push({
      type: 'grammar_correction',
      original: originalText,
      corrected: correctedText,
      timestamp: new Date().toISOString()
    });

    await fs.writeFile(factsPath, JSON.stringify(facts, null, 2));
    console.log(`✏️ Grammar correction stored for user ${userId}`);
  } catch (error) {
    console.error('❌ Failed to store grammar correction:', error);
  }
}

// Get grammar fixes
async function getGrammarFixes(userId) {
  try {
    const factsPath = path.join(FACTS_BASE_PATH, `${userId}.json`);
    const data = await fs.readFile(factsPath, 'utf8');
    const facts = JSON.parse(data);
    return facts.filter(fact => fact.type === 'grammar_correction');
  } catch (error) {
    return [];
  }
}

// Remember a fact
async function rememberFact(userId, factContent) {
  try {
    const factsPath = path.join(FACTS_BASE_PATH, `${userId}.json`);
    let facts = [];

    try {
      const data = await fs.readFile(factsPath, 'utf8');
      facts = JSON.parse(data);
    } catch (readError) {
      // File doesn't exist, start with empty array
    }

    facts.push({
      type: 'fact',
      content: factContent,
      timestamp: new Date().toISOString()
    });

    await fs.writeFile(factsPath, JSON.stringify(facts, null, 2));
    console.log(`💡 Fact remembered for user ${userId}`);
  } catch (error) {
    console.error('❌ Failed to remember fact:', error);
  }
}


module.exports = {
  getMemory,
  addToMemory,
  storeGrammarCorrection,
  getGrammarFixes,
  rememberFact
};