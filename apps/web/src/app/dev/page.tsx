import { notFound } from 'next/navigation';

export default async function DevelopmentPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { SharedDiagnostics } = await import('@development-diagnostics');
  return <SharedDiagnostics />;
}
