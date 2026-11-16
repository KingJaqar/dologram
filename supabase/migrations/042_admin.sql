-- M4-08 audit trail (6.2, 6.6, D-106).
-- Written only by packages/admin-core over SUPABASE_DB_URL. The private schema is
-- never exposed through the Data API; RLS is enabled with no policy.
set lock_timeout = '5s';
set statement_timeout = '15s';

create table private.admin_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_user_id uuid,
  action text not null,
  target_user_id uuid,
  result text not null check (result in ('success', 'failed')),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object')
);

comment on table private.admin_audit is
  'Admin action audit trail (ADM-07). Server-only writes over the database connection.';
comment on column private.admin_audit.event_id is
  'Idempotency identity of one audit event; retried writes reconcile without duplicates.';
comment on column private.admin_audit.actor_user_id is
  'Verified authenticated account UUID. Null only before authentication succeeds.';
comment on column private.admin_audit.target_user_id is
  'Affected account UUID, retained after the target profile or account is deleted.';

alter table private.admin_audit enable row level security;
revoke all on private.admin_audit from public, anon, authenticated;
revoke all on sequence private.admin_audit_id_seq from public, anon, authenticated;

create unique index admin_audit_event_idx on private.admin_audit (event_id);
create index admin_audit_at_idx on private.admin_audit (at desc, id desc);
create index admin_audit_target_idx on private.admin_audit (target_user_id);

-- Refresh the Data API schema cache after the transaction commits.
notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
