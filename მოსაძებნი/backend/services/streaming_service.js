class StreamingService {
  constructor() {
    this.activeStreams = [];
    this.streamStats = {
      total: 0,
      active: 0,
      completed: 0,
      errors: 0
    };
    this.completedStreams = [];
    this.maxCompleted = 50;
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
      lastActivity: Date.now(),
      chunkCount: 0,
      bytes: 0,
      firstChunkAt: null,
      timeToFirstChunk: null,
      status: 'active',
      metadata: {}
    };

    this.activeStreams.push(stream);
    this.streamStats.total++;
    this.streamStats.active++;

    return stream;
  }

  recordChunk(streamId, chunkSize = 0) {
    const stream = this.activeStreams.find(s => s.id === streamId && s.active);
    if (!stream) {
      return;
    }

    stream.chunkCount += 1;
    stream.bytes += chunkSize;
    stream.lastActivity = Date.now();

    if (!stream.firstChunkAt) {
      stream.firstChunkAt = stream.lastActivity;
      stream.timeToFirstChunk = stream.firstChunkAt - stream.startTime;
    }
  }

  // Update stream activity
  updateStreamActivity(streamId) {
    const stream = this.activeStreams.find(s => s.id === streamId);
    if (stream) {
      stream.lastActivity = Date.now();
    }
  }

  completeStream(streamId, status = 'completed', extra = {}) {
    const stream = this.activeStreams.find(s => s.id === streamId);
    if (!stream || !stream.active) {
      return;
    }

    stream.active = false;
    stream.status = status;
    stream.completedAt = Date.now();
    stream.duration = stream.completedAt - stream.startTime;
    stream.metadata = { ...stream.metadata, ...extra };

    this.streamStats.active = Math.max(0, this.streamStats.active - 1);
    if (status === 'completed' || status === 'non_stream') {
      this.streamStats.completed++;
    } else if (status === 'error') {
      this.streamStats.errors++;
    }

    this.completedStreams.push({ ...stream });
    if (this.completedStreams.length > this.maxCompleted) {
      this.completedStreams.shift();
    }
  }

  removeStream(streamId) {
    this.completeStream(streamId, 'completed');
  }

  // Get stream statistics
  getStreamStats() {
    const active = this.getActiveStreams();
    const recent = this.completedStreams.slice(-10).reverse();

    const aggregate = recent.reduce(
      (acc, stream) => {
        acc.chunkCount += stream.chunkCount || 0;
        acc.timeToFirstChunk += stream.timeToFirstChunk || 0;
        acc.duration += stream.duration || 0;
        return acc;
      },
      { chunkCount: 0, timeToFirstChunk: 0, duration: 0 }
    );

    const divisor = recent.length || 1;

    return {
      ...this.streamStats,
      activeStreams: active.map(({ id, userId, startTime, chunkCount }) => ({
        id,
        userId,
        startedAt: startTime,
        chunkCount,
      })),
      recentStreams: recent,
      averages: {
        chunkCount: Math.round((aggregate.chunkCount / divisor) * 10) / 10,
        timeToFirstChunk: Math.round((aggregate.timeToFirstChunk / divisor) || 0),
        duration: Math.round((aggregate.duration / divisor) || 0),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Cleanup inactive streams
  cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    this.activeStreams = this.activeStreams.filter(stream => {
      if (stream.active && now - stream.lastActivity > timeout) {
        this.completeStream(stream.id, 'timeout');
        return false;
      }
      return stream.active;
    });
  }
}

const streamingService = new StreamingService();

// Cleanup inactive streams every 5 minutes
setInterval(() => {
  streamingService.cleanup();
}, 5 * 60 * 1000);

module.exports = streamingService;