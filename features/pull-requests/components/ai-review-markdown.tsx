"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cn } from "@/lib/utils";

// Shiki token styles + Streamdown base styles for the markdown renderer.
import "streamdown/styles.css";

type AiReviewMarkdownProps = {
  /** Raw markdown produced by the AI reviewer. */
  markdown: string;
  className?: string;
};

/**
 * Renders an AI-generated pull request review as markdown.
 *
 * Uses Streamdown (a streaming-safe markdown renderer built for AI output)
 * with the Shiki code-highlighting plugin, so fenced code blocks inside a
 * review get syntax highlighting. GFM (tables, task lists, strikethrough)
 * is enabled by default.
 */
export function AiReviewMarkdown({ markdown, className }: AiReviewMarkdownProps) {
  return (
    <div className={cn("ai-review", className)}>
      <Streamdown plugins={{ code }}>{markdown}</Streamdown>
    </div>
  );
}
