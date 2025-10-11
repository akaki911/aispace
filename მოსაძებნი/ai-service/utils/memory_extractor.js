const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs').promises;
const path = require('path');

let db;
let useLocalStorage = false;

try {
  db = getFirestore();
} catch (error) {
  console.log('🧠 Firebase not available for memory extractor, using local file storage');
  useLocalStorage = true;
}

const MEMORY_DIR = path.join(__dirname, '../memory_facts');

async function ensureMemoryDir() {
  try {
    await fs.access(MEMORY_DIR);
  } catch {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  }
}

async function getUserMemoryFile(userId) {
  await ensureMemoryDir();
  return path.join(MEMORY_DIR, `${userId}.json`);
}

async function readUserFacts(userId) {
  const userFile = await getUserMemoryFile(userId);
  try {
    await fs.access(userFile);
    const data = await fs.readFile(userFile, 'utf8');
    return JSON.parse(data);
  } catch {
    // Create default structure with timestamps
    const defaultData = {
      userId: userId,
      facts: [],
      createdAt: new Date().toISOString(),
      lastUpdated: null,
      totalFacts: 0
    };
    await fs.writeFile(userFile, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

async function writeUserFacts(userId, data) {
  const userFile = await getUserMemoryFile(userId);
  const dataWithTimestamp = {
    ...data,
    lastUpdated: new Date().toISOString(),
    updatedTimestamp: Date.now()
  };
  await fs.writeFile(userFile, JSON.stringify(dataWithTimestamp, null, 2));
}

// მარტივი ტექსტური ამომცნობი - შეიძლება GPT-ს დახმარებით გაუმჯობესება
const extractFacts = (text) => {
  const facts = [];
  const lowerText = text.toLowerCase();

  // პირადი ინფორმაცია
  if (/მყავს\s+ძაღლი/i.test(text)) {
    const match = text.match(/მყავს\s+ძაღლი\s+([^\s.,!?]+)/i);
    if (match) {
      facts.push(`მყავს ძაღლი სახელად ${match[1]}`);
    } else {
      facts.push('მყავს ძაღლი');
    }
  }

  if (/მყავს\s+კატა/i.test(text)) {
    const match = text.match(/მყავს\s+კატა\s+([^\s.,!?]+)/i);
    if (match) {
      facts.push(`მყავს კატა სახელად ${match[1]}`);
    } else {
      facts.push('მყავს კატა');
    }
  }

  // მდებარეობა
  if (/ვცხოვრობ\s+([^.,!?\n]+)/i.test(text)) {
    const match = text.match(/ვცხოვრობ\s+([^.,!?\n]+)/i);
    facts.push(`ცხოვრობს: ${match[1].trim()}`);
  }

  // ოჯახი
  if (/მყავს\s+შვილი/i.test(text)) {
    facts.push('მყავს შვილი');
  }

  if (/მყავს\s+ცოლი/i.test(text)) {
    facts.push('დაქორწინებულია');
  }

  if (/მყავს\s+ქმარი/i.test(text)) {
    facts.push('დაქორწინებულია');
  }

  // პროფესია
  if (/ვმუშაობ\s+([^.,!?\n]+)/i.test(text)) {
    const match = text.match(/ვმუშაობ\s+([^.,!?\n]+)/i);
    facts.push(`მუშაობს: ${match[1].trim()}`);
  }

  // ასაკი
  if (/(\d+)\s+წლის\s+ვარ/i.test(text)) {
    const match = text.match(/(\d+)\s+წლის\s+ვარ/i);
    facts.push(`ასაკი: ${match[1]} წელი`);
  }

  // ჰობი/ინტერესები
  if (/მიყვარს\s+([^.,!?\n]+)/i.test(text)) {
    const match = text.match(/მიყვარს\s+([^.,!?\n]+)/i);
    facts.push(`მიყვარს: ${match[1].trim()}`);
  }

  // ავტომობილი
  if (/მყავს\s+(მანქანა|ავტომობილი)/i.test(text)) {
    facts.push('მყავს ავტომობილი');
  }

  // განათლება
  if (/(დავამთავრე|ვსწავლობ)\s+([^\n]+)/i.test(text)) {
    const match = text.match(/(დავამთავრე|ვსწავლობ)\s+([^\n]+)/i);
    if(match && match[2]){
      facts.push(`განათლება: ${match[2].trim()}`);
    }
  }

  return facts.filter(fact => fact.length > 0 && fact.length < 100); // ფილტრაცია ძალიან გრძელი ფაქტებისგან
};

// Deduplicate facts against existing ones
async function deduplicateFacts(userId, newFacts) {
  try {
    const existingFacts = await getStoredFacts(userId);
    const existingLower = existingFacts.map(fact => fact.toLowerCase().trim());
    
    const uniqueFacts = newFacts.filter(newFact => {
      const newFactLower = newFact.toLowerCase().trim();
      return !existingLower.some(existing => 
        existing === newFactLower || 
        existing.includes(newFactLower) || 
        newFactLower.includes(existing)
      );
    });

    console.log(`🧠 Fact deduplication: ${newFacts.length} → ${uniqueFacts.length} unique facts`);
    return uniqueFacts;
  } catch (error) {
    console.error('🧠 Fact deduplication error:', error);
    return newFacts; // Return original if deduplication fails
  }
}

const storeFacts = async (userId, facts) => {
  if (!facts || facts.length === 0) return [];

  // Validate memory context integrity
  try {
    await validateMemoryContext(userId);
  } catch (error) {
    console.error(`🧠 Memory context corruption detected for user ${userId}:`, error);
    await repairMemoryContext(userId);
  }

  // Deduplicate before storing
  const uniqueFacts = await deduplicateFacts(userId, facts);
  if (uniqueFacts.length === 0) {
    console.log(`🧠 No new unique facts to store for user ${userId}`);
    return [];
  }

  try {
    if (!useLocalStorage && db) {
      const memoryRef = db.collection('memory').doc(userId);
      const doc = await memoryRef.get();
      const existing = doc.exists ? doc.data() : { facts: [], lastUpdated: null };

      // Use deduplicated facts (already filtered)
      const newFacts = uniqueFacts;

      if (newFacts.length > 0) {
        const updatedData = {
          facts: [...(existing.facts || []), ...newFacts],
          lastUpdated: new Date().toISOString(),
          totalFacts: (existing.facts || []).length + newFacts.length
        };

        await memoryRef.set(updatedData, { merge: true });
        console.log(`🧠 Memory updated in Firebase for user ${userId}: ${newFacts.length} new facts stored`);
        return newFacts;
      }
      return [];
    } else {
      // Fallback to local per-user storage
      const existing = await readUserFacts(userId);

      const newFacts = facts.filter(fact => 
        !existing.facts.some(existingFact => 
          existingFact.toLowerCase() === fact.toLowerCase()
        )
      );

      if (newFacts.length > 0) {
        const updatedData = {
          ...existing,
          facts: [...(existing.facts || []), ...newFacts],
          totalFacts: (existing.facts || []).length + newFacts.length
        };

        await writeUserFacts(userId, updatedData);
        console.log(`🧠 Memory updated locally for user ${userId}: ${newFacts.length} new facts stored`);
        return newFacts;
      }
      return [];
    }
  } catch (error) {
    console.error('❌ Memory storage error:', error);
    
    // Try local per-user storage as fallback
    try {
      const existing = await readUserFacts(userId);

      const newFacts = facts.filter(fact => 
        !existing.facts.some(existingFact => 
          existingFact.toLowerCase() === fact.toLowerCase()
        )
      );

      if (newFacts.length > 0) {
        const updatedData = {
          ...existing,
          facts: [...(existing.facts || []), ...newFacts],
          totalFacts: (existing.facts || []).length + newFacts.length
        };

        await writeUserFacts(userId, updatedData);
        console.log(`🧠 Memory updated locally (fallback) for user ${userId}: ${newFacts.length} new facts stored`);
        return newFacts;
      }
      return [];
    } catch (fallbackError) {
      console.error('❌ Local memory fallback failed:', fallbackError);
      return [];
    }
  }
};

const getStoredFacts = async (userId) => {
  try {
    if (!useLocalStorage && db) {
      const memoryRef = db.collection('memory').doc(userId);
      const doc = await memoryRef.get();

      if (doc.exists) {
        const data = doc.data();
        console.log(`🧠 Facts retrieved from Firebase for user ${userId}`);
        return data.facts || [];
      }
      return [];
    } else {
      // Fallback to local per-user storage
      const userData = await readUserFacts(userId);
      if (userData && userData.facts) {
        console.log(`🧠 Facts retrieved locally for user ${userId}:`, {
          totalFacts: userData.totalFacts,
          lastUpdated: userData.lastUpdated
        });
        return userData.facts || [];
      }
      return [];
    }
  } catch (error) {
    console.error('❌ Memory retrieval error:', error);
    
    // Try local per-user storage as fallback
    try {
      const userData = await readUserFacts(userId);
      if (userData && userData.facts) {
        console.log(`🧠 Facts retrieved locally (fallback) for user ${userId}:`, {
          totalFacts: userData.totalFacts,
          lastUpdated: userData.lastUpdated
        });
        return userData.facts || [];
      }
      return [];
    } catch (fallbackError) {
      console.error('❌ Local memory fallback failed:', fallbackError);
      return [];
    }
  }
};

// Validate memory context integrity
async function validateMemoryContext(userId) {
  try {
    const userData = await readUserFacts(userId);
    
    // Check for corrupted data structure
    if (!userData || typeof userData !== 'object') {
      throw new Error('Invalid memory data structure');
    }
    
    // Validate required fields
    if (!Array.isArray(userData.facts)) {
      throw new Error('Facts array is corrupted');
    }
    
    // Check for circular references or malformed facts
    userData.facts.forEach((fact, index) => {
      if (typeof fact !== 'string' || fact.length === 0) {
        throw new Error(`Corrupted fact at index ${index}`);
      }
    });
    
    console.log(`🧠 Memory context validation passed for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`🧠 Memory context validation failed for user ${userId}:`, error);
    throw error;
  }
}

// Repair corrupted memory context
async function repairMemoryContext(userId) {
  try {
    console.log(`🔧 Attempting to repair memory context for user ${userId}`);
    
    // Create backup of corrupted data
    const userFile = await getUserMemoryFile(userId);
    const backupFile = `${userFile}.corrupted.${Date.now()}`;
    
    try {
      const corruptedData = await fs.readFile(userFile, 'utf8');
      await fs.writeFile(backupFile, corruptedData);
      console.log(`🔧 Corrupted data backed up to ${backupFile}`);
    } catch (backupError) {
      console.warn(`⚠️ Could not backup corrupted data:`, backupError);
    }
    
    // Create clean memory structure
    const cleanData = {
      userId: userId,
      facts: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalFacts: 0,
      repaired: true,
      repairedAt: new Date().toISOString()
    };
    
    await writeUserFacts(userId, cleanData);
    console.log(`✅ Memory context repaired for user ${userId}`);
    
    return cleanData;
  } catch (error) {
    console.error(`❌ Memory context repair failed for user ${userId}:`, error);
    throw error;
  }
}

module.exports = {
  extractFacts,
  storeFacts,
  getStoredFacts,
  deduplicateFacts,
  validateMemoryContext,
  repairMemoryContext
};