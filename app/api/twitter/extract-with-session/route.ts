import { NextResponse } from "next/server"
import browserPool from "@/lib/browser-pool"

interface TweetExtractionResult {
  content?: string
  source: string
  error?: string
  images?: string[] // Added images array
}

export async function POST(request: Request) {
  let browser = null
  let page = null

  try {
    const { url, authToken } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    if (!authToken) {
      return NextResponse.json({ error: "Authentication token is required" }, { status: 400 })
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Check if it's a Twitter/X URL
    const isTwitterUrl =
      validUrl.hostname === "twitter.com" ||
      validUrl.hostname === "x.com" ||
      validUrl.hostname === "www.twitter.com" ||
      validUrl.hostname === "www.x.com"

    if (!isTwitterUrl) {
      return NextResponse.json({ error: "Not a valid Twitter/X URL" }, { status: 400 })
    }

    console.log("🚀 Starting tweet extraction for:", url)

    // Get browser from pool instead of launching new one
    browser = await browserPool.acquire()
    page = await browserPool.createPage(browser)

    console.log("🍪 Injecting authentication token...")

    // Inject auth_token cookie into Twitter domain
    await page.setCookie(
      {
        name: "auth_token",
        value: authToken,
        domain: ".twitter.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
    )

    console.log("🔗 Navigating to tweet URL...")

    // Navigate to the tweet URL with timeout
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20000, // Reduced timeout
    })

    console.log("⏳ Waiting for tweet content to render...")

    // Wait for the main tweet content to render
    await page.waitForSelector('div[data-testid="tweetText"]', {
      timeout: 10000, // Reduced timeout
    })

    console.log("📝 Extracting tweet content...")

    // Extract the main tweet text and images in parallel
    const [tweetContent, imageUrls] = await Promise.all([
      page.evaluate(() => {
        const tweetElement = document.querySelector('div[data-testid="tweetText"]')
        return tweetElement ? tweetElement.textContent?.trim() || null : null
      }),
      page.evaluate(() => {
        const images: string[] = []
        const imageContainers = document.querySelectorAll('div[data-testid="tweetPhoto"]')
        imageContainers.forEach((container) => {
          const img = container.querySelector("img")
          if (img && img.src) {
            const highResUrl = img.src.replace(/&name=\w+$/, "&name=large")
            images.push(highResUrl)
          }
        })
        return images
      }),
    ])

    console.log("🖼️ Extracted images:", imageUrls)

    // Validate extracted content
    if (!tweetContent) {
      return NextResponse.json({
        error: "Unable to extract tweet content. Possibly due to invalid or expired session cookie.",
      } as TweetExtractionResult)
    }

    console.log("✅ Tweet content extracted successfully")

    // Return successful extraction
    return NextResponse.json({
      content: tweetContent,
      source: url,
      images: imageUrls.length > 0 ? imageUrls : undefined,
    } as TweetExtractionResult)
  } catch (error) {
    console.error("❌ Error during tweet extraction:", error)

    return NextResponse.json({
      error: "Unable to extract tweet content. Possibly due to invalid or expired session cookie.",
    } as TweetExtractionResult)
  } finally {
    // Clean up page and release browser back to pool
    if (page) {
      try {
        await page.close()
        console.log("📄 Page closed successfully")
      } catch (closeError) {
        console.error("⚠️ Error closing page:", closeError)
      }
    }

    if (browser) {
      try {
        await browserPool.release(browser)
        console.log("🔄 Browser released back to pool")
      } catch (releaseError) {
        console.error("⚠️ Error releasing browser:", releaseError)
      }
    }
  }
}
