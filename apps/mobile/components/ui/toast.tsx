import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from '../../lib/cn';

type ToastVariant = 'default' | 'destructive';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

type Listener = (toast: ToastOptions | null) => void;

const DURATION = 4000;
let current: ToastOptions | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(current));
}

export function showToast(options: ToastOptions) {
  current = { ...options };
  notify();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    notify();
  }, DURATION);
}

export function hideToast() {
  if (timer) clearTimeout(timer);
  current = null;
  notify();
}

/** Toast overlay rendered once at the root; driven by the module-level queue. */
export function ToastProvider() {
  const [toast, setToast] = useState<ToastOptions | null>(current);

  useEffect(() => {
    const listener: Listener = (t) => setToast(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!toast) return null;

  const destructive = toast.variant === 'destructive';

  return (
    <View className="absolute top-3 inset-x-4 z-50" pointerEvents="box-none">
      <Pressable
        onPress={hideToast}
        className={cn(
          'rounded-lg border p-3',
          destructive
            ? 'bg-danger dark:bg-dark-danger border-danger dark:border-dark-danger'
            : 'bg-background dark:bg-dark-background border-border dark:border-dark-border'
        )}
      >
        <Text
          className={cn(
            'text-sm font-semibold',
            destructive
              ? 'text-white'
              : 'text-foreground dark:text-dark-foreground'
          )}
        >
          {toast.title}
        </Text>
        {toast.description ? (
          <Text
            className={cn(
              'text-xs mt-0.5',
              destructive ? 'text-white/90' : 'text-muted dark:text-dark-muted'
            )}
          >
            {toast.description}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
