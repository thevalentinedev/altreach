import { NextResponse } from "next/server"
import puppeteer from "puppeteer"

interface LoginSessionResult {
  success: boolean
  cookies?: {
    auth_token: string
    ct0: string
  }
  error?: string
  message?: string
}

export async function POST(request: Request) {
  let browser = null

  try {
    console.log("🚀 Starting Twitter login session...")

    // Launch browser with regular puppeteer (includes Chromium)
    browser = await puppeteer.launch({
      headless: false, // Set to false for development so you can see the browser
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
      ],
      ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage()

    // Set realistic browser headers
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )

    // Remove webdriver property to avoid detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      })
    })

    console.log("🔗 Navigating to Twitter login page...")

    // Navigate to Twitter login page
    await page.goto("https://twitter.com/i/flow/login", {
      waitUntil: "networkidle2",
      timeout: 30000,
    })

    console.log("⏳ Waiting for user to complete login...")

    // Wait for the user to complete login by checking for the home page or profile
    await page.waitForFunction(
      () => {
        const currentUrl = window.location.href
        const isLoggedIn =
          currentUrl.includes("/home") ||
          currentUrl.includes("/timeline") ||
          (currentUrl.includes("twitter.com") &&
            !currentUrl.includes("/login") &&
            !currentUrl.includes("/flow") &&
            (document.querySelector('[data-testid="primaryColumn"]') !== null ||
              document.querySelector('[data-testid="AppTabBar_Home_Link"]') !== null ||
              document.querySelector('[role="main"]') !== null))

        return isLoggedIn
      },
      {
        timeout: 300000, // 5 minutes
        polling: 1000,
      },
    )

    console.log("✅ Login detected, extracting cookies...")

    // Wait a moment for cookies to be fully set
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Extract the important cookies
    const cookies = await page.cookies()
    console.log(
      "🍪 Found cookies:",
      cookies.map((c) => c.name),
    )

    const authToken = cookies.find((cookie) => cookie.name === "auth_token")?.value
    const ct0Token = cookies.find((cookie) => cookie.name === "ct0")?.value

    if (!authToken) {
      console.error(
        "❌ Available cookies:",
        cookies.map((c) => `${c.name}: ${c.value.substring(0, 10)}...`),
      )
      throw new Error("Could not find auth_token cookie. Login may have failed or cookies not yet set.")
    }

    console.log("🍪 Cookies extracted successfully")
    console.log("🔑 Auth token length:", authToken.length)

    // Close the browser
    await browser.close()
    browser = null

    return NextResponse.json({
      success: true,
      cookies: {
        auth_token: authToken,
        ct0: ct0Token || "",
      },
      message: "Login successful! Session cookies extracted.",
    } as LoginSessionResult)
  } catch (error) {
    console.error("❌ Error during login session:", error)

    // Ensure browser is closed on error
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error("⚠️ Error closing browser on error:", closeError)
      }
    }

    // Return a proper JSON error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "Failed to complete login session. Please try again or use manual token entry.",
      } as LoginSessionResult,
      { status: 500 },
    )
  }
}
