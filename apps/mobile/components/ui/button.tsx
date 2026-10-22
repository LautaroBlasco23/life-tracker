import { forwardRef } from 'react';
import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native';
import { cn } from '../../lib/cn';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  className?: string;
  textClassName?: string;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, { bg: string; text: string }> = {
  default: { bg: 'bg-primary dark:bg-dark-primary', text: 'text-primary-foreground dark:text-dark-primary-foreground' },
  outline: { bg: 'bg-transparent border border-border dark:border-dark-border', text: 'text-foreground dark:text-dark-foreground' },
  ghost: { bg: 'bg-transparent', text: 'text-primary dark:text-dark-primary' },
  destructive: { bg: 'bg-danger dark:bg-dark-danger', text: 'text-primary-foreground dark:text-dark-primary-foreground' },
};

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ variant = 'default', className, textClassName, loading, disabled, children, ...props }, ref) => {
    const v = variantClasses[variant];
    return (
      <Pressable
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'h-11 px-4 rounded-lg items-center justify-center flex-row',
          v.bg,
          (disabled || loading) && 'opacity-50',
          className
        )}
        {...props}
      >
        {typeof children === 'string' ? (
          <Text className={cn('font-medium text-base', v.text, textClassName)}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);
Button.displayName = 'Button';

export function buttonStyle(opts: { variant?: ButtonVariant } = {}): ViewStyle {
  return opts.variant === 'outline' ? { borderWidth: 1 } : {};
}
