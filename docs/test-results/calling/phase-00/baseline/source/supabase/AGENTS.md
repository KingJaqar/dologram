# Supabase migrations

- Name files in `supabase/migrations/` with the next zero-padded sequential version and a descriptive snake_case name, for example `022_add_push_tokens.sql`. Rename files generated with a timestamp before applying them.
- Keep applied migration versions stable. Check the target's migration history before reconciling any version mismatch.
