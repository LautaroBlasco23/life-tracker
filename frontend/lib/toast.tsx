'use client';

import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
}

const toastQueue: ToastItem[] = [];
let listeners: ((queue: ToastItem[]) => void)[] = [];

function notifyListeners() {
  listeners.forEach((l) => l([...toastQueue]));
}

export const showToast = ({
  title,
  description,
  variant = 'default',
}: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => {
  toastQueue.push({
    id: `${Date.now()}-${Math.random()}`,
    title,
    description,
    variant,
  });
  notifyListeners();
};

function CookieToast() {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const duration = 4000;

  useEffect(() => {
    const listener = (newQueue: ToastItem[]) => setQueue(newQueue);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (queue.length > 0 && !currentToast && !progressRef.current) {
      const [next, ...rest] = queue;
      toastQueue.splice(0, toastQueue.length, ...rest);
      notifyListeners();
      setCurrentToast(next);
      setProgress(100);
      setIsVisible(true);
      startTimeRef.current = Date.now();
    }
  }, [queue, currentToast]);

  useEffect(() => {
    if (currentToast && isVisible) {
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);

        if (remaining <= 0 && progressRef.current) {
          clearInterval(progressRef.current);
          progressRef.current = null;
          setIsVisible(false);
          setTimeout(() => {
            setCurrentToast(null);
          }, 300);
        }
      }, 50);
    }

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
    };
  }, [currentToast, isVisible]);

  const handleDismiss = () => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    setIsVisible(false);
    setTimeout(() => {
      setCurrentToast(null);
    }, 300);
  };

  return (
    <>
      <Toaster position="top-center" gutter={0} />
      {currentToast && (
        <div
          className={`pointer-events-auto fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-all duration-300 ${
            isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
        >
          <div
            className={`relative flex w-full max-w-[360px] items-start space-x-3 overflow-hidden rounded-lg border shadow-lg ${
              currentToast.variant === 'destructive'
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : 'border bg-background text-foreground'
            }`}
          >
            <div className="grid flex-1 gap-1 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {queue.length > 0 && (
                    <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-xs font-medium">
                      +{queue.length}
                    </span>
                  )}
                  <p className="text-sm font-semibold">{currentToast.title}</p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {currentToast.description && (
                <p className="text-xs opacity-90">{currentToast.description}</p>
              )}
            </div>
            <div
              className={`absolute bottom-0 left-0 h-1 transition-all duration-50 ${
                currentToast.variant === 'destructive'
                  ? 'bg-white/30'
                  : 'bg-foreground/10'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function ToastProvider() {
  return <CookieToast />;
}

export { toast };
