// Test-only preload for actual npm/PowerShell wrappers in a real terminal.
// Capture generated passwords in memory before console delivery; never save them.
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const entry = process.argv[1]?.replaceAll('\\', '/');
if (entry?.endsWith('/scripts/create-user.ts') || entry?.endsWith('/scripts/create-accounts.ts')) {
  const { source, options } = await import('./fixture.mts');
  const { getSql } = await import('../../../../packages/admin-core/src/db.ts');
  const { getAdminClient } = await import('../../../../packages/admin-core/src/supabase.ts');
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) throw Error('Protected test requires a real terminal');
  if (process.env.SUPABASE_DB_URL !== source.SUPABASE_DB_URL || process.env.SUPABASE_URL !== source.SUPABASE_URL) throw Error('Non-isolated terminal refused');
  const sql = getSql({ ...source, BACKUP_DIR: process.env.BACKUP_DIR }, options);
  getAdminClient(source, options);
  const output = console.info.bind(console);
  const failure = console.error.bind(console);
  let verifying = false;
  process.once('beforeExit', () => {
    if (!verifying) { failure('FAIL: no protected terminal password delivery occurred'); process.exitCode = 1; }
  });
  console.info = (...values) => {
    const value = typeof values[0] === 'string' ? values[0].trimStart() : '';
    if (!value.startsWith('Generated password: ') || verifying) return;
    verifying = true;
    let password = value.slice('Generated password: '.length);
    void (async () => {
      try {
        const rows = await sql`
          select u.id from auth.users u join public.profiles p on p.user_id=u.id
          where extensions.crypt(${password},u.encrypted_password)=u.encrypted_password
            and u.raw_app_meta_data -> 'must_change_password'='true'::jsonb and p.roles='user'
            and exists(select 1 from public.chats c join public.chat_members m on m.chat_id=c.chat_id
              where c.direct_key=u.id::text and m.user_id=u.id and m.role='owner')
            and (select count(*) from private.admin_audit a where a.target_user_id=u.id and a.action='account.create'
              and a.detail ->> 'source'='script')=1`;
        if (rows.length !== 1) throw Error('Terminal provisioning verification failed');
        const leaks = await sql`select count(*)::int as count from private.admin_audit where strpos(detail::text,${password})>0`;
        if (leaks[0]?.count !== 0) throw Error('Terminal audit plaintext check failed');
        const backup = resolve(process.env.BACKUP_DIR ?? '');
        const files = await readdir(backup, { withFileTypes: true });
        for (const file of files) {
          if (!file.isFile() || (await readFile(join(backup, file.name))).includes(Buffer.from(password))) throw Error('Terminal backup boundary failed');
        }
        output('PASS: actual wrapper in a real terminal created one account, initialized Saved Messages, audited source script and leaked no password to audit or BACKUP_DIR.');
      } catch {
        failure('FAIL: isolated terminal provisioning verification');
        process.exitCode = 1;
      } finally { password = ''; await sql.end({ timeout: 1 }); }
    })();
  };
}
