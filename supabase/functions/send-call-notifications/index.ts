import { createAdminClient } from '../_shared/calling.ts';
import { CallHttpError, errorResponse, jsonResponse, methodResponse, readJsonBody } from '../_shared/http.ts';
import { dispatchPendingCallNotifications } from '../_shared/callNotifications.ts';

function authorized(request: Request): boolean {
  const configured = Deno.env.get('CALL_PUSH_WEBHOOK_SECRET') ?? Deno.env.get('PUSH_WEBHOOK_SECRET');
  const supplied = request.headers.get('authorization');
  if (!configured || !supplied || !supplied.startsWith('Bearer ')) return false;
  const token = supplied.slice('Bearer '.length);
  return token.length === configured.length && [...configured].every((character, index) => character === token[index]);
}

function callIdFromBody(body: Record<string, unknown>): string | undefined {
  if (typeof body.call_id === 'string') return body.call_id;
  const record = body.record;
  if (typeof record === 'object' && record !== null && 'call_id' in record && typeof record.call_id === 'string') {
    return record.call_id;
  }
  return undefined;
}

Deno.serve(async (request) => {
  const methodError = methodResponse(request);
  if (methodError) return methodError;
  if (!authorized(request)) return errorResponse(new CallHttpError(401, 'CALL_UNAUTHENTICATED', false));
  try {
    const body = await readJsonBody(request);
    if (body.type !== undefined && body.type !== 'INSERT' && body.type !== 'UPDATE') {
      return jsonResponse({ sent: 0, ignored: true });
    }
    if (body.table !== undefined && body.table !== 'calls') {
      return jsonResponse({ sent: 0, ignored: true });
    }
    if (body.schema !== undefined && body.schema !== 'public') {
      return jsonResponse({ sent: 0, ignored: true });
    }
    return jsonResponse(await dispatchPendingCallNotifications(createAdminClient(), callIdFromBody(body)));
  } catch (error) {
    return errorResponse(error);
  }
});
