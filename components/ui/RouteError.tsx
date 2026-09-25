'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-12 max-w-md text-center">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden="true" />
      <h2 className="text-h3 text-navaro-green">Something went wrong</h2>
      <p className="mt-2 text-body text-navaro-muted">{error.message || 'An unexpected error occurred.'}</p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </Card>
  );
}
