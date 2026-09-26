import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: {
    id: string;
  };
}

/**
 * Public Raw AI Agent Endpoint:
 * Mengembalikan isi dokumen PRD mentah dalam format plain markdown (text/markdown).
 * AI Agent (Claude Code, Cursor, Aider, Antigravity) dapat membaca dokumen via curl / web fetch.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;

    // Validasi UUIDv4 format untuk mencegah collision dan injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return new NextResponse("Error: ID PRD tidak valid (harus berformat UUID).", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabase = createAdminClient();
    const { data: prd, error } = await supabase
      .from("prds")
      .select("id, title, content_markdown, version, updated_at")
      .eq("id", id)
      .single();

    if (error || !prd) {
      return new NextResponse("Error: Dokumen PRD tidak ditemukan.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Kembalikan raw markdown murni
    return new NextResponse(prd.content_markdown || `# ${prd.title}\n\nDokumen PRD kosong.`, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-PRD-Title": encodeURIComponent(prd.title),
        "X-PRD-Version": String(prd.version),
      },
    });
  } catch (err: any) {
    return new NextResponse(`Error server: ${err.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
