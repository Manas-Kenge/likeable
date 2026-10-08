import { NextResponse } from "next/server";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      `${BACKEND_URL}/project/chat/${encodeURIComponent(id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await request.json()),
        cache: "no-store",
      },
    );
    if (!response.ok || !response.body)
      return NextResponse.json(await response.json(), {
        status: response.status,
      });
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Generation could not start. Check that the backend is running.",
      },
      { status: 502 },
    );
  }
}
