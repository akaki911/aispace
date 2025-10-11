const clamp = (value, min, max) => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const INCIDENT = {
  startedAt: Date.now() - 8 * 60 * 1000,
  regressions: 2,
  queueDepth: 3,
  responseMs: 2150,
  throughputPerMin: 4.6,
  successRate: 83.2,
  testsPassingPercent: 68,
  activePercent: 64,
  percent: 62,
  mode: 'აღდგენის რეჟიმი',
  headline: '⚠️ ინტეგრაციის ტესტებმა განახლება შეაჩერა',
  status:
    'Recovery mode: payment-webhook და activity-sync სცენარები ჩავარდა, გურულო აგროვებს ლოგებს.',
  focus: 'payment-webhook & activity-sync integration tests',
};

const OSCILLATION_PERIOD_MS = 90_000;

const computeMetrics = () => {
  const now = Date.now();
  const phase = Math.sin((now - INCIDENT.startedAt) / OSCILLATION_PERIOD_MS);

  const queueDepth = clamp(Math.round(INCIDENT.queueDepth + phase), 1, 5);
  const successRate = clamp(Number((INCIDENT.successRate + phase * 1.7).toFixed(1)), 78, 88);
  const testsPassingPercent = clamp(
    Number((INCIDENT.testsPassingPercent + phase * 2.3).toFixed(1)),
    62,
    75,
  );
  const responseMs = clamp(Math.round(INCIDENT.responseMs + phase * 140), 1850, 2450);
  const throughputPerMin = clamp(
    Number((INCIDENT.throughputPerMin - phase * 0.35).toFixed(1)),
    3.4,
    5.1,
  );
  const activePercent = clamp(Math.round(INCIDENT.activePercent + phase * 3), 58, 72);
  const percent = clamp(Math.round(INCIDENT.percent + phase * 3), 55, 70);
  const tasksActive = Math.max(INCIDENT.regressions + 1, queueDepth + 1);

  return {
    queueDepth,
    successRate,
    testsPassingPercent,
    responseMs,
    throughputPerMin,
    activePercent,
    percent,
    tasksActive,
    regressions: INCIDENT.regressions,
    mode: INCIDENT.mode,
    headline: INCIDENT.headline,
    status: INCIDENT.status,
    focus: INCIDENT.focus,
    errorCount: INCIDENT.regressions,
    lastUpdate: now,
  };
};

const buildTicker = (metrics) => [
  {
    id: 'integration-regressions',
    label: 'ინტეგრაციის ტესტები',
    value: `${metrics.regressions} ჩავარდა`,
    tone: metrics.regressions > 0 ? 'error' : 'ok',
  },
  {
    id: 'queue-depth',
    label: 'დავალებების რიგი',
    value: `${metrics.queueDepth} აქტიური`,
    tone: metrics.queueDepth > 2 ? 'warning' : 'ok',
  },
  {
    id: 'latency',
    label: 'საშუალო პასუხი',
    value: `${metrics.responseMs} ms`,
    tone: metrics.responseMs > 2000 ? 'warning' : 'ok',
  },
  {
    id: 'stability',
    label: 'სტაბილურობა',
    value: `${metrics.successRate.toFixed(1)}%`,
    tone: metrics.successRate < 85 ? 'warning' : 'ok',
  },
];

const getSnapshots = () => {
  const metrics = computeMetrics();

  return {
    guruloStatus: {
      activePercent: metrics.activePercent,
      queueDepth: metrics.queueDepth,
      responseMs: metrics.responseMs,
      successRate: metrics.successRate,
      testsPassingPercent: metrics.testsPassingPercent,
      errorCount: metrics.errorCount,
      lastUpdate: metrics.lastUpdate,
      throughputPerMin: metrics.throughputPerMin,
      mode: metrics.mode,
      ticker: buildTicker(metrics),
    },
    brainStatus: {
      status: metrics.status,
      percent: metrics.percent,
      tasksActive: metrics.tasksActive,
      lastUpdate: metrics.lastUpdate,
      mode: metrics.mode,
      headline: metrics.headline,
    },
  };
};

module.exports = {
  getSnapshots,
};
