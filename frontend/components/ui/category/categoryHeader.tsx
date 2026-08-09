'use client';

import type { LucideIcon } from 'lucide-react';

interface CategoryHeaderProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  accentColor: string;
  iconColor: string;
  summaryLabel: string;
  summaryValue: string | number;
  itemCount: number;
  itemName: string;
  extraInfo?: string;
}

export function CategoryHeader({
  icon: Icon,
  label,
  description,
  accentColor,
  iconColor,
  summaryLabel,
  summaryValue,
  itemCount,
  itemName,
  extraInfo,
}: CategoryHeaderProps) {
  const pluralizedName =
    itemCount === 1
      ? itemName
      : itemName.endsWith('y')
        ? `${itemName.slice(0, -1)}ies`
        : `${itemName}s`;

  return (
    <div
      className={`flex items-center gap-4 py-4 border-l-4 ${accentColor} pl-4`}
    >
      <Icon className={`h-6 w-6 ${iconColor}`} />
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-foreground">{label}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="text-right">
        <div className={`text-lg font-bold ${iconColor}`}>{summaryValue}</div>
        <div className="text-sm text-muted-foreground">
          <span>
            {itemCount} {pluralizedName}
          </span>
          {extraInfo && (
            <span className="ml-2 text-xs opacity-75">• {extraInfo}</span>
          )}
        </div>
      </div>
    </div>
  );
}
