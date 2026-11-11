import {
  authenticate,
  busyOrSnapshot,
  parseActionInput,
  parseSnapshot,
  rpc,
} from '../_shared/calling.ts';
import { CallHttpError, errorResponse, jsonResponse, methodResponse, readJsonBody, safeDiagnostic } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const methodError = methodResponse(request);
  if (methodError) return methodError;
  try {
    const auth = await authenticate(request);
    const input = parseActionInput(await readJsonBody(request));
    let rawSnapshot: unknown;
    if (input.action === 'create') {
      rawSnapshot = await rpc(auth.admin, 'call_create', {
        p_actor_id: auth.actorId,
        p_chat_id: input.chatId,
        p_media_type: input.mediaType,
        p_request_id: input.requestId,
        p_client_session_id: input.clientSessionId,
      });
    } else if (input.action === 'snapshot') {
      rawSnapshot = await rpc(auth.admin, 'call_snapshot', {
        p_actor_id: auth.actorId,
        p_client_session_id: input.clientSessionId,
        p_call_id: input.callId ?? null,
      });
    } else {
      rawSnapshot = await rpc(auth.admin, 'call_transition', {
        p_actor_id: auth.actorId,
        p_call_id: input.callId,
        p_action: input.action,
        p_request_id: input.requestId,
        p_client_session_id: input.clientSessionId,
      });
    }
    const snapshot = parseSnapshot(rawSnapshot);
    return input.action === 'create' ? busyOrSnapshot(snapshot) : jsonResponse(snapshot);
  } catch (error) {
    if (!(error instanceof CallHttpError)) {
      safeDiagnostic('action_request_failed', { callId: null, reason: 'provider_or_database_error' });
    }
    return errorResponse(error);
  }
});
