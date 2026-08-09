'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  if (!content) {
    return null;
  }

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ''}`}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
