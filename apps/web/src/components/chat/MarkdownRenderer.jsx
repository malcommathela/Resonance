import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/*
 * Markdown renderer for assistant messages — GFM tables, lists, fenced code.
 * Styled with resonance-* tokens (no typography plugin in this repo).
 */

export const MarkdownRenderer = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-[15px]">{children}</p>,
      h1: ({ children }) => <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>,
      h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="text-[15px] font-semibold mt-3.5 mb-1.5 first:mt-0">{children}</h3>,
      ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[15px]">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[15px]">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-resonance-text-primary">{children}</strong>,
      em: ({ children }) => <em className="italic text-resonance-text-secondary">{children}</em>,
      a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-resonance-accent underline underline-offset-2">
          {children}
        </a>
      ),
      code: ({ className, children }) => {
        const isBlock = /language-/.test(className || '')
        if (isBlock) {
          return <code className="block font-mono text-[13px] leading-relaxed text-resonance-text-primary">{children}</code>
        }
        return (
          <code className="px-1.5 py-0.5 rounded-md bg-resonance-bg-tertiary border border-resonance-border font-mono text-[13px] text-resonance-accent">
            {children}
          </code>
        )
      },
      pre: ({ children }) => (
        <pre className="mb-3 overflow-x-auto rounded-xl border border-resonance-border bg-resonance-bg-secondary p-4">
          {children}
        </pre>
      ),
      table: ({ children }) => (
        <div className="mb-3 overflow-x-auto rounded-xl border border-resonance-border">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border-b border-resonance-border bg-resonance-bg-tertiary px-3 py-2 text-left font-semibold text-resonance-text-primary">
          {children}
        </th>
      ),
      td: ({ children }) => <td className="border-b border-resonance-border px-3 py-2 align-top">{children}</td>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-resonance-accent/50 pl-4 mb-3 italic text-resonance-text-secondary">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-4 border-resonance-border" />,
    }}
  >
    {content}
  </ReactMarkdown>
)
