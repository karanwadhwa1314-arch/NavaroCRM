'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function ForbiddenToastInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('forbidden') === '1') {
      toast.error("You don't have access to that page");
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

export function ForbiddenToast() {
  return (
    <Suspense>
      <ForbiddenToastInner />
    </Suspense>
  );
}
