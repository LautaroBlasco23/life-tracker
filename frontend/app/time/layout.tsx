import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';

export default function TimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">{children}</div>
      </div>
    </AuthGuard>
  );
}
