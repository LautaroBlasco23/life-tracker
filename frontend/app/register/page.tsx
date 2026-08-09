'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { userService } from '@/services/user-service';
import { showToast } from '@/lib/toast';
import {
  useTranslations,
  useLanguage,
  type Locale,
} from '@/contexts/language-context';
import { Languages, Check, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth');
  const { locale, setLocale } = useLanguage();

  // Username availability check state
  const [usernameStatus, setUsernameStatus] = useState<
    'available' | 'taken' | 'checking' | null
  >(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Email availability check state
  const [emailStatus, setEmailStatus] = useState<
    'available' | 'taken' | 'checking' | null
  >(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;
  const showPasswordError = passwordTouched && !isPasswordValid;

  // Debounced username availability check
  const checkUsername = useCallback(
    async (value: string) => {
      if (!value || value.length < 3) {
        setUsernameStatus(null);
        setUsernameError(null);
        return;
      }

      setUsernameStatus('checking');
      setUsernameError(null);

      try {
        const isAvailable = await authService.checkUsernameAvailability(value);
        if (isAvailable) {
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
          setUsernameError(t('usernameTaken') || 'Username is already taken');
        }
      } catch (error) {
        setUsernameStatus(null);
        setUsernameError(null);
      }
    },
    [t]
  );

  // Debounced effect for username check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username && username.length >= 3) {
        checkUsername(username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, checkUsername]);

  // Debounced email availability check
  const checkEmail = useCallback(
    async (value: string) => {
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value)) {
        setEmailStatus(null);
        setEmailError(null);
        return;
      }

      setEmailStatus('checking');
      setEmailError(null);

      try {
        const isAvailable = await userService.checkEmailAvailability(value);
        if (isAvailable) {
          setEmailStatus('available');
        } else {
          setEmailStatus('taken');
          setEmailError(t('emailTaken') || 'Email is already registered');
        }
      } catch (error) {
        setEmailStatus(null);
        setEmailError(null);
      }
    },
    [t]
  );

  // Debounced effect for email check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (email) {
        checkEmail(email);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, checkEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast({
        title: t('passwordMismatch'),
        description: t('passwordMismatchDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (!isPasswordValid) {
      showToast({
        title: t('passwordTooShort'),
        description: t('passwordTooShortDescription', {
          min: MIN_PASSWORD_LENGTH,
        }),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await authService.register({
        firstName,
        lastName,
        username,
        email,
        password,
      });
      showToast({
        title: t('accountCreated'),
        description: t('accountCreatedDescription'),
      });
      router.push('/activities');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred';
      showToast({
        title: t('registrationFailed'),
        description: errorMessage,
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
            {t('createAccount')}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {t('createAccountDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('firstName')}</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder={t('firstNamePlaceholder')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('lastName')}</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder={t('lastNamePlaceholder')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder={t('usernamePlaceholder')}
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    )
                  }
                  required
                  className={`bg-input pr-10 transition-colors ${
                    usernameStatus === 'available'
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : usernameStatus === 'taken'
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'border-border'
                  }`}
                  pattern="[a-z0-9_]+"
                  title="Username can only contain lowercase letters, numbers, and underscores"
                />
                {usernameStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
                {usernameStatus === 'taken' && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                )}
                {usernameStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('usernameHelp')}
              </p>
              {usernameStatus === 'available' && (
                <p className="text-xs text-green-600">
                  {t('usernameAvailable') || 'Username is available'}
                </p>
              )}
              {usernameError && (
                <p className="text-xs text-red-600">{usernameError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`bg-input pr-10 transition-colors ${
                    emailStatus === 'available'
                      ? 'border-green-500 focus-visible:ring-green-500'
                      : emailStatus === 'taken'
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : 'border-border'
                  }`}
                />
                {emailStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                )}
                {emailStatus === 'taken' && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                )}
                {emailStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {emailStatus === 'available' && (
                <p className="text-xs text-green-600">
                  {t('emailAvailable') || 'Email is available'}
                </p>
              )}
              {emailError && (
                <p className="text-xs text-red-600">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <PasswordInput
                id="password"
                placeholder={t('createPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                aria-invalid={showPasswordError}
                className="bg-input border-border"
              />
              {showPasswordError && (
                <p className="text-sm text-destructive">
                  {t('passwordMinLength', { min: MIN_PASSWORD_LENGTH })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder={t('confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-input border-border"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('creatingAccount') : t('createAccount')}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('haveAccount')}{' '}
              <Link href="/login" className="text-primary hover:underline">
                {t('signIn')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
