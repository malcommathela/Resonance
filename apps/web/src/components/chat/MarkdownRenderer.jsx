import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '@/components/ai-elements'

export const MarkdownRenderer = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-3 text-[15px] leading-relaxed last:mb-0">{children}</p>,
      h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-1.5 mt-3.5 text-[15px] font-semibold first:mt-0">{children}</h3>,
      ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-[15px]">{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-[15px]">{children}</ol>,
      li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
      a: ({ children, href }) => {
        if (!/^(https?:|mailto:)/i.test(href || '')) return <span>{children}</span>
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        )
      },
      code: ({ className, children }) => {
        const isBlock = /language-/.test(className || '')
        if (isBlock) {
          return <code className="block font-mono text-[13px] leading-relaxed text-foreground">{children}</code>
        }
        return (
          <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
            {children}
          </code>
        )
      },
      pre: ({ children }) => {
        const raw = React.isValidElement(children) ? children.props.children : ''
        return <CodeBlock code={String(raw ?? '').replace(/\n$/, '')}>{children}</CodeBlock>
      },
      table: ({ children }) => (
        <div className="mb-3 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border-b bg-muted px-3 py-2 text-left font-semibold text-foreground">
          {children}
        </th>
      ),
      td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
      blockquote: ({ children }) => (
        <blockquote className="mb-3 border-l-2 border-primary/50 pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-4 border-border" />,
    }}
  >
    {content}
  </ReactMarkdown>
)
