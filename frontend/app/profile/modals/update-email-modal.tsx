'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authService } from '@/services/auth-service';
import { userService } from '@/services/user-service';
import { showToast } from '@/lib/toast';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import type { User } from '@/types/user';
import { useTranslations } from '@/contexts/language-context';

interface UpdateEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onEmailUpdated: (user: User) => void;
}

export function UpdateEmailModal({
  open,
  onOpenChange,
  currentEmail,
  onEmailUpdated,
}: UpdateEmailModalProps) {
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email availability check state
  const [emailStatus, setEmailStatus] = useState<
    'available' | 'taken' | 'checking' | null
  >(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const t = useTranslations('updateEmail');
  const tCommon = useTranslations('common');

  const resetForm = () => {
    setPassword('');
    setNewEmail('');
    setShowPassword(false);
    setEmailStatus(null);
    setEmailError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  // Debounced email availability check
  const checkEmail = useCallback(
    async (value: string) => {
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !emailRegex.test(value) || value === currentEmail) {
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
    [currentEmail, t]
  );

  // Debounced effect for email check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newEmail) {
        checkEmail(newEmail);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [newEmail, checkEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newEmail === currentEmail) {
      showToast({
        title: t('sameEmail'),
        description: t('sameEmailDescription'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await authService.updateEmail({
        password,
        newEmail,
      });

      const updatedUser = authService.getCurrentUser();
      if (updatedUser) {
        onEmailUpdated(updatedUser);
      }

      showToast({
        title: t('emailUpdated'),
        description: t('emailUpdatedDescription'),
      });
      handleClose(false);
    } catch (error) {
      showToast({
        title: t('updateFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-email">{t('currentEmail')}</Label>
            <Input
              id="current-email"
              type="email"
              value={currentEmail}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">{t('newEmail')}</Label>
            <div className="relative">
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('newEmailPlaceholder')}
                required
                className={`pr-10 transition-colors ${
                  emailStatus === 'available'
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : emailStatus === 'taken'
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
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
            {emailError && <p className="text-xs text-red-600">{emailError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-password">{t('password')}</Label>
            <div className="relative">
              <Input
                id="email-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('updating') : t('updateEmail')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
