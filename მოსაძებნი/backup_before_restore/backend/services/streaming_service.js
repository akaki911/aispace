class StreamingService {
  constructor() {
    this.activeStreams = [];
    this.streamStats = {
      total: 0,
      active: 0,
      completed: 0,
      errors: 0
    };
  }

  // Get active streams
  getActiveStreams() {
    return this.activeStreams.filter(stream => stream.active);
  }

  // Add stream
  addStream(streamId, userId, type = 'chat') {
    const stream = {
      id: streamId,
      userId,
      type,
      active: true,
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.activeStreams.push(stream);
    this.streamStats.total++;
    this.streamStats.active++;

    return stream;
  }

  // Remove stream
  removeStream(streamId) {
    const index = this.activeStreams.findIndex(s => s.id === streamId);
    if (index !== -1) {
      this.activeStreams[index].active = false;
      this.streamStats.active--;
      this.streamStats.completed++;
    }
  }

  // Update stream activity
  updateStreamActivity(streamId) {
    const stream = this.activeStreams.find(s => s.id === streamId);
    if (stream) {
      stream.lastActivity = Date.now();
    }
  }

  // Get stream statistics
  getStreamStats() {
    return {
      ...this.streamStats,
      activeStreams: this.getActiveStreams().length,
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup inactive streams
  cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    this.activeStreams = this.activeStreams.filter(stream => {
      if (stream.active && (now - stream.lastActivity) > timeout) {
        stream.active = false;
        this.streamStats.active--;
        return false;
      }
      return true;
    });
  }
}

const streamingService = new StreamingService();

// Cleanup inactive streams every 5 minutes
setInterval(() => {
  streamingService.cleanup();
}, 5 * 60 * 1000);

module.exports = streamingService;