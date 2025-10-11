process.env.NODE_ENV = 'production';
process.env.AI_INTERNAL_TOKEN = 'unit-test-token';

const autoImproveRouter = require('../routes/auto_improve');

const {
  determineSmartRouting,
  evaluateKpiOutcome,
  featureFlags,
  persistProposalUpdate,
  findProposalById,
  protectAutoImprove
} = autoImproveRouter.__testables;

describe('AutoImprove smart routing', () => {
  test('selects complex route for high severity proposals', () => {
    const metadata = determineSmartRouting({
      severity: 'P1',
      files: [{}, {}, {}, {}],
      risk: { level: 'high' }
    });
    expect(metadata.routeDecision).toBe('complex');
    expect(metadata.modelUsed).toContain('70b');
  });

  test('falls back to simple route for low complexity', () => {
    const metadata = determineSmartRouting({
      severity: 'P3',
      files: [{ path: 'one.js' }]
    });
    expect(metadata.routeDecision).toBe('simple');
    expect(metadata.modelUsed).toContain('8b');
  });
});

describe('AutoImprove KPI evaluation', () => {
  test('detects improvement when delta exceeds threshold', () => {
    const outcome = evaluateKpiOutcome({
      proposal: { kpiKey: 'test' },
      baseline: 100,
      observed: 115
    });
    expect(outcome.outcome).toBe('improved');
    expect(outcome.delta).toBeGreaterThan(0);
  });

  test('flags severe regression for rollback', () => {
    const outcome = evaluateKpiOutcome({
      proposal: { kpiKey: 'test' },
      baseline: 100,
      observed: 70
    });
    expect(outcome.outcome).toBe('regressed');
    expect(outcome.rollbackRecommended).toBe(true);
  });
});

describe('AutoImprove middleware authentication', () => {
  test('rejects missing internal token', () => {
    const req = { headers: {}, session: {}, method: 'POST', path: '/proposals' };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
      }
    };
    let nextCalled = false;

    protectAutoImprove(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('allows requests with valid internal token', () => {
    const req = {
      headers: { 'x-ai-internal-token': process.env.AI_INTERNAL_TOKEN },
      session: {},
      method: 'POST',
      path: '/proposals'
    };
    const res = {
      status() {
        throw new Error('Should not be called');
      }
    };
    let nextCalled = false;

    protectAutoImprove(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe('AutoImprove proposal lifecycle helpers', () => {
  test('can persist proposal status updates for mock proposals', () => {
    const original = findProposalById('proposal-1').proposal;
    expect(original).toBeDefined();
    const updated = persistProposalUpdate('proposal-1', (current) => ({
      ...current,
      status: 'approved'
    }));
    expect(updated?.status).toBe('approved');

    // revert to original state to avoid leaking state between tests
    persistProposalUpdate('proposal-1', () => ({ ...original }));
  });

  test('feature flags snapshot exposes smart routing flag', () => {
    expect(typeof featureFlags.smartRouting).toBe('boolean');
  });
});
