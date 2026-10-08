import { NextResponse } from "next/server";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      `${BACKEND_URL}/project/${encodeURIComponent(id)}/export`,
      { cache: "no-store" },
    );
    if (!response.ok)
      return NextResponse.json(await response.json(), {
        status: response.status,
      });
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          response.headers.get("Content-Disposition") ||
          "attachment; filename=project.zip",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Export failed. Check that the backend is running.",
      },
      { status: 502 },
    );
  }
}
