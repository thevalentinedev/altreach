import { NextResponse } from "next/server"

interface PredefinedAuthResult {
  success: boolean
  cookies?: {
    auth_token: string
    ct0?: string
  }
  error?: string
  message?: string
}

export async function POST(request: Request) {
  try {
    console.log("🔑 Checking predefined authentication credentials...")

    // Get the predefined auth tokens from environment variables
    const authToken = process.env.TWITTER_AUTH_TOKEN
    const ct0Token = process.env.TWITTER_CT0_TOKEN

    if (!authToken) {
      console.error("❌ No predefined auth token found in environment variables")
      return NextResponse.json(
        {
          success: false,
          error: "No predefined authentication credentials found",
          message: "Please ask your administrator to configure the TWITTER_AUTH_TOKEN environment variable.",
        } as PredefinedAuthResult,
        { status: 400 },
      )
    }

    console.log("✅ Predefined auth credentials found")

    return NextResponse.json({
      success: true,
      cookies: {
        auth_token: authToken,
        ...(ct0Token && { ct0: ct0Token }),
      },
      message: "Predefined authentication credentials applied successfully.",
    } as PredefinedAuthResult)
  } catch (error) {
    console.error("❌ Error retrieving predefined auth:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "Failed to apply predefined authentication. Please try another method.",
      } as PredefinedAuthResult,
      { status: 500 },
    )
  }
}
