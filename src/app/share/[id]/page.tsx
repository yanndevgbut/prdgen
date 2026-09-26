import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  parseUserFlowsFromMarkdown,
  parseRoadmapFromMarkdown,
} from "@/lib/ai/9router";
import { formatDateIndo } from "@/lib/utils";

interface SharePageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: SharePageProps) {
  const supabase = createAdminClient();
  const { data: prd } = await supabase
    .from("prds")
    .select("title")
    .eq("id", params.id)
    .single();

  return {
    title: prd ? `${prd.title} — PRDGen` : "Dokumen PRD — PRDGen",
    description: "Product Requirements Document (PRD) yang dihasilkan oleh PRDGen AI.",
  };
}

export default async function SharePublicPage({ params }: SharePageProps) {
  const { id } = params;

  // Validasi format UUIDv4
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    notFound();
  }

  const supabase = createAdminClient();
  const { data: prd, error } = await supabase
    .from("prds")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !prd) {
    notFound();
  }

  const parsedFlows = parseUserFlowsFromMarkdown(prd.content_markdown || "");
  const parsedRoadmap = parseRoadmapFromMarkdown(prd.content_markdown || "");

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 bg-bg-surface border-b border-border flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
        <Link href="/" className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
          PRD<span className="text-primary-hover">Gen</span>
          <span className="text-[10px] bg-white/10 text-muted px-2 py-0.5 rounded font-normal">
            Public Document Viewer
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href={`/api/share/${prd.id}`}
            target="_blank"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors"
          >
            Raw Markdown API &rarr;
          </Link>
          <Link
            href="/register"
            className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Bikin PRD Kamu
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8">
        
        {/* Document Header Card */}
        <div className="mb-6 pb-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{prd.title}</h1>
            <p className="text-xs text-muted mt-1">
              Versi {prd.version} &bull; Status: <span className="uppercase font-semibold text-indigo-300">{prd.status}</span> &bull; Terakhir Diperbarui: {formatDateIndo(prd.updated_at || prd.created_at)}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/api/share/${prd.id}`}
              download={`${(prd.title || "PRD").replace(/\s+/g, "_")}.md`}
              className="px-3.5 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
            >
              Unduh .MD
            </Link>
          </div>
        </div>

        {/* 13-Chapter Rendered Markdown */}
        <div className="bg-bg-surface border border-border rounded-xl p-6 md:p-8 shadow-2xl mb-8">
          <MarkdownRenderer content={prd.content_markdown || ""} />
        </div>

        {/* User Flows Section */}
        {parsedFlows.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">
              Visualisasi Alur Pengguna (User Flows)
            </h2>
            <div className="space-y-4">
              {parsedFlows.map((flow, fIdx) => (
                <div key={fIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                  <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{flow.title}</span>
                  </div>
                  <div className="space-y-2.5">
                    {flow.steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-3 text-xs text-muted">
                        <span className="w-5 h-5 rounded-full bg-bg-input border border-border flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 mt-0.5">
                          {sIdx + 1}
                        </span>
                        <div className="p-2.5 bg-bg-input border border-border rounded-lg flex-1 leading-relaxed text-slate-200">
                          {step}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Roadmap Section */}
        {parsedRoadmap.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-bold text-white tracking-tight mb-4">
              Roadmap Pengembangan & Sprint Timeline
            </h2>
            <div className="space-y-4">
              {parsedRoadmap.map((phase, pIdx) => (
                <div key={pIdx} className="bg-bg-surface border border-border rounded-xl p-5">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-2 pb-2 border-b border-border">
                    <div>
                      <div className="text-sm font-bold text-white">{phase.phaseTitle}</div>
                      <div className="text-xs text-indigo-400 font-medium mt-0.5">{phase.timeline}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-semibold border border-emerald-500/30">
                      Fase {pIdx + 1}
                    </span>
                  </div>

                  {phase.milestones && phase.milestones.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-1.5">
                        Key Milestones:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.milestones.map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[11px] px-2.5 py-1 bg-white/5 border border-border rounded-md text-slate-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    {phase.tasks.map((t, tIdx) => (
                      <div
                        key={tIdx}
                        className="flex items-center gap-2 text-xs p-2 bg-bg-input border border-border rounded-lg text-muted"
                      >
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-slate-200">{t.task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-dim">
        PRDGen &bull; Platform Pembuatan PRD Otomatis Berbasis AI
      </footer>
    </div>
  );
}
