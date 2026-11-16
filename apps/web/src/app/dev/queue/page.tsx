import { notFound } from 'next/navigation';

export default async function QueuePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { QueueDiagnostics } = await import('@development-diagnostics');
  return <QueueDiagnostics />;
}
