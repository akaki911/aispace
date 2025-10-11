const fs = require('fs').promises;
const path = require('path');

// Simple embedding function using text statistics for demonstration  
// In production, you would use proper embedding models like sentence-transformers
function generateSimpleEmbedding(text, dimensions = 384) {
  // Create a simple but consistent numerical representation
  // This is a basic approach - real embeddings would use neural networks
  
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq = {};
  const charFreq = {};
  
  // Count word frequencies
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Count character frequencies
  for (const char of text.toLowerCase()) {
    if (char.match(/[ა-ჰ]/) || char.match(/[a-z]/)) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }
  }
  
  // Create embedding vector
  const embedding = new Array(dimensions).fill(0);
  
  // Fill with statistical features
  const textLen = text.length;
  const wordCount = words.length;
  const uniqueWords = Object.keys(wordFreq).length;
  const avgWordLen = words.reduce((sum, word) => sum + word.length, 0) / wordCount;
  
  // Distribute features across dimensions
  embedding[0] = textLen / 1000; // Normalized text length
  embedding[1] = wordCount / 100; // Normalized word count
  embedding[2] = uniqueWords / wordCount; // Lexical diversity
  embedding[3] = avgWordLen / 10; // Average word length
  
  // Use hash-based features for remaining dimensions
  for (let i = 4; i < dimensions; i++) {
    let hash = 0;
    const str = text + i.toString();
    for (let j = 0; j < str.length; j++) {
      const char = str.charCodeAt(j);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    embedding[i] = (hash % 2000 - 1000) / 1000; // Normalize to [-1, 1]
  }
  
  // Normalize the embedding vector
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (norm || 1));
}

/**
 * Build Knowledge Base Script
 * 
 * This script processes markdown files from knowledge_source directory,
 * chunks them into smaller pieces, generates embeddings for each chunk,
 * and saves the results as a searchable knowledge base.
 */

async function main() {
  try {
    console.log('🧠 Starting Knowledge Base construction...');
    console.log('📊 Using statistical embeddings for demonstration (no API required)');

    // 1. Read all markdown files from knowledge_source
    const knowledgeSourceDir = path.join(process.cwd(), 'knowledge_source');
    const files = await fs.readdir(knowledgeSourceDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`📁 Found ${markdownFiles.length} markdown files:`, markdownFiles);

    if (markdownFiles.length === 0) {
      throw new Error('No markdown files found in knowledge_source directory');
    }

    // 2. Process each file and generate chunks
    const allChunks = [];
    
    for (const file of markdownFiles) {
      console.log(`📖 Processing file: ${file}`);
      
      const filePath = path.join(knowledgeSourceDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Split content into chunks by double newlines (paragraphs)
      const rawChunks = content
        .split('\n\n')
        .map(chunk => chunk.trim())
        .filter(chunk => chunk.length > 0);
      
      const chunks = rawChunks.map((chunk, index) => ({
        text: chunk,
        source: file,
        id: `${file}_${allChunks.length + index}`
      }));
      
      allChunks.push(...chunks);
      console.log(`  ✅ Created ${chunks.length} chunks from ${file}`);
    }

    console.log(`📝 Total chunks created: ${allChunks.length}`);

    // 3. Generate embeddings for each chunk
    console.log('🔄 Generating embeddings...');
    const knowledgeBase = [];
    
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      console.log(`  Processing chunk ${i + 1}/${allChunks.length}: ${chunk.id}`);
      
      try {
        // Generate simple statistical embedding (demonstrates the concept)
        // In production, you would use proper models like Transformers.js
        const embedding = generateSimpleEmbedding(chunk.text);
        
        // Store chunk with its embedding
        knowledgeBase.push({
          id: chunk.id,
          text: chunk.text,
          source: chunk.source,
          embedding: embedding,
          createdAt: new Date().toISOString()
        });
        
        console.log(`    ✅ Generated embedding (${embedding.length} dimensions)`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`    ❌ Failed to generate embedding for chunk ${chunk.id}:`, error.message);
        throw error;
      }
    }

    // 4. Save knowledge base to file
    const outputPath = path.join(process.cwd(), 'ai-service', 'knowledge_base.json');
    
    // Ensure ai-service directory exists
    const aiServiceDir = path.dirname(outputPath);
    await fs.mkdir(aiServiceDir, { recursive: true });
    
    // Save with metadata
    const knowledgeBaseData = {
      version: '1.0',
      created: new Date().toISOString(),
      totalChunks: knowledgeBase.length,
      embeddingModel: 'statistical-hash-based',
      embeddingDimensions: 384,
      chunks: knowledgeBase
    };
    
    await fs.writeFile(outputPath, JSON.stringify(knowledgeBaseData, null, 2));
    
    console.log(`💾 Knowledge base saved to: ${outputPath}`);
    console.log(`🎉 Successfully created knowledge base with ${knowledgeBase.length} chunks!`);
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`  - Total files processed: ${markdownFiles.length}`);
    console.log(`  - Total chunks created: ${knowledgeBase.length}`);
    console.log(`  - Embedding model: statistical-hash-based (384 dimensions)`);
    console.log(`  - Knowledge base location: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error building knowledge base:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };