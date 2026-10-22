import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        {children}
      </div>
    </AuthGuard>
  );
}
