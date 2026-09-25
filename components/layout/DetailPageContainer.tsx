import type { ReactNode } from 'react';

/** Centers detail-page content at a readable max width. List pages use full width instead. */
export function DetailPageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1280px]">{children}</div>;
}
