'use strict';

jest.mock('../core/intelligent_answering_engine', () => ({
  processMessage: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../middleware/response_sanitizer', () => ({
  sanitizeGuruloReply: jest.fn((text) => text)
}));

const aiChatRouter = require('../routes/ai_chat');

const handleChatRequest = aiChatRouter.handleChatRequest;

function createRequest(body = {}) {
  return {
    chatRequest: body,
    body,
    headers: {},
    chatRequestValidated: true
  };
}

function invokeHandler(body) {
  return new Promise((resolve, reject) => {
    const req = createRequest(body);
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
        return this;
      }
    };

    Promise.resolve(handleChatRequest(req, res)).catch(reject);
  });
}

describe('Gurulo conversational flow (without server)', () => {
  test('"გამარჯობა" yields structured greeting with CTAs and telemetry', async () => {
    const { statusCode, payload } = await invokeHandler({ message: 'გამარჯობა' });

    expect(statusCode).toBe(200);
    expect(payload.success).toBe(true);

    const sections = payload.response?.[0]?.sections || [];
    expect(sections).toHaveLength(2);
    expect(sections[0].cta).toContain('ნახე ხელმისაწვდომობა');
    expect(sections[0].cta).toContain('/cottages');
    expect(sections[1].cta).toContain('გეგმა 3 ნაბიჯში');
    expect(sections[1].cta).toContain('/cottages#plan');

    expect(payload.metadata.intent).toBe('greeting');
    expect(payload.metadata.telemetry.intent_detected).toBe('greeting');
    expect(payload.metadata.telemetry.recommendations_shown).toBe(false);
    expect(Array.isArray(payload.metadata.quickPicks)).toBe(true);
    expect(payload.metadata.quickPicks).toHaveLength(2);
  });

  test('Availability intent without params asks follow-up and suggests quick picks', async () => {
    const { statusCode, payload } = await invokeHandler({ message: 'ბახმაროში არის თავისუფალი კოტეჯები?' });

    expect(statusCode).toBe(200);
    const telemetry = payload.metadata.telemetry;
    expect(payload.metadata.intent).toBe('check_availability');
    expect(telemetry.intent_detected).toBe('check_availability');
    expect(telemetry.param_missing).toEqual(expect.arrayContaining(['from', 'to', 'guests']));

    const sections = payload.response?.[0]?.sections || [];
    expect(sections[0].title).toContain('დამჭირდება');
    expect(sections[0].cta).toContain('/cottages');
    expect(Array.isArray(payload.metadata.quickPicks)).toBe(true);
    expect(payload.metadata.quickPicks.length).toBeGreaterThan(0);
  });

  test('Availability intent with full params returns cottage cards and CTA links', async () => {
    const { statusCode, payload } = await invokeHandler({
      message: 'შემომითვალიერე თავისუფალი კოტეჯები 2025-07-01 დან 2025-07-04-მდე 3 სტუმარზე.',
      metadata: { language: 'ka' }
    });

    expect(statusCode).toBe(200);
    const telemetry = payload.metadata.telemetry;
    expect(payload.metadata.intent).toBe('check_availability');
    expect(telemetry.intent_detected).toBe('check_availability');
    expect(telemetry.param_missing).toHaveLength(0);

    const sections = payload.response?.[0]?.sections || [];
    expect(sections[0].title).toContain('კოტეჯ');
    expect(sections[0].bullets.length).toBeGreaterThan(0);
    expect(sections[0].cta).toContain('/cottages?from=2025-07-01&to=2025-07-04&guests=3');
    expect(sections[1].cta).toContain('/cottages#pricing');
  });
});
