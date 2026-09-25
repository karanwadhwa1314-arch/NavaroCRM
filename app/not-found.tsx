import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navaro-heath px-4 text-center">
      <Compass className="h-10 w-10 text-navaro-green" strokeWidth={1.75} aria-hidden="true" />
      <h1 className="text-h1 text-navaro-green">Page not found</h1>
      <p className="text-body text-navaro-muted">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
      <Link href="/dashboard" className="rounded-control bg-navaro-green px-4 py-2 text-sm font-medium text-navaro-heath">
        Go to dashboard
      </Link>
    </div>
  );
}
