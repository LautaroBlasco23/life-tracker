'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@shared/services/auth-service';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to onboarding guide (first run) or activities if authenticated,
    // otherwise to login
    if (authService.isAuthenticated()) {
      const user = authService.getCurrentUser();
      // `onboardingCompleted` is undefined in stale cached users (pre-feature)
      // and is treated as completed, so only new users get the guide.
      router.push(
        user?.onboardingCompleted === false ? '/onboarding' : '/activities'
      );
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
}
