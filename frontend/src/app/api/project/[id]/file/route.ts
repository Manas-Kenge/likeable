import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/project/[id]/file?path=<filepath>
 * Read a specific file from project sandbox
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const path = request.nextUrl.searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { success: false, error: "Missing 'path' query parameter" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/project/${id}/file?path=${encodeURIComponent(path)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to read file" },
      { status: 500 }
    );
  }
}
