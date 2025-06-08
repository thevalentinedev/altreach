import { NextResponse } from "next/server"

// Endpoint to check cron job status and health
export async function GET() {
  try {
    const status = {
      service: "Altreach Trends Cron",
      status: "healthy",
      timestamp: new Date().toISOString(),
      nextRun: getNextCronRun(),
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
    }

    return NextResponse.json(status)
  } catch (error) {
    return NextResponse.json(
      {
        service: "Altreach Trends Cron",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

function getNextCronRun(): string {
  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(now.getHours() + 1, 0, 0, 0)
  return nextHour.toISOString()
}
