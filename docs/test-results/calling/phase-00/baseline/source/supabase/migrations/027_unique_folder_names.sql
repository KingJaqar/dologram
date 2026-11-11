-- Folder names are unique per user, ignoring case and surrounding whitespace.
-- Repair duplicate legacy rows before adding the constraint.
with ranked as (
  select
    folder_id,
    user_id,
    name,
    row_number() over (
      partition by user_id, lower(btrim(name))
      order by folder_id
    ) as duplicate_number
  from public.folders
), duplicates as (
  select
    folder_id,
    btrim(name) as name,
    duplicate_number,
    ' (' || duplicate_number::text || ')' as suffix
  from ranked
  where duplicate_number > 1
)
update public.folders as folders
set name = left(duplicates.name, 32 - char_length(duplicates.suffix)) || duplicates.suffix
from duplicates
where folders.folder_id = duplicates.folder_id;

create unique index if not exists folders_user_name_unique
  on public.folders (user_id, lower(btrim(name)));
