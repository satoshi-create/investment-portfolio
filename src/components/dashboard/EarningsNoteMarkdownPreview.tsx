"use client";

import type { ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components, type Options } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/** unified / rehype の型定義の食い違いを避ける（実行時は正しい） */
const earningsNoteRehypePlugins = [rehypeSanitize()] as NonNullable<Options["rehypePlugins"]>;

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-foreground mt-4 mb-2 first:mt-0 border-b border-border pb-1.5">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-foreground mt-3.5 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground/95 mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="text-xs font-bold text-foreground/90 mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="text-sm text-foreground/90 leading-relaxed my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="text-sm text-foreground/90 list-disc pl-5 my-2 space-y-1 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm text-foreground/90 list-decimal pl-5 my-2 space-y-1 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-cyan/50 pl-3 my-2 text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent-cyan underline underline-offset-2 hover:opacity-90 break-all"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const cls = className != null ? String(className) : "";
    const text = String(children);
    const fencedLang = cls.startsWith("language-");
    const multiline = text.includes("\n");
    if (fencedLang || multiline) {
      return (
        <code
          className={`font-mono text-[13px] text-foreground/95 whitespace-pre-wrap ${cls}`.trim()}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-[12px] bg-muted/80 text-amber-200/95 px-1 py-0.5 rounded border border-border/60"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-background/90 p-3 text-[13px] leading-snug [&_code]:rounded-none [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-xs text-foreground/90">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50 border-b border-border">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2.5 py-2 font-bold text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-2.5 py-2 align-top">{children}</td>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  del: ({ children }) => <del className="line-through text-muted-foreground">{children}</del>,
  input: (props: ComponentProps<"input">) => {
    if (props.type === "checkbox") {
      return (
        <input
          {...props}
          type="checkbox"
          readOnly
          className="mr-1.5 align-middle rounded border-border accent-accent-cyan"
          aria-hidden
        />
      );
    }
    return null;
  },
};

export function EarningsNoteMarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center leading-relaxed">
        プレビューする内容がありません。
        <br />
        <span className="text-[11px]">編集タブで Markdown を入力してください。</span>
      </p>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={earningsNoteRehypePlugins}
        urlTransform={defaultUrlTransform}
        components={mdComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
