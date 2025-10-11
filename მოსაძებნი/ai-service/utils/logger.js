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

function info(event, metadata) {
  log('info', event, metadata);
}

function warn(event, metadata) {
  log('warn', event, metadata);
}

function error(event, metadata) {
  log('error', event, metadata);
}

module.exports = {
  info,
  warn,
  error
};
