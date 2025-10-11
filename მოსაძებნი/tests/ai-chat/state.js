const path = require('path');
const fs = require('fs');

const state = {
  corrId: `ai_chat_e2e_${Date.now()}`,
  artifactDir: null,
  networkLog: [],
  streamEvents: {
    primary: [],
    fallback: [],
  },
  results: [],
  summary: {
    startedAt: Date.now(),
  },
};

state.ensureArtifactDir = () => {
  if (!state.artifactDir) {
    state.artifactDir = path.join(__dirname, '..', 'artifacts', state.corrId);
    fs.mkdirSync(state.artifactDir, { recursive: true });
  }
  return state.artifactDir;
};

state.recordNetworkTrace = (entry) => {
  state.networkLog.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
};

state.recordStreamEvent = (kind, event) => {
  const bucket = state.streamEvents[kind] || (state.streamEvents[kind] = []);
  bucket.push({
    ...event,
    at: Date.now(),
  });
};

state.recordResult = (name, status, extra) => {
  state.results.push({ name, status, ...extra });
  if (status === 'failed') {
    state.summary.failed = true;
  }
};

state.writeArtifact = (relativePath, data) => {
  const baseDir = state.ensureArtifactDir();
  const targetPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  fs.writeFileSync(targetPath, payload);
  return targetPath;
};

state.persistArtifacts = () => {
  state.writeArtifact('network.json', state.networkLog);
  state.writeArtifact('report.json', {
    corrId: state.corrId,
    startedAt: state.summary.startedAt,
    finishedAt: Date.now(),
    results: state.results,
    streamMetrics: state.streamSummary || null,
  });
  const { primary, fallback } = state.streamEvents;
  if (primary.length) {
    state.writeArtifact('chunks.log',
      primary
        .map((entry) => `${new Date(entry.at).toISOString()} ${entry.event} ${JSON.stringify(entry.data)}`)
        .join('\n'),
    );
  }
  if (fallback.length) {
    state.writeArtifact('fallback/chunks.log',
      fallback
        .map((entry) => `${new Date(entry.at).toISOString()} ${entry.event} ${JSON.stringify(entry.data)}`)
        .join('\n'),
    );
  }
};

process.on('exit', () => {
  if (!state.artifactDir) {
    return;
  }
  state.persistArtifacts();
  const statusLabel = state.summary.failed ? 'FAILED' : 'PASSED';
  console.log(`AI Chat smoke: ${statusLabel} [artifacts=${state.artifactDir}]`);
});

module.exports = state;
