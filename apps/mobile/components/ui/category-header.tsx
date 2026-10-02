import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface CategoryHeaderProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Left accent border color (token hex from theme-colors). */
  accentColor: string;
  iconColor: string;
  summaryValue: string | number;
  itemCount: number;
  itemName: string;
  extraInfo?: string;
}

/** Section header with accent border + summary count, mirroring web's CategoryHeader. */
export function CategoryHeader({
  icon: Icon,
  label,
  description,
  accentColor,
  iconColor,
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
    <View
      className="flex-row items-center gap-4 py-4 pl-4 mb-1"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <Icon size={24} color={iconColor} />
      <View className="flex-1">
        <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
          {label}
        </Text>
        {description ? (
          <Text className="text-sm text-muted dark:text-dark-muted">{description}</Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className="text-lg font-bold" style={{ color: iconColor }}>
          {summaryValue}
        </Text>
        <Text className="text-sm text-muted dark:text-dark-muted">
          {itemCount} {pluralizedName}
          {extraInfo ? ` • ${extraInfo}` : ''}
        </Text>
      </View>
    </View>
  );
}
