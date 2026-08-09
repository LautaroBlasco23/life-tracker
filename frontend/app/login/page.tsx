'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authService } from '@/services/auth-service';
import { showToast } from '@/lib/toast';
import {
  useTranslations,
  useLanguage,
  type Locale,
} from '@/contexts/language-context';
import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth');
  const { locale, setLocale } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.login({ identifier, password });
      showToast({
        title: t('welcomeBack'),
        description: t('welcomeBackDescription'),
      });
      router.push('/activities');
    } catch (error) {
      showToast({
        title: t('loginFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-end mb-2">
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value as Locale)}
            >
              <SelectTrigger className="w-[140px]" size="sm">
                <Languages className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('english')}</SelectItem>
                <SelectItem value="es">{t('spanish')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardTitle className="text-2xl font-semibold text-center">
            {t('signIn')}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {t('signInDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t('usernameOrEmail')}</Label>
              <Input
                id="identifier"
                type="text"
                placeholder={t('usernameOrEmailPlaceholder')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <PasswordInput
                id="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-primary hover:underline">
                {t('signUp')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
