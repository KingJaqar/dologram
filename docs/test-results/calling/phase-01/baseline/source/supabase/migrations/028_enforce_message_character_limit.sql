-- Match the client contract: Unicode code points, including whitespace and captions.
-- Reject oversized inserts and edits without truncating message content.
alter table public.messages
  add constraint messages_content_max_chars
  check (char_length(content) <= 4096);
