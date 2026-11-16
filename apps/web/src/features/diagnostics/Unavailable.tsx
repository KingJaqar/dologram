import { notFound } from 'next/navigation';

// Production resolves the development-only module to this server denial boundary.
export function SharedDiagnostics(): never {
  notFound();
}
export function QueueDiagnostics(): never {
  notFound();
}
