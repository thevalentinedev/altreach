import { NextResponse } from "next/server"
import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"

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

    // Configure Chromium for serverless environment
    const isProduction = process.env.NODE_ENV === "production"

    if (isProduction) {
      // Configure chromium for serverless
      chromium.setHeadlessMode = true
      chromium.setGraphicsMode = false
    }

    // Launch browser with appropriate configuration
    browser = await puppeteer.launch({
      args: isProduction
        ? [
            ...chromium.args,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=VizDisplayCompositor",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
          ]
        : [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--start-maximized",
            "--disable-blink-features=AutomationControlled",
            "--disable-features=VizDisplayCompositor",
          ],
      defaultViewport: isProduction ? chromium.defaultViewport : null,
      executablePath: isProduction ? await chromium.executablePath() : undefined,
      headless: isProduction ? chromium.headless : false,
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

    if (isProduction) {
      // In production headless mode, we need to simulate the login process
      // This is a simplified approach - in reality, you'd need to handle the login form
      console.log("⚠️ Production headless mode detected. Manual token entry recommended.")

      // Wait a bit to see if we're already logged in or can detect login elements
      await page.waitForTimeout(5000)

      // Check if we're already logged in
      const isAlreadyLoggedIn = await page.evaluate(() => {
        return !window.location.href.includes("/login") && !window.location.href.includes("/flow")
      })

      if (!isAlreadyLoggedIn) {
        throw new Error("Headless login not fully implemented. Please use manual token entry in production.")
      }
    } else {
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
          timeout: 300000, // 5 minutes in development
          polling: 1000,
        },
      )
    }

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
      message: isProduction
        ? "Login successful! Session cookies extracted from headless browser."
        : "Login successful! Session cookies extracted.",
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
