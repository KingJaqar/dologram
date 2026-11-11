import { classifyError, type ClassifiedError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type FolderRow = Tables<'folders'>;
export type FolderChatRow = Tables<'folder_chats'>;

/** RLS returns only the signed-in user's folders (D-24, 10.5). */
export async function listMyFolders(client: DgClient): Promise<DgResult<FolderRow[]>> {
  const { data, error, status } = await client.from('folders').select('*').order('folder_id');
  if (error) return { data: null, error: classifyError(error, status) };
  return { data, error: null };
}

/** RLS returns folder memberships only for folders the caller can read. */
export async function listMyFolderChats(client: DgClient): Promise<DgResult<FolderChatRow[]>> {
  const { data, error, status } = await client.from('folder_chats').select('*');
  if (error) return { data: null, error: classifyError(error, status) };
  return { data, error: null };
}

export type CreateFolderInput = Pick<FolderRow, 'folder_id' | 'name' | 'user_id'>;

function classifyFolderMutationError(error: unknown, status: number | null): ClassifiedError {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return { kind: 'server', code: 'FOLDER_NAME_EXISTS', status };
  }
  return classifyError(error, status);
}

export async function createFolder(
  client: DgClient,
  input: CreateFolderInput,
): Promise<DgResult<FolderRow>> {
  const { data, error, status } = await client.from('folders').insert(input).select().single();
  if (error) return { data: null, error: classifyFolderMutationError(error, status) };
  return { data, error: null };
}

export async function renameFolder(
  client: DgClient,
  folderId: string,
  name: string,
): Promise<DgResult<FolderRow>> {
  const { data, error, status } = await client
    .from('folders')
    .update({ name })
    .eq('folder_id', folderId)
    .select()
    .single();
  if (error) return { data: null, error: classifyFolderMutationError(error, status) };
  return { data, error: null };
}

export async function deleteFolder(
  client: DgClient,
  folderId: string,
): Promise<DgResult<true>> {
  const { data, error, status } = await client
    .from('folders')
    .delete()
    .eq('folder_id', folderId)
    .select();
  if (error) return { data: null, error: classifyError(error, status) };
  if (data.length === 0) return { data: null, error: { kind: 'server', code: null, status: null } };
  return { data: true, error: null };
}

export async function addChatToFolder(
  client: DgClient,
  folderId: string,
  chatId: string,
): Promise<DgResult<FolderChatRow>> {
  const { data, error, status } = await client
    .from('folder_chats')
    .insert({ folder_id: folderId, chat_id: chatId })
    .select()
    .single();
  if (error) return { data: null, error: classifyError(error, status) };
  return { data, error: null };
}

export async function removeChatFromFolder(
  client: DgClient,
  folderId: string,
  chatId: string,
): Promise<DgResult<true>> {
  const { data, error, status } = await client
    .from('folder_chats')
    .delete()
    .eq('folder_id', folderId)
    .eq('chat_id', chatId)
    .select();
  if (error) return { data: null, error: classifyError(error, status) };
  if (data.length === 0) return { data: null, error: { kind: 'server', code: null, status: null } };
  return { data: true, error: null };
}
