"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-accent-warm prose-a:text-accent-warm prose-a:underline prose-strong:text-accent-warm prose-blockquote:border-accent-gold prose-blockquote:bg-accent-gold/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic prose-code:text-accent-warm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip react-markdown's node prop
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
