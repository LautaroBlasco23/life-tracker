'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Edit, Trash2 } from 'lucide-react';
import { DropdownMenuItem, EntityDropdown } from './entityDropdown';
import { DeleteModal } from './delete-modal';
import { StreakBadge } from '../streak-badge';

interface BadgeConfig {
  label: string;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary';
}

interface ProgressConfig {
  current: number;
  total: number;
  completedLabel?: string;
  incompleteHint?: string;
}

interface StreakConfig {
  current: number;
  longest?: number;
}

interface ExtraMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}

interface DeleteModalConfig {
  title: string;
  itemName: string;
  itemDetails: React.ReactNode;
  confirmLabel?: string;
}

interface EntityCardProps {
  title: string;
  subtitle?: string;
  badges?: BadgeConfig[];
  metadata?: React.ReactNode;
  progress?: ProgressConfig;
  streak?: StreakConfig;
  isCompleted?: boolean;
  onClick?: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  extraMenuItems?: ExtraMenuItem[];
  deleteModal: DeleteModalConfig;
  isProcessing?: boolean;
}

export function EntityCard({
  title,
  subtitle,
  badges = [],
  metadata,
  progress,
  streak,
  isCompleted = false,
  onClick,
  onEdit,
  onDelete,
  extraMenuItems,
  deleteModal,
  isProcessing = false,
}: EntityCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isClickable = Boolean(onClick) && !isCompleted;
  const progressPercentage = progress
    ? (progress.current / progress.total) * 100
    : 0;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isDropdownElement =
      target.closest('[data-dropdown]') ||
      target.closest('button') ||
      target.tagName === 'BUTTON';

    if (isDropdownElement) {
      return;
    }

    if (onClick) {
      onClick();
    }
  };

  return (
    <>
      <Card
        className={`bg-muted/30 transition-all duration-200 ${
          isCompleted
            ? 'border-green-500/50 bg-green-500/10'
            : isClickable
              ? 'hover:shadow-md cursor-pointer hover:scale-[1.02] hover:bg-muted/50'
              : 'hover:shadow-md'
        } ${isProcessing ? 'opacity-70' : ''}`}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-1 flex-wrap">
                <CardTitle
                  className={`text-base sm:text-lg font-medium ${
                    isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-foreground'
                  } break-words`}
                >
                  {title}
                </CardTitle>
                {isCompleted && progress && (
                  <Badge
                    variant="default"
                    className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50 shrink-0"
                  >
                    {progress.completedLabel ?? 'Complete'}
                  </Badge>
                )}
                {streak && streak.current > 0 && (
                  <StreakBadge current={streak.current} size="sm" />
                )}
              </div>
              {subtitle && (
                <CardDescription className="mt-1 text-sm text-muted-foreground break-words">
                  {subtitle}
                </CardDescription>
              )}
            </div>

            <EntityDropdown align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {extraMenuItems?.map((item, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={item.onClick}
                  disabled={item.disabled}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => setShowDeleteModal(true)}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </EntityDropdown>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {progress && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
                {!isCompleted && progress.incompleteHint && (
                  <span className="text-xs text-muted-foreground">
                    {progress.incompleteHint}
                  </span>
                )}
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {metadata && <div className="w-full">{metadata}</div>}

          {badges.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {badges.map((badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant ?? 'outline'}
                  className="text-xs"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title={deleteModal.title}
        itemName={deleteModal.itemName}
        itemDetails={deleteModal.itemDetails}
        onConfirm={onDelete}
        confirmLabel={deleteModal.confirmLabel}
      />
    </>
  );
}
