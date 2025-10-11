const fs = require('fs').promises;
const path = require('path');

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