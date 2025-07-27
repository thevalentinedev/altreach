import { NextResponse } from "next/server"

interface ManualAuthRequest {
  authToken: string
  ct0?: string
}

interface ManualAuthResult {
  success: boolean
  authToken?: string
  ct0Token?: string
  error?: string
  message?: string
}

export async function POST(request: Request) {
  try {
    const { authToken, ct0 }: ManualAuthRequest = await request.json()

    console.log("🔑 Processing manual authentication...")

    if (!authToken || !authToken.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Auth token is required",
          message: "Please provide a valid auth_token cookie value.",
        } as ManualAuthResult,
        { status: 400 },
      )
    }

    // Basic validation for auth token format
    if (authToken.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid auth token format",
          message: "The auth token appears to be too short. Please check the value and try again.",
        } as ManualAuthResult,
        { status: 400 },
      )
    }

    // Test the authentication by making a simple request to Twitter
    try {
      console.log("🧪 Testing authentication credentials...")

      const testHeaders = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: `auth_token=${authToken.trim()}${ct0 ? `; ct0=${ct0.trim()}` : ""}`,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      }

      // Test with a simple request to Twitter's home page
      const testResponse = await fetch("https://twitter.com/home", {
        method: "GET",
        headers: testHeaders,
        redirect: "manual", // Don't follow redirects
      })

      // Check if we get redirected to login (which would indicate invalid auth)
      if (testResponse.status === 302) {
        const location = testResponse.headers.get("location")
        if (location && (location.includes("/login") || location.includes("/i/flow/login"))) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid authentication credentials",
              message:
                "The provided auth token appears to be invalid or expired. Please check your cookies and try again.",
            } as ManualAuthResult,
            { status: 401 },
          )
        }
      }

      console.log(`✅ Auth test response: ${testResponse.status}`)

      // If we get here, the auth seems to be working
      return NextResponse.json({
        success: true,
        authToken: authToken.trim(),
        ct0Token: ct0?.trim(),
        message: "Manual authentication successful.",
      } as ManualAuthResult)
    } catch (testError) {
      console.warn("⚠️ Could not test authentication, but proceeding anyway:", testError)

      // If testing fails, we'll still proceed but warn the user
      return NextResponse.json({
        success: true,
        authToken: authToken.trim(),
        ct0Token: ct0?.trim(),
        message: "Authentication saved (validation skipped due to network issues).",
      } as ManualAuthResult)
    }
  } catch (error) {
    console.error("❌ Error processing manual auth:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "Failed to process manual authentication. Please check your input and try again.",
      } as ManualAuthResult,
      { status: 500 },
    )
  }
}
