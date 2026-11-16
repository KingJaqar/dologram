import { ChatPane } from '../../../../features/shell/ChatPane';

export default async function Chat({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <ChatPane chatId={chatId} />;
}
