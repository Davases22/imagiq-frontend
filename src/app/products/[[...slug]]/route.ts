import { NextResponse } from "next/server";

const goneResponse = () =>
  new NextResponse("Gone", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, max-age=3600",
    },
  });

export async function GET() {
  return goneResponse();
}

export async function HEAD() {
  return goneResponse();
}
