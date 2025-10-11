const fs = require('fs').promises;
const path = require('path');

/**
 * Semantic Search Service
 * 
 * This service provides semantic search capabilities for the knowledge base.
 * It loads the pre-built knowledge base and provides functions to find
 * semantically similar content chunks based on vector similarity.
 */

class SemanticSearchService {
  constructor() {
    this.knowledgeBase = null;
    this.isLoaded = false;
  }

  /**
   * Load knowledge base from JSON file
   * This should be called once when the server starts
   */
  async loadKnowledgeBase() {
    try {
      console.log('📚 Loading knowledge base...');

      const knowledgeBasePath = path.join(__dirname, '..', 'knowledge_base.json');

      // Check if knowledge base exists
      try {
        await fs.access(knowledgeBasePath);
      } catch (error) {
        console.warn('⚠️ Knowledge base not found. Please run build_knowledge_base.js first.');
        this.knowledgeBase = { chunks: [] };
        this.isLoaded = true;
        return;
      }

      const data = await fs.readFile(knowledgeBasePath, 'utf-8');
      this.knowledgeBase = JSON.parse(data);
      this.isLoaded = true;

      console.log(`✅ Knowledge base loaded: ${this.knowledgeBase.totalChunks} chunks`);
      console.log(`📊 Embedding model: ${this.knowledgeBase.embeddingModel}`);
      console.log(`Dimensions: ${this.knowledgeBase.embeddingDimensions}`);

    } catch (error) {
      console.error('❌ Error loading knowledge base:', error.message);
      // Initialize with empty knowledge base to prevent crashes
      this.knowledgeBase = { chunks: [] };
      this.isLoaded = true;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} Similarity score between -1 and 1
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Generate a simple embedding for a string (replace with a real embedding model)
   * This is a placeholder and should be replaced with a proper embedding generation mechanism.
   * For demonstration purposes, it returns a fixed-length array of numbers.
   * @param {string} text - The input text
   * @returns {number[]} A simple embedding vector
   */
  generateSimpleEmbedding(text) {
    // In a real application, you would use an NLP library or API to generate embeddings.
    // For this example, we'll create a basic vector based on character codes.
    const embedding = new Array(this.knowledgeBase.embeddingDimensions || 10).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      // Distribute character codes across the embedding dimensions
      embedding[i % embedding.length] = (embedding[i % embedding.length] + charCode) / 255.0;
    }
    // Normalize the embedding (simple normalization)
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return embedding;
    return embedding.map(val => val / norm);
  }


  /**
   * Find the most similar chunks to a query (string or embedding vector)
   * @param {string|number[]} query - The user's query string or embedding vector
   * @param {number} limit - Number of top results to return (default: 5)
   * @returns {Array} Array of similar chunks with similarity scores
   */
  findSimilarChunks(query, limit = 5) {
    // Handle both embedding and string inputs
    const queryEmbedding = typeof query === 'string' ? 
      this.generateSimpleEmbedding(query) : query;

    if (!this.isLoaded) {
      console.warn('⚠️ Knowledge base not loaded');
      return [];
    }

    if (!this.knowledgeBase?.chunks || this.knowledgeBase.chunks.length === 0) {
      console.warn('⚠️ No chunks in knowledge base');
      return [];
    }

    console.log(`🔍 Searching through ${this.knowledgeBase.chunks.length} chunks...`);

    // Calculate similarity for each chunk
    const similarities = this.knowledgeBase.chunks.map(chunk => {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        ...chunk,
        similarity: similarity
      };
    });

    // Sort by similarity (highest first) and return top K
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit) // Use 'limit' instead of 'topK'
      .map(result => {
        const rawText = result.text || '';
        const maxLength = 600;
        const trimmed = rawText.length > maxLength
          ? `${rawText.slice(0, maxLength)}…`
          : rawText;

        return {
          ...result,
          rawText,
          content: trimmed,
          snippet: trimmed,
          originType: result.originType || 'knowledge_base',
        };
      });

    console.log(`🎯 Found ${results.length} similar chunks:`);
    results.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.id} (similarity: ${result.similarity.toFixed(4)}, chars: ${result.content.length})`
      );
    });

    return results;
  }

  /**
   * Get knowledge base statistics
   * @returns {Object} Statistics about the loaded knowledge base
   */
  getStats() {
    if (!this.isLoaded) {
      return { loaded: false };
    }

    return {
      loaded: true,
      totalChunks: this.knowledgeBase?.totalChunks || 0,
      embeddingModel: this.knowledgeBase?.embeddingModel || 'unknown',
      embeddingDimensions: this.knowledgeBase?.embeddingDimensions || 0,
      created: this.knowledgeBase?.created || null,
      version: this.knowledgeBase?.version || 'unknown'
    };
  }

  /**
   * Check if the service is ready to use
   * @returns {boolean} True if knowledge base is loaded
   */
  isReady() {
    return this.isLoaded && this.knowledgeBase && Array.isArray(this.knowledgeBase.chunks);
  }
}

// Create singleton instance
const semanticSearchService = new SemanticSearchService();

module.exports = {
  semanticSearchService,
  SemanticSearchService
};