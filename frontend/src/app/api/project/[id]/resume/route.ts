import { NextResponse } from "next/server";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      `${BACKEND_URL}/project/${encodeURIComponent(id)}/resume`,
      { method: "POST", cache: "no-store" },
    );
    return NextResponse.json(await response.json(), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Project could not be reopened. Check that the backend is running.",
      },
      { status: 502 },
    );
  }
}
