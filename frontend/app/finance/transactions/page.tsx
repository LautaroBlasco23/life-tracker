'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Consolidated into /finance (transactions tab). Transitional shim for old links. */
export default function FinanceTransactionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/finance/');
  }, [router]);

  return null;
}
