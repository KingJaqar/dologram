-- Schema identifiers and booleans only; no account rows or credentials.
select private.admin_creation_contract_version() as creation_contract_version;
select 'unguarded_rpc' as diagnostic, p.oid::regprocedure::text as identity
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
  and has_function_privilege('authenticated', p.oid, 'execute')
  and not exists(select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
  and position('private.require_account_access()' in p.prosrc)=0
  and position('private.account_access_allowed(auth.uid())' in p.prosrc)=0;
select 'policy_gap' as diagnostic, n.nspname || '.' || c.relname as identity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p')
  and (n.nspname='public' or n.nspname='storage' and c.relname='objects' or n.nspname='realtime' and c.relname='messages')
  and not exists(select 1 from pg_depend d where d.objid=c.oid and d.classid='pg_class'::regclass and d.deptype='e')
  and (not c.relrowsecurity or not exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='account_access_gate'
    and not p.polpermissive and p.polcmd='*' and 'authenticated'::regrole::oid=any(p.polroles)
    and position('account_access_allowed' in pg_get_expr(p.polqual,p.polrelid))>0
    and position('account_access_allowed' in pg_get_expr(p.polwithcheck,p.polrelid))>0));
