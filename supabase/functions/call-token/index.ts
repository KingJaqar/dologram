import {
  authenticate,
  parseAdmission,
  parseAdmissionFinalization,
  parseTokenInput,
  rpc,
} from '../_shared/calling.ts';
import { ensureReadyAdmission } from '../_shared/admission.ts';
import { CallHttpError, errorResponse, jsonResponse, methodResponse, providerError, readJsonBody, safeDiagnostic } from '../_shared/http.ts';
import { liveKitConfig, provisionRoom, roomService, signAdmissionToken } from '../_shared/livekit.ts';

Deno.serve(async (request) => {
  const methodError = methodResponse(request);
  if (methodError) return methodError;
  try {
    const auth = await authenticate(request);
    const input = parseTokenInput(await readJsonBody(request));
    const config = liveKitConfig();
    const service = roomService(config);
    let admission = parseAdmission(await rpc(auth.admin, 'call_prepare_admission', {
      p_actor_id: auth.actorId,
      p_call_id: input.callId,
      p_client_session_id: input.clientSessionId,
    }));

    admission = await ensureReadyAdmission(
      admission,
      (roomName) => provisionRoom(service, roomName),
      (provisioning) => rpc(auth.admin, 'call_finalize_provisioning', {
        p_call_id: provisioning.callId,
        p_operation_id: provisioning.operationId,
        p_epoch: provisioning.epoch,
        p_room_sid: provisioning.roomSid,
      }),
      () => rpc(auth.admin, 'call_prepare_admission', {
        p_actor_id: auth.actorId,
        p_call_id: input.callId,
        p_client_session_id: input.clientSessionId,
      }).then(parseAdmission),
      input.callId,
    );

    if (admission.readiness !== 'ready' || admission.admission_id === null || admission.room_sid === null) {
      throw providerError();
    }
    const signed = await signAdmissionToken(config, admission.room_name, admission.participant_identity, admission.media_type);
    const finalization = parseAdmissionFinalization(await rpc(auth.admin, 'call_finalize_admission', {
      p_actor_id: auth.actorId,
      p_call_id: input.callId,
      p_client_session_id: input.clientSessionId,
      p_admission_id: admission.admission_id,
      p_epoch: admission.epoch,
      p_token_nbf: signed.nbf.toString(),
      p_token_exp: signed.exp.toString(),
    }));
    if (!finalization.authorized || finalization.revision === null) {
      throw new CallHttpError(409, 'CALL_ALREADY_HANDLED', false);
    }
    return jsonResponse({
      serverUrl: config.clientUrl,
      participantToken: signed.token,
      expiresAt: new Date(Number(signed.exp) * 1000).toISOString(),
      callId: input.callId,
      revision: finalization.revision,
      serverTime: finalization.server_time,
    });
  } catch (error) {
    if (!(error instanceof CallHttpError)) {
      safeDiagnostic('token_request_failed', { callId: null, reason: 'provider_or_database_error' });
    }
    return errorResponse(error);
  }
});
