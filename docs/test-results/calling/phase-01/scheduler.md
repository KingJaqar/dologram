# Phase 1 scheduler procedure

The migration installs a bounded `public.call_worker_tick(integer)` service-only RPC. It
expires ringing/accepted calls, enforces the logical duration cap, creates reconciliation
work, and claims at most 100 jobs with a ten-second fenced lease. It does not make provider
HTTP requests; Phase 2's reconcile worker owns those effects.

## Disposable database verification

In the isolated Supabase stack, install the SQL-only probe as the database owner.
This probe claims jobs without processing provider effects. Use it on disposable
fixtures only and keep the deployed worker as the sole consumer on a live target.

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'calling-phase1-local-probe',
  '10 seconds',
  'set role service_role; select public.call_worker_tick(50);'
);

with samples as (
  select d.*,
         lag(d.start_time) over (order by d.start_time) as prior_start,
         lag(d.end_time) over (order by d.start_time) as prior_end
  from cron.job_run_details d
  join cron.job j using (jobid)
  where j.jobname = 'calling-phase1-local-probe' and d.end_time is not null
)
select count(*) as completed,
       count(*) filter (where status = 'succeeded') as succeeded,
       count(*) filter (where start_time < prior_end) as overlaps,
       max(end_time - start_time) as max_runtime,
       max(start_time - prior_start) as max_interval
from samples;

select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'calling-phase1-local-probe';
```

Create a synthetic eligible direct call, leave it unanswered, then check
`ended_at - created_at <= interval '45 seconds'` and zero reservations for that
call. The probe must run successfully at least 20 times, with zero overlaps.

## Hosted integration

Run these steps on the approved isolated integration target after Phase 2 supplies
the worker and its authentication contract.

1. Confirm `pg_cron`, `pg_net`, and Vault are enabled on the disposable target. Do not add or
   enable extensions on a shared or production project from this repository task.
2. Store the function URL and the dedicated scheduler credential in Vault. Do not put either
   secret in a migration, this report, a job row, or logs.
3. Install one named job at ten-second cadence, using `net.http_post` to the Phase 2
   `reconcile-calls` Edge Function. The function must authenticate with the dedicated
   scheduler credential and call `public.call_worker_tick(100)` through the service client.
4. Verify `cron.job` has one active job. Measure the cadence and overlap as above.
   Collect HTTP worker status, job-claim lag and end-to-end completion times from
   the authorized worker as well. A successful Cron submission alone cannot show
   that the asynchronous HTTP request or provider operation completed.
5. For rollback, disable new calling through the server flag and drain existing
   jobs with the controlled worker. Disable the scheduled invocation through
   `cron.alter_job(..., active := false)` once the drain is verified. Keep call
   history and unresolved job tombstones. Restore scheduling and calling only after
   checking the pending work and confirming the target's migration history.

Hosted Vault credentials, HTTP scheduling and provider timing remain later
integration checks. [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)
