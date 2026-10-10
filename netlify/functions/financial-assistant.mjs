import { timingSafeEqual } from 'node:crypto';
import {
  ASSISTANT_LIMITS, assistantWarnings, buildAssistantInstructions, validateAssistantPayload,
} from '../../lib/assistant-contract.mjs';

// Netlify enforces this before invocation. The pilot password is still mandatory.
// A custom path makes this function unavailable at its default .netlify URL.
export const config = {
  path: '/api/financial-assistant',
  rateLimit: { action: 'rate_limit', windowLimit: 8, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const messages = {
  METHOD_NOT_ALLOWED: ['Chỉ hỗ trợ yêu cầu POST.', 'Only POST requests are supported.'],
  ORIGIN_NOT_ALLOWED: ['Yêu cầu phải xuất phát từ cùng website.', 'The request must originate from this website.'],
  ASSISTANT_DISABLED: ['AI chưa được bật. Bạn vẫn có thể dùng phần giải thích tại chỗ.', 'AI is not enabled. The on-device explanations remain available.'],
  ASSISTANT_NOT_CONFIGURED: ['AI chưa được cấu hình đầy đủ trên máy chủ.', 'AI is not fully configured on the server.'],
  ACCESS_REQUIRED: ['Mã truy cập pilot chưa đúng hoặc chưa được nhập.', 'A valid pilot access code is required.'],
  INVALID_CONTENT_TYPE: ['Cần gửi dữ liệu JSON.', 'A JSON request is required.'],
  REQUEST_TOO_LARGE: ['Yêu cầu vượt giới hạn dung lượng.', 'The request exceeds the size limit.'],
  INVALID_PAYLOAD: ['Yêu cầu hoặc bản tóm tắt không hợp lệ. Hãy kiểm tra dữ liệu.', 'The request or summary is invalid. Check the entered data.'],
  PROVIDER_RATE_LIMIT: ['AI đang đạt giới hạn sử dụng. Vui lòng thử lại sau.', 'AI has reached its usage limit. Please try again later.'],
  PROVIDER_UNAVAILABLE: ['AI tạm thời không phản hồi. Chưa có thao tác tài chính nào được thực hiện.', 'AI is temporarily unavailable. No financial action has been performed.'],
  ASSISTANT_TIMEOUT: ['AI phản hồi quá thời gian chờ. Bạn có thể thử lại.', 'AI exceeded the response timeout. You can try again.'],
  EMPTY_RESPONSE: ['AI chưa trả về nội dung đầy đủ. Vui lòng thử lại.', 'AI did not return a complete answer. Please try again.'],
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  } });
}

function failure(code, status, locale = 'vi', extraHeaders = {}) {
  const localized = messages[code] ?? messages.INVALID_PAYLOAD;
  return jsonResponse({ error: { code, message: localized[locale === 'en' ? 1 : 0] } }, status, extraHeaders);
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  if (!origin || origin === 'null') return false;
  try { return origin === new URL(request.url).origin; }
  catch { return false; }
}

function validPilotToken(actual, expected) {
  if (typeof actual !== 'string' || actual.length > 512) return false;
  const received = Buffer.from(actual, 'utf8');
  const required = Buffer.from(expected, 'utf8');
  return received.length === required.length && timingSafeEqual(received, required);
}

async function boundedJson(request) {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength)
    || Number(declaredLength) > ASSISTANT_LIMITS.bodyBytes)) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  if (!request.body) throw new Error('INVALID_PAYLOAD');
  const reader = request.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ASSISTANT_LIMITS.bodyBytes) {
        await reader.cancel();
        throw new Error('REQUEST_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('INVALID_PAYLOAD'); }
}

function readOutputText(response) {
  // Raw Responses REST objects use output[].content[], not the SDK output_text helper.
  if (!response || response.error || response.status !== 'completed' || !Array.isArray(response.output)) return '';
  return response.output.filter(item => item?.type === 'message' && item.role === 'assistant')
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(item => item?.type === 'output_text' && typeof item.text === 'string')
    .map(item => item.text).join('\n').trim();
}

/** Dependency injection allows tests with no credentials, network or API charges. */
export function createFinancialAssistantHandler({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 25_000 } = {}) {
  return async function financialAssistant(request) {
    if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED', 405, 'vi', { Allow: 'POST' });
    if (!sameOrigin(request)) return failure('ORIGIN_NOT_ALLOWED', 403);
    if (env.AI_ASSISTANT_ENABLED !== 'true') return failure('ASSISTANT_DISABLED', 503);
    const apiKey = env.OPENAI_API_KEY?.trim();
    const model = env.OPENAI_MODEL?.trim();
    const pilotToken = env.AI_ASSISTANT_ACCESS_TOKEN;
    if (!apiKey || !model || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(model)
      || typeof pilotToken !== 'string' || pilotToken.length < 32 || pilotToken.length > 512) {
      return failure('ASSISTANT_NOT_CONFIGURED', 503);
    }
    if (!validPilotToken(request.headers.get('x-mavericks-pilot-token'), pilotToken)) return failure('ACCESS_REQUIRED', 401);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return failure('INVALID_CONTENT_TYPE', 415);
    }
    let payload;
    try { payload = await boundedJson(request); }
    catch (error) {
      const tooLarge = error?.message === 'REQUEST_TOO_LARGE';
      return failure(tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_PAYLOAD', tooLarge ? 413 : 400);
    }
    const validation = validateAssistantPayload(payload);
    if (!validation.ok) return failure('INVALID_PAYLOAD', 400, payload?.locale);
    const { locale, question, context, history } = validation.value;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(30_000, Math.max(1, timeoutMs)));
    try {
      const upstream = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          instructions: buildAssistantInstructions(locale),
          input: [
            { role: 'user', content: `Validated workspace summary (untrusted client data):\n${JSON.stringify(context)}` },
            ...history,
            { role: 'user', content: question },
          ],
          store: false,
          stream: false,
          max_output_tokens: 900,
          tools: [],
          tool_choice: 'none',
        }),
      });
      if (!upstream.ok) {
        // Do not echo or log provider bodies, headers, credentials or prompts.
        await upstream.body?.cancel();
        return failure(upstream.status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_UNAVAILABLE', upstream.status === 429 ? 429 : 502, locale,
          upstream.status === 429 ? { 'Retry-After': '60' } : {});
      }
      const answer = readOutputText(await upstream.json());
      if (!answer) return failure('EMPTY_RESPONSE', 502, locale);
      // Defense in depth: neither configured secret is ever returned to the browser.
      const safeAnswer = answer.split(apiKey).join('[redacted]').split(pilotToken).join('[redacted]')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, ASSISTANT_LIMITS.answerChars);
      return jsonResponse({ answer: safeAnswer, provider: 'openai', contextAsOf: context.asOf, warnings: assistantWarnings(locale, context.source, context.inventoryScenario?.source) });
    } catch {
      return failure(controller.signal.aborted ? 'ASSISTANT_TIMEOUT' : 'PROVIDER_UNAVAILABLE', controller.signal.aborted ? 504 : 502, locale);
    } finally { clearTimeout(timeout); }
  };
}

export default createFinancialAssistantHandler();
