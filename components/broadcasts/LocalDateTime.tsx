'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';

export const LOCAL_DATETIME_PATTERN = "MMM d, yyyy 'at' h:mm a";

/**
 * Formats in the viewer's own timezone. Rendered after mount on purpose: the server runs in UTC,
 * so formatting during server render would show the wrong time (and cause a hydration mismatch).
 */
export function LocalDateTime({ value, pattern = LOCAL_DATETIME_PATTERN }: { value: string | Date | null | undefined; pattern?: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(value ? format(new Date(value), pattern) : '');
  }, [value, pattern]);
  if (!value) return <span>—</span>;
  return (
    <time dateTime={new Date(value).toISOString()} suppressHydrationWarning>
      {text || ' '}
    </time>
  );
}

export function localTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'your local time';
  }
}
