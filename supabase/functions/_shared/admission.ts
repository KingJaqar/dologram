import type { AdmissionPreparation } from './calling.ts';
import { providerError } from './http.ts';

export type AdmissionProvisioner = (roomName: string) => Promise<{ sid: string }>;
export type AdmissionFinalizer = (input: {
  callId: string;
  operationId: string;
  epoch: string;
  roomSid: string;
}) => Promise<unknown>;
export type AdmissionPreparer = () => Promise<AdmissionPreparation>;

export async function ensureReadyAdmission(
  initial: AdmissionPreparation,
  provision: AdmissionProvisioner,
  finalize: AdmissionFinalizer,
  prepare: AdmissionPreparer,
  callId: string,
): Promise<AdmissionPreparation> {
  if (initial.readiness === 'ready') return initial;
  if (initial.operation_id === null) throw providerError();

  const room = await provision(initial.room_name);
  await finalize({
    callId,
    operationId: initial.operation_id,
    epoch: initial.epoch,
    roomSid: room.sid,
  });

  // The finalizer is fenced and idempotent. Re-read after every outcome so a
  // concurrent request that won the fence shares the ready admission.
  return prepare();
}
