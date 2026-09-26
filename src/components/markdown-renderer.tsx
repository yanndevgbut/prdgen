"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let keyIdx = 0;

  const flushTable = () => {
    if (!inTable) return;
    if (tableHeader.length > 0 || tableRows.length > 0) {
      renderedElements.push(
        <div key={`table-${keyIdx++}`} className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs border-collapse">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="bg-bg-input border-b border-border text-dim uppercase text-[10px] tracking-wider font-semibold">
                  {tableHeader.map((th, idx) => (
                    <th key={idx} className="p-2.5 md:p-3 text-white">
                      {renderInlineFormatting(th)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-border bg-bg-surface">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/[0.015] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 md:p-3 text-slate-300 align-top leading-relaxed">
                      {renderPriorityCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check Table Row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Check if it's separator row: | --- | --- |
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    if (!trimmed) {
      renderedElements.push(<div key={`empty-${keyIdx++}`} className="h-2" />);
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      renderedElements.push(<hr key={`hr-${keyIdx++}`} className="my-5 border-border" />);
      continue;
    }

    // Heading 1: # Bab Utama
    if (rawLine.startsWith("# ")) {
      const text = rawLine.replace(/^# /, "");
      renderedElements.push(
        <h1
          key={`h1-${keyIdx++}`}
          className="text-lg md:text-xl font-extrabold text-white tracking-tight mt-6 mb-2 pb-1.5 border-b border-border/80 first:mt-0"
        >
          {renderInlineFormatting(text)}
        </h1>
      );
      continue;
    }

    // Heading 2: ## Sub-bab
    if (rawLine.startsWith("## ")) {
      const text = rawLine.replace(/^## /, "");
      renderedElements.push(
        <h2
          key={`h2-${keyIdx++}`}
          className="text-sm md:text-base font-bold text-indigo-300 tracking-tight mt-4 mb-1.5"
        >
          {renderInlineFormatting(text)}
        </h2>
      );
      continue;
    }

    // Heading 3: ### Sub-sub-bab
    if (rawLine.startsWith("### ")) {
      const text = rawLine.replace(/^### /, "");
      renderedElements.push(
        <h3 key={`h3-${keyIdx++}`} className="text-xs md:text-sm font-semibold text-white mt-3 mb-1">
          {renderInlineFormatting(text)}
        </h3>
      );
      continue;
    }

    // Task Checklist: - [ ] or - [x]
    if (/^\s*-\s*\[( |x)\]\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/^\s*-\s*\[( |x)\]\s*(.+)/i);
      if (match) {
        const isChecked = match[1].toLowerCase() === "x";
        const taskText = match[2];
        renderedElements.push(
          <div key={`task-${keyIdx++}`} className="flex items-start gap-2.5 my-1 text-xs text-muted">
            <span
              className={`w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 ${
                isChecked ? "bg-emerald-500 border-emerald-500" : "border-border bg-bg-input"
              }`}
            >
              {isChecked && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className={isChecked ? "line-through text-dim" : "text-slate-300"}>
              {renderInlineFormatting(taskText)}
            </span>
          </div>
        );
        continue;
      }
    }

    // Numbered List: 1. 2. 3.
    if (/^\s*\d+\.\s*(.+)/.test(trimmed)) {
      const match = trimmed.match(/^\s*(\d+)\.\s*(.+)/);
      if (match) {
        renderedElements.push(
          <div key={`ol-${keyIdx++}`} className="flex items-start gap-2.5 my-1.5 text-xs text-slate-300 leading-relaxed pl-1">
            <span className="w-4 h-4 rounded-full bg-bg-input border border-border flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 mt-0.5">
              {match[1]}
            </span>
            <div className="flex-1">{renderInlineFormatting(match[2])}</div>
          </div>
        );
        continue;
      }
    }

    // Bullet List: - or *
    if (/^\s*[-*]\s*(.+)/.test(trimmed)) {
      const match = trimmed.match(/^\s*[-*]\s*(.+)/);
      if (match) {
        renderedElements.push(
          <div key={`ul-${keyIdx++}`} className="flex items-start gap-2 my-1 text-xs text-slate-300 leading-relaxed pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-hover flex-shrink-0 mt-1.5" />
            <div className="flex-1">{renderInlineFormatting(match[1])}</div>
          </div>
        );
        continue;
      }
    }

    // Blockquote: > Catatan
    if (trimmed.startsWith(">")) {
      const text = trimmed.replace(/^>\s*/, "");
      renderedElements.push(
        <div
          key={`quote-${keyIdx++}`}
          className="my-3 p-3 bg-bg-input border-l-2 border-primary-hover rounded-r-lg text-xs text-indigo-200 leading-relaxed italic"
        >
          {renderInlineFormatting(text)}
        </div>
      );
      continue;
    }

    // Regular Paragraph
    renderedElements.push(
      <p key={`p-${keyIdx++}`} className="my-1.5 text-xs md:text-sm text-muted leading-relaxed">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  }

  flushTable();

  return <div className={`font-sans leading-relaxed text-slate-300 ${className}`}>{renderedElements}</div>;
}

/**
 * Render format prioritas sel tabel menjadi badge warna
 */
function renderPriorityCell(text: string): React.ReactNode {
  const clean = text.replace(/\*\*/g, "").trim();

  if (clean === "Wajib") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Wajib
      </span>
    );
  }
  if (clean === "Penting") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        Penting
      </span>
    );
  }
  if (clean === "Fase 2") {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
        Fase 2
      </span>
    );
  }

  return renderInlineFormatting(text);
}

/**
 * Render format inline teks: **bold**, `code`, dan tag status
 */
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return "";

  // Split by bold (**...**) and code (`...`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      if (inner.startsWith("[Asumsi]")) {
        return (
          <span key={idx} className="font-bold text-amber-300 mr-1">
            [Asumsi]
          </span>
        );
      }
      return (
        <strong key={idx} className="font-bold text-white">
          {inner}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 bg-white/10 text-indigo-300 rounded font-mono text-[11px] border border-white/5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
