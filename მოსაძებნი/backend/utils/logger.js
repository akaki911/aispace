function log(level, event, metadata = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

module.exports = {
  info(event, metadata) {
    log('info', event, metadata);
  },
  warn(event, metadata) {
    log('warn', event, metadata);
  },
  error(event, metadata) {
    log('error', event, metadata);
  }
};
