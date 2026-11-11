import { createAdminClient, parseWorkerJobs, rpc, type WorkerJob } from '../_shared/calling.ts';
import { CallHttpError, errorResponse, jsonResponse, methodResponse, safeDiagnostic } from '../_shared/http.ts';
import { cleanupRoom, liveKitConfig, observeRoom, roomService } from '../_shared/livekit.ts';

function authorized(request: Request): boolean {
  const configured = Deno.env.get('CALL_SCHEDULER_SECRET');
  const supplied = request.headers.get('x-call-scheduler-secret');
  return Boolean(configured && supplied && configured.length === supplied.length
    && [...configured].every((character, index) => character === supplied[index]));
}

function observationArgs(job: WorkerJob, observation: Awaited<ReturnType<typeof observeRoom>>): Record<string, unknown> {
  return {
    p_call_id: job.call_id,
    p_job_lease_id: job.lease_id,
    p_epoch: job.termination_epoch,
    p_room_generation: job.room_generation,
    p_observation: observation,
  };
}

async function processReconcileJob(admin: ReturnType<typeof createAdminClient>, service: ReturnType<typeof roomService>, job: WorkerJob): Promise<string> {
  if (!job.call_id || !job.room_sid) return 'ignored';
  const observation = await observeRoom(service, job.room_name, job.room_sid);
  await rpc(admin, 'call_reconcile', observationArgs(job, observation));
  return observation.result;
}

async function processCleanupJob(admin: ReturnType<typeof createAdminClient>, service: ReturnType<typeof roomService>, job: WorkerJob): Promise<string> {
  const result = await cleanupRoom(
    service,
    job.room_name,
    job.caller_identity,
    job.callee_identity,
    job.max_finalized_nbf,
    job.outstanding_operation_until,
  );
  await rpc(admin, 'call_complete_cleanup', {
    p_job_lease_id: job.lease_id,
    p_outcome: result.outcome,
    p_error_code: result.errorCode ?? null,
  });
  return result.outcome;
}

Deno.serve(async (request) => {
  const methodError = methodResponse(request);
  if (methodError) return methodError;
  if (!authorized(request)) return errorResponse(new CallHttpError(401, 'CALL_UNAUTHENTICATED', false));
  try {
    const config = liveKitConfig();
    const admin = createAdminClient();
    const service = roomService(config);
    const jobs = parseWorkerJobs(await rpc(admin, 'call_worker_tick', { p_limit: 50 }));
    const results: Array<{ jobId: string; kind: string; result: string }> = [];
    for (const job of jobs) {
      try {
        const result = job.kind === 'reconcile'
          ? await processReconcileJob(admin, service, job)
          : await processCleanupJob(admin, service, job);
        results.push({ jobId: job.job_id, kind: job.kind, result });
      } catch (error) {
        safeDiagnostic('worker_job_failed', { callId: job.call_id, reason: job.kind });
        if (job.kind === 'cleanup') {
          await rpc(admin, 'call_complete_cleanup', {
            p_job_lease_id: job.lease_id,
            p_outcome: 'retryable',
            p_error_code: 'provider_error',
          });
        }
        results.push({ jobId: job.job_id, kind: job.kind, result: 'retryable' });
      }
    }
    return jsonResponse({ processed: results.length, results });
  } catch (error) {
    safeDiagnostic('worker_tick_failed', { callId: null, reason: 'provider_or_database_error' });
    return errorResponse(error);
  }
});
