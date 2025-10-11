const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const resolveAssistantMode = () => {
  return (process.env.ASSISTANT_MODE || 'build').toLowerCase() === 'plan' ? 'plan' : 'build';
};

const buildModeGuard = (req, res, next) => {
  const mode = resolveAssistantMode();
  res.locals.assistantMode = mode;

  if (mode === 'plan' && !READ_ONLY_METHODS.has(req.method)) {
    return res.status(423).json({
      success: false,
      error: 'READ_ONLY_MODE',
      message: 'Assistant is in plan-only mode. Write operations are deferred until build mode is enabled.',
      timestamp: new Date().toISOString(),
    });
  }

  return next();
};

module.exports = {
  buildModeGuard,
  resolveAssistantMode,
};
