'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { noteGroupService } from '@shared/services/note-group-service';
import type { NoteGroup } from '@shared/types/note';
import { FolderPlus } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@shared/contexts/language-context';

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: (group: NoteGroup) => void;
}

export function CreateGroupModal({
  open,
  onOpenChange,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');

  const resetForm = () => {
    setName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsLoading(true);

    try {
      const group = await noteGroupService.createNoteGroup({
        name: trimmedName,
      });
      onGroupCreated(group);
      resetForm();
      showToast({ title: t('groupCreated') });
    } catch (error) {
      showToast({
        title: t('failedToCreateGroup'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FolderPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('createGroup')}</DialogTitle>
              <DialogDescription>{t('addGroup')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-group-name">{t('groupName')}</Label>
            <Input
              id="note-group-name"
              type="text"
              placeholder={t('groupName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={100}
              className="bg-input border-border"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? tCommon('creating') : t('createGroup')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
