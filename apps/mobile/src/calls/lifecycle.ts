type SessionTeardown = (userId: string | undefined) => Promise<void>;

let sessionTeardown: SessionTeardown | null = null;

export function registerCallSessionTeardown(handler: SessionTeardown): () => void {
  sessionTeardown = handler;
  return () => {
    if (sessionTeardown === handler) sessionTeardown = null;
  };
}

export async function stopCurrentCallForSessionChange(userId: string | undefined): Promise<void> {
  await sessionTeardown?.(userId);
}
