'use client';

import { AuthGuard } from '@/components/auth-guard';
import { OnboardingWizard } from './onboarding-wizard';

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingWizard />
    </AuthGuard>
  );
}
