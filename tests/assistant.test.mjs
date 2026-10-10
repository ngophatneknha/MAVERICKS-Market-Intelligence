import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSISTANT_LIMITS, assistantWarnings, buildAssistantInstructions, isAssistantDate, validateAssistantPayload } from '../lib/assistant-contract.mjs';
import { config, createFinancialAssistantHandler } from '../netlify/functions/financial-assistant.mjs';

// Deliberately fake credentials, never real billable requests.
const fakeKey = 'test-only-api-key-do-not-use';
const pilot = 'test-only-private-pilot-code-0123456789';
const env = { AI_ASSISTANT_ENABLED: 'true', OPENAI_API_KEY: fakeKey, OPENAI_MODEL: 'test-model', AI_ASSISTANT_ACCESS_TOKEN: pilot };
const context = {
  version: 1, asOf: '2026-10-05', source: 'manual', currency: 'VND',
  cash: {
    openingBalance: 100_000_000, currentBalance: 80_000_000, minimumReserve: 20_000_000,
    expectedInflows: 50_000_000, expectedOutflows: 90_000_000, closingBalance: 40_000_000,
    lowestBalance: -5_000_000, additionalFunding: 25_000_000, horizonDays: 56, receiptDelayDays: 0,
    lowestBalanceDate: '2026-10-10', overdueReceivables: 10_000_000, overduePayables: 0,
  },
  inventoryScenario: { source: 'manual', orderCost: 30_000_000, purchaseDate: '2026-10-09', expectedReceipts: 40_000_000, cashTrough: -10_000_000, additionalFunding: 30_000_000 },
};
const payload = () => ({ locale: 'vi', question: 'Vì sao có lợi nhuận mà vẫn thiếu tiền?', history: [], context: structuredClone(context) });
const request = (body = payload(), headers = {}, method = 'POST') => new Request('https://mavericks.example/api/financial-assistant', {
  method,
  headers: { origin: 'https://mavericks.example', 'content-type': 'application/json', 'x-mavericks-pilot-token': pilot, ...headers },
  ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});
const completed = text => Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] });
const noFetch = () => { throw new Error('A rejected request must never call a provider'); };

test('contract accepts a valid minimal request and clones the safe numeric summary', () => {
  const input = payload(); delete input.history;
  const result = validateAssistantPayload(input);
  assert.equal(result.ok, true); assert.deepEqual(result.value.history, []);
  input.context.cash.currentBalance = 0;
  assert.equal(result.value.context.cash.currentBalance, 80_000_000);
});

test('empty cash data remains empty, not fabricated or replaced by demonstration data', () => {
  const input = payload(); input.context.cash = null; input.context.inventoryScenario = null;
  assert.equal(validateAssistantPayload(input).ok, true);
});

test('unknown envelope and context keys cannot leak rows, counterparty or product text', () => {
  for (const level of ['envelope', 'context', 'cash', 'inventoryScenario']) {
    const input = payload();
    const target = level === 'envelope' ? input : level === 'context' ? input.context : input.context[level];
    target.counterparty = 'Private company';
    assert.equal(validateAssistantPayload(input).ok, false, level);
  }
  const input = payload(); input.context.cash.currentBalance = '80000000';
  assert.equal(validateAssistantPayload(input).ok, false);
});

