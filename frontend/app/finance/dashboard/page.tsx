'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Consolidated into /finance (dashboard tab). Transitional shim for old links. */
export default function FinanceDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance/');
  }, [router]);

  return null;
}
