
// Memory Migration Utility v2.0
// ავტომატიზებული მიგრაცია V1 -> V2 ფორმატისთვის

const fs = require('fs').promises;
const path = require('path');

class MemoryMigrator {
  constructor() {
    this.schemaVersion = 2;
  }

  async migrateMemoryFile(personalId) {
    try {
      const filePath = path.join(__dirname, '../memory_data', `${personalId}.json`);
      const rawData = await fs.readFile(filePath, 'utf8');
      const memoryData = JSON.parse(rawData);

      console.log(`🔄 [Memory Migrator] Starting migration for ${personalId}`);
      
      const migratedData = this.migrateMemoryStructure(memoryData);
      
      // Backup original
      const backupPath = filePath + `.backup.${Date.now()}`;
      await fs.writeFile(backupPath, rawData);
      
      // Write migrated version
      await fs.writeFile(filePath, JSON.stringify(migratedData, null, 2));
      
      console.log(`✅ [Memory Migrator] Migration completed for ${personalId}`);
      return migratedData;
      
    } catch (error) {
      console.error(`❌ [Memory Migrator] Migration failed for ${personalId}:`, error);
      throw error;
    }
  }

  migrateMemoryStructure(memoryData) {
    const personalId = memoryData.personalId || "01019062020";
    const firebaseUid = memoryData.firebaseUid || "6H0Gwt0JRSqhNK1a4cvY";

    // პერსონა და სისტემური როლის გაყოფა
    const systemRole = "SUPER_ADMIN";
    const personaRole = (memoryData.personalInfo?.role === "developer") ? "developer" : "user";

    // სახელის გასწორება
    const name = (memoryData.personalInfo?.name && memoryData.personalInfo.name !== "გიორგი")
      ? memoryData.personalInfo.name
      : "აკაკი ცინცაძე";

    const memoryKey = personalId || firebaseUid;

    // ასაკი → რიცხვად
    const ageNum = Number(memoryData.personalInfo?.age || 25);

    // memoryUsage → ერთეულით
    const memUsage = (typeof memoryData.stats?.memoryUsage === 'number')
      ? { value: memoryData.stats.memoryUsage, unit: "MB" }
      : { value: 0, unit: "MB" };

    return {
      ...memoryData,
      schemaVersion: this.schemaVersion,
      lastSyncedAt: new Date().toISOString(),
      exportSource: "AI Memory Manager v2.0",
      personalId,
      firebaseUid,
      memoryKey,
      personalInfo: {
        ...memoryData.personalInfo,
        name,
        age: isNaN(ageNum) ? 25 : ageNum,
      },
      systemRole,
      personaRole,
      stats: {
        ...memoryData.stats,
        memoryUsage: memUsage,
      },
    };
  }

  // ხაზზე გამოყენებისთვის
  static async quickMigrate(personalId = "01019062020") {
    const migrator = new MemoryMigrator();
    return await migrator.migrateMemoryFile(personalId);
  }
}

module.exports = MemoryMigrator;

// CLI გამოყენება: node memory_migrator.js
if (require.main === module) {
  const personalId = process.argv[2] || "01019062020";
  MemoryMigrator.quickMigrate(personalId)
    .then(() => console.log('✅ Migration completed successfully'))
    .catch(err => console.error('❌ Migration failed:', err));
}