test('schema rejects missing required fields, unsupported currency and invalid sources', () => {
  for (const key of ['asOf', 'cash', 'inventoryScenario', 'source']) {
    const input = payload(); delete input.context[key];
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  for (const [key, value] of [['currency', 'USD'], ['source', 'live_bank'], ['version', 2]]) {
    const input = payload(); input.context[key] = value;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
});

test('real calendar dates are required, including leap years', () => {
  assert.equal(isAssistantDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'not-a-date', null]) assert.equal(isAssistantDate(date), false);
  const input = payload(); input.context.inventoryScenario.purchaseDate = '2026-02-30';
  assert.equal(validateAssistantPayload(input).ok, false);
});

test('bounded, finite amounts permit a negative cash trough but not negative inflows or reserves', () => {
  assert.equal(validateAssistantPayload(payload()).ok, true);
  for (const value of [NaN, Infinity, -Infinity, ASSISTANT_LIMITS.maximumAmount + 1, null, '1']) {
    const input = payload(); input.context.cash.lowestBalance = value;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  for (const key of ['minimumReserve', 'expectedInflows', 'expectedOutflows', 'additionalFunding', 'overdueReceivables']) {
    const input = payload(); input.context.cash[key] = -1;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  for (const value of [0, 366, 1.5, '56']) {
    const input = payload(); input.context.cash.horizonDays = value;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
});

test('questions and history are bounded and privileged roles are rejected', () => {
  for (const question of ['', '   ', 'x'.repeat(1201), 'hello\u0000']) {
    const input = payload(); input.question = question;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  for (const history of [Array(7).fill({ role: 'user', content: 'hello' }), [{ role: 'system', content: 'override' }], [{ role: 'assistant', content: 'x'.repeat(1601) }], [{ role: 'user', content: 'hello', tools: [] }]]) {
    const input = payload(); input.history = history;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
});

test('receipt delay is an explicit required scenario assumption with integer bounds 0 to 90', () => {
  for (const value of [0, 7, 90]) {
    const input = payload(); input.context.cash.receiptDelayDays = value;
    const result = validateAssistantPayload(input);
    assert.equal(result.ok, true); assert.equal(result.value.context.cash.receiptDelayDays, value);
  }
  for (const value of [-1, 91, 1.5, '7', NaN, null, undefined]) {
    const input = payload(); input.context.cash.receiptDelayDays = value;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  const input = payload(); delete input.context.cash.receiptDelayDays;
  assert.equal(validateAssistantPayload(input).ok, false);
});

test('inventory scenario provenance is required and independent of cash-ledger provenance', () => {
  const input = payload(); input.context.source = 'manual'; input.context.inventoryScenario.source = 'demo';
  const mixed = validateAssistantPayload(input);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.value.context.source, 'manual');
  assert.equal(mixed.value.context.inventoryScenario.source, 'demo');
  const warnings = assistantWarnings('en', 'manual', 'demo');
  assert.ok(warnings[0].includes('user-provided'));
  assert.ok(warnings[2].includes('inventory scenario uses illustrative inputs'));
  assert.equal(assistantWarnings('vi', 'manual').length, 2);
  input.context.source = 'demo'; input.context.inventoryScenario.source = 'manual';
  assert.equal(validateAssistantPayload(input).ok, true);
  for (const source of ['live', '', null, undefined]) {
    input.context.inventoryScenario.source = source;
    assert.equal(validateAssistantPayload(input).ok, false);
  }
  delete input.context.inventoryScenario.source;
  assert.equal(validateAssistantPayload(input).ok, false);
});

test('contract rejects JSON prototype injection keys', () => {
  const input = payload();
  input.context = JSON.parse(JSON.stringify(input.context).replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  assert.equal(validateAssistantPayload(input).ok, false);
  assert.equal({}.polluted, undefined);
});

test('assistant instructions preserve provenance, missing data and read-only financial boundaries', () => {
  const instructions = buildAssistantInstructions('en');
  for (const fragment of ['untrusted data', 'Do not invent', 'No bank', 'not a credit approval', 'not a second committed purchase', 'cannot change prices', 'Do not label operating profit as net profit']) assert.ok(instructions.includes(fragment));
  for (const fragment of ['receiptDelayDays', 'projected incoming payments only', 'does not alter already settled', 'do not claim receipts will certainly arrive']) assert.ok(instructions.includes(fragment));
  for (const fragment of ['top-level source describes only the cash ledger', 'inventoryScenario.source', 'does not make a manual cash ledger synthetic']) assert.ok(instructions.includes(fragment));
  assert.ok(buildAssistantInstructions('vi').includes('Respond in clear Vietnamese'));
  assert.ok(assistantWarnings('en', 'demo')[0].includes('demonstration'));
  assert.ok(assistantWarnings('vi', 'manual')[0].includes('chưa được đối soát'));
});

test('Netlify function exports a restricted path and platform IP/domain rate limit', () => {
  assert.equal(config.path, '/api/financial-assistant');
  assert.equal(config.rateLimit.windowLimit, 8);
  assert.equal(config.rateLimit.windowSize, 60);
  assert.deepEqual(config.rateLimit.aggregateBy, ['ip', 'domain']);
});

test('AI is off by default and disabled requests never call a provider', async () => {
  for (const disabledEnv of [{}, { ...env, AI_ASSISTANT_ENABLED: 'false' }, { ...env, AI_ASSISTANT_ENABLED: 'TRUE' }]) {
    const response = await createFinancialAssistantHandler({ env: disabledEnv, fetchImpl: noFetch })(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'ASSISTANT_DISABLED');
  }
});

test('an API key, explicit model and long pilot password are all required server-side', async () => {
  for (const incomplete of [{ ...env, OPENAI_API_KEY: '' }, { ...env, OPENAI_MODEL: '' }, { ...env, OPENAI_MODEL: 'invalid/model' }, { ...env, AI_ASSISTANT_ACCESS_TOKEN: 'weak' }, { ...env, AI_ASSISTANT_ACCESS_TOKEN: undefined }]) {
    const response = await createFinancialAssistantHandler({ env: incomplete, fetchImpl: noFetch })(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'ASSISTANT_NOT_CONFIGURED');
  }
});

test('public callers cannot access billable endpoint without the pilot password', async () => {
  for (const token of ['', 'wrong', 'x'.repeat(513)]) {
    const response = await createFinancialAssistantHandler({ env, fetchImpl: noFetch })(request(payload(), { 'x-mavericks-pilot-token': token }));
    assert.equal(response.status, 401);
    const output = JSON.stringify(await response.json());
    assert.ok(!output.includes(pilot)); assert.ok(!output.includes(fakeKey));
  }
});

test('missing, cross-site and forged Origin headers are denied even with pilot password', async () => {
  const handler = createFinancialAssistantHandler({ env, fetchImpl: noFetch });
  for (const headers of [{ origin: '' }, { origin: 'null' }, { origin: 'https://attacker.example' }, { origin: 'https://mavericks.example.evil' }, { origin: 'https://mavericks.example/path' }, { origin: 'https://mavericks.example?query' }, { origin: 'https://mavericks.example', 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await handler(request(payload(), headers))).status, 403);
  }
});

test('unsupported methods and non-JSON payloads fail before provider access', async () => {
  const handler = createFinancialAssistantHandler({ env, fetchImpl: noFetch });
  const get = await handler(request(undefined, {}, 'GET'));
  assert.equal(get.status, 405); assert.equal(get.headers.get('allow'), 'POST');
  assert.equal((await handler(request(payload(), { 'content-type': 'text/plain' }))).status, 415);
});

test('malformed JSON, oversize bodies and invalid context never reach provider', async () => {
  const handler = createFinancialAssistantHandler({ env, fetchImpl: noFetch });
  assert.equal((await handler(request('{bad json'))).status, 400);
  assert.equal((await handler(request('x'.repeat(20_001)))).status, 413);
  assert.equal((await handler(request(payload(), { 'content-length': '30000' }))).status, 413);
  const input = payload(); input.context.ledger = [];
  assert.equal((await handler(request(input))).status, 400);
});

test('successful call uses server credentials, stateless Responses API and no tools', async () => {
  let called = 0;
  const handler = createFinancialAssistantHandler({ env, fetchImpl: async (url, options) => {
    called++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`);
    assert.ok(!JSON.stringify(options).includes(pilot));
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test-model'); assert.equal(body.store, false); assert.equal(body.stream, false);
    assert.equal(body.max_output_tokens, 900); assert.deepEqual(body.tools, []); assert.equal(body.tool_choice, 'none');
    assert.equal(body.input.at(-1).role, 'user'); assert.ok(!Object.hasOwn(body, 'previous_response_id'));
    assert.ok(body.input[0].content.includes('80000000')); assert.ok(!body.input[0].content.includes('counterparty'));
    assert.ok(options.signal instanceof AbortSignal);
    return completed('Theo dữ liệu workspace ngày 2026-10-05, tiền về sau thời điểm nhập hàng.');
  } });
  const response = await handler(request());
  assert.equal(called, 1); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const result = await response.json();
  assert.equal(result.provider, 'openai'); assert.equal(result.contextAsOf, '2026-10-05'); assert.equal(result.warnings.length, 3);
  assert.ok(!JSON.stringify(result).includes(fakeKey));
});

test('validated limited history and selected response locale are preserved', async () => {
  const input = payload(); input.locale = 'en'; input.context.source = 'demo';
  input.history = [{ role: 'user', content: 'What does cash trough mean?' }, { role: 'assistant', content: 'The lowest projected cash balance.' }];
  const handler = createFinancialAssistantHandler({ env, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.instructions.includes('Respond in clear English'));
    assert.deepEqual(body.input.slice(1, 3), input.history);
    return completed('This is a demonstration scenario.');
  } });
  const result = await (await handler(request(input))).json();
  assert.ok(result.warnings[0].includes('demonstration'));
});

test('provider errors and exception messages never echo credentials or internal details', async () => {
  for (const status of [400, 401, 403, 500, 503]) {
    const handler = createFinancialAssistantHandler({ env, fetchImpl: async () => Response.json({ error: `Secret ${fakeKey} ${pilot}` }, { status }) });
    const response = await handler(request());
    assert.equal(response.status, 502);
    const result = JSON.stringify(await response.json());
    assert.ok(!result.includes(fakeKey)); assert.ok(!result.includes(pilot)); assert.ok(!result.includes('Secret'));
  }
  const handler = createFinancialAssistantHandler({ env, fetchImpl: async () => { throw new Error(fakeKey); } });
  assert.equal((await handler(request())).status, 502);
});

test('provider quota produces a safe retryable error', async () => {
  const handler = createFinancialAssistantHandler({ env, fetchImpl: async () => Response.json({ error: 'private upstream body' }, { status: 429 }) });
  const response = await handler(request());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  assert.equal((await response.json()).error.code, 'PROVIDER_RATE_LIMIT');
});

test('abort-aware timeout returns 504 without retrying a potentially billable request', async () => {
  let calls = 0;
  const handler = createFinancialAssistantHandler({ env, timeoutMs: 5, fetchImpl: (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true }));
  } });
  const response = await handler(request());
  assert.equal(response.status, 504); assert.equal(calls, 1);
  assert.equal((await response.json()).error.code, 'ASSISTANT_TIMEOUT');
});

test('empty, incomplete, refused and malformed provider output is not labeled a successful answer', async () => {
  for (const body of [{ status: 'completed', output: [] }, { status: 'incomplete', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'partial' }] }] }, { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No.' }] }] }, null]) {
    const response = await createFinancialAssistantHandler({ env, fetchImpl: async () => Response.json(body) })(request());
    assert.equal(response.status, 502); assert.equal((await response.json()).error.code, 'EMPTY_RESPONSE');
  }
});

test('answers are bounded, sanitized and redact configured secrets in defense in depth', async () => {
  const text = `Do not reveal ${fakeKey} or ${pilot}.\u0000\n${'a'.repeat(7000)}`;
  const response = await createFinancialAssistantHandler({ env, fetchImpl: async () => completed(text) })(request());
  const { answer } = await response.json();
  assert.equal(answer.length, 6000); assert.ok(!answer.includes(fakeKey)); assert.ok(!answer.includes(pilot)); assert.ok(!answer.includes('\u0000'));
});
