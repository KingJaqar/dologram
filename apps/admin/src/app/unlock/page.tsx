import { redirect } from 'next/navigation';
/** Safe compatibility redirect. The retired route accepts no credentials. */
export default function LegacyAccessPage() { redirect('/sign-in'); }
