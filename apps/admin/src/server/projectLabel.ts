import 'server-only';

/**
 * Header label for the signed-in shell. Phase 13 replaces this with the verified
 * project summary; until then the configured project reference identifies the target.
 */
export function getProjectLabel(): string {
  const ref = process.env.SUPABASE_PROJECT_REF?.trim();
  return ref ? ref : 'Project not configured';
}

/** CMP-30 Dashboard link; only a hosted project reference resolves to a real URL. */
export function getProjectDashboardUrl(): string | undefined {
  const ref = process.env.SUPABASE_PROJECT_REF?.trim();
  return ref && /^[a-z]{20}$/u.test(ref) ? `https://supabase.com/dashboard/project/${ref}` : undefined;
}
