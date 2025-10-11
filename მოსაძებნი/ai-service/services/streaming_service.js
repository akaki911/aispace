
const { EventEmitter } = require('events');

class StreamingService extends EventEmitter {
  constructor() {
    super();
    this.activeStreams = new Map();
    this.cleanupTimeout = 300000; // 5 minutes default
    this.maxActiveStreams = 100;
    console.log('🌊 Streaming Service initialized');
    
    // Fix the missing setupCleanup method
    this.setupPeriodicCleanup();
  }

  // Setup periodic cleanup of inactive streams
  setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupInactiveStreams();
    }, 60000); // Check every minute
  }

  // Clean up inactive streams
  cleanupInactiveStreams() {
    const now = Date.now();
    const cutoffTime = now - this.cleanupTimeout;
    
    for (const [requestId, stream] of this.activeStreams) {
      if (stream.completed && stream.endTime && stream.endTime < cutoffTime) {
        this.activeStreams.delete(requestId);
        console.log(`🗑️ Auto-cleaned inactive stream: ${requestId}`);
      }
    }
    
    // Log active streams count when it grows
    if (this.activeStreams.size > 10) {
      console.log(`⚠️ High number of active streams: ${this.activeStreams.size}`);
    }
  }

  // Create streaming response
  createStream(requestId, personalId) {
    const stream = {
      id: requestId,
      personalId: personalId,
      startTime: Date.now(),
      chunks: [],
      completed: false,
      error: null,
      lastActivity: Date.now()
    };

    this.activeStreams.set(requestId, stream);
    console.log(`🌊 Stream created: ${requestId} (Total active: ${this.activeStreams.size})`);
    
    return stream;
  }

  // Send chunk to stream using Node.js Readable Stream interface
  sendChunk(requestId, chunk, isComplete = false) {
    const stream = this.activeStreams.get(requestId);
    if (!stream) {
      console.error(`🚫 Stream not found: ${requestId}`);
      return false;
    }

    stream.chunks.push({
      content: chunk,
      timestamp: Date.now(),
      sequence: stream.chunks.length
    });

    stream.lastActivity = Date.now();

    if (isComplete) {
      stream.completed = true;
      stream.endTime = Date.now();
      stream.duration = stream.endTime - stream.startTime;
    }

    // Emit chunk event
    this.emit('chunk', {
      requestId: requestId,
      chunk: chunk,
      isComplete: isComplete,
      personalId: stream.personalId
    });

    console.log(`📦 Chunk sent for ${requestId}: ${chunk.length} chars, complete: ${isComplete}`);
    return true;
  }

  // Handle stream error
  handleStreamError(requestId, error) {
    const stream = this.activeStreams.get(requestId);
    if (stream) {
      stream.error = error;
      stream.completed = true;
      stream.endTime = Date.now();
      stream.lastActivity = Date.now();

      this.emit('error', {
        requestId: requestId,
        error: error,
        personalId: stream.personalId
      });

      console.error(`🚫 Stream error for ${requestId}:`, error.message);
    }
  }

  // Close stream with configurable timeout
  closeStream(requestId, immediate = false) {
    const stream = this.activeStreams.get(requestId);
    if (stream) {
      if (!stream.completed) {
        stream.completed = true;
        stream.endTime = Date.now();
        stream.duration = stream.endTime - stream.startTime;
      }

      stream.lastActivity = Date.now();

      // Clean up based on configuration
      const cleanupDelay = immediate ? 0 : this.cleanupTimeout;
      
      setTimeout(() => {
        this.activeStreams.delete(requestId);
        console.log(`🗑️ Stream cleaned up: ${requestId}`);
      }, cleanupDelay);

      this.emit('close', {
        requestId: requestId,
        personalId: stream.personalId,
        duration: stream.duration
      });

      console.log(`🔒 Stream closed: ${requestId}, duration: ${stream.duration}ms`);
      return true;
    }
    return false;
  }

  // Get active streams with enhanced information
  getActiveStreams() {
    return Array.from(this.activeStreams.values()).map(stream => ({
      id: stream.id,
      personalId: stream.personalId,
      startTime: stream.startTime,
      chunksCount: stream.chunks.length,
      completed: stream.completed,
      duration: stream.endTime ? stream.endTime - stream.startTime : Date.now() - stream.startTime,
      lastActivity: stream.lastActivity,
      idle: Date.now() - stream.lastActivity
    }));
  }

  // Simulate streaming from AI response with configurable parameters
  async simulateStreamingResponse(requestId, fullResponse, chunkSize = 50, delay = 100) {
    const words = fullResponse.split(' ');
    let currentChunk = '';
    let wordCount = 0;

    for (const word of words) {
      currentChunk += word + ' ';
      wordCount++;

      if (wordCount >= chunkSize || word === words[words.length - 1]) {
        const isComplete = word === words[words.length - 1];
        
        this.sendChunk(requestId, currentChunk.trim(), isComplete);
        
        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        currentChunk = '';
        wordCount = 0;
      }
    }

    this.closeStream(requestId);
  }

  // Create readable stream (Node.js standard interface)
  createReadableStream(requestId, personalId) {
    const { Readable } = require('stream');
    
    const stream = new Readable({
      objectMode: true,
      read() {
        // Implement read logic if needed
      }
    });

    // Store reference for cleanup
    this.createStream(requestId, personalId);
    
    return stream;
  }

  // Configure service parameters
  configure(options = {}) {
    if (options.cleanupTimeout) this.cleanupTimeout = options.cleanupTimeout;
    if (options.maxActiveStreams) this.maxActiveStreams = options.maxActiveStreams;
    
    console.log(`🔧 Streaming service configured:`, {
      cleanupTimeout: this.cleanupTimeout,
      maxActiveStreams: this.maxActiveStreams
    });
  }

  // Get service statistics
  getStats() {
    const activeStreams = this.getActiveStreams();
    const completedStreams = activeStreams.filter(s => s.completed);
    const averageDuration = completedStreams.length > 0 
      ? completedStreams.reduce((sum, s) => sum + s.duration, 0) / completedStreams.length 
      : 0;

    return {
      totalActiveStreams: activeStreams.length,
      completedStreams: completedStreams.length,
      averageDuration: Math.round(averageDuration),
      oldestStreamAge: activeStreams.length > 0 
        ? Math.max(...activeStreams.map(s => Date.now() - s.startTime))
        : 0
    };
  }
}

module.exports = new StreamingService();
