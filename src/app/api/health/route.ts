import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ecomgenius-ads-os",
    timestamp: new Date().toISOString(),
  });
}
