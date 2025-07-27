import { NextResponse } from "next/server"
import browserPool from "@/lib/browser-pool"

interface AuthData {
  authToken: string
  ct0Token?: string
}

interface TweetExtractionResult {
  content?: string | null
  source: string
  images?: string[]
  error?: string
}

// In-memory cache (replace with a proper database in production)
const authCache: { [key: string]: AuthData } = {}

function saveAuthToCache(sessionId: string, authData: AuthData) {
  authCache[sessionId] = authData
}

function getAuthFromCache(sessionId: string): AuthData | undefined {
  return authCache[sessionId]
}

export async function POST(request: Request) {
  let browser = null
  let page = null

  try {
    const { url, authToken, ct0Token } = await request.json()

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

    console.log("🍪 Injecting authentication tokens...")

    // Inject auth_token cookie into Twitter domain
    const cookies = [
      {
        name: "auth_token",
        value: authToken,
        domain: ".twitter.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None" as const,
      },
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None" as const,
      },
    ]

    // Add CT0 token if provided
    if (ct0Token) {
      cookies.push(
        {
          name: "ct0",
          value: ct0Token,
          domain: ".twitter.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "None" as const,
        },
        {
          name: "ct0",
          value: ct0Token,
          domain: ".x.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "None" as const,
        },
      )
    }

    await page.setCookie(...cookies)

    console.log("🔗 Navigating to tweet URL...")

    // Navigate to the tweet URL with timeout
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000, // Increased timeout
    })
    
    // Wait a bit for the page to fully render
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Debug: Check if we're on the right page
    const currentUrl = page.url()
    console.log("📍 Current page URL:", currentUrl)
    
    // Debug: Check if we're redirected to login
    if (currentUrl.includes('/login') || currentUrl.includes('/flow')) {
      console.log("⚠️ Redirected to login page - authentication may have failed")
      return NextResponse.json({
        error: "Authentication failed - redirected to login page. Please refresh your session.",
      } as TweetExtractionResult)
    }

    console.log("⏳ Waiting for tweet content to render...")

    // Wait for the main tweet content to render with multiple selectors
    let tweetContent = null
    let imageUrls: string[] = []
    
    try {
      // Try multiple selectors for tweet content
      const selectors = [
        'div[data-testid="tweetText"]',
        'div[data-testid="tweet"] div[lang]',
        'article[data-testid="tweet"] div[lang]',
        'div[data-testid="tweet"] span[dir="auto"]',
        'article div[lang]',
        'div[data-testid="tweet"] div[dir="auto"]'
      ]
      
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 })
          tweetContent = await page.evaluate((sel) => {
            const element = document.querySelector(sel)
            return element ? element.textContent?.trim() || null : null
          }, selector)
          
          if (tweetContent) {
            console.log(`✅ Found tweet content using selector: ${selector}`)
            break
          }
        } catch (error) {
          console.log(`⚠️ Selector ${selector} not found, trying next...`)
        }
      }
      
      // Extract images with multiple selectors
      imageUrls = await page.evaluate(() => {
        const images: string[] = []
        const imageSelectors = [
          'div[data-testid="tweetPhoto"] img',
          'article[data-testid="tweet"] img[src*="pbs.twimg.com"]',
          'div[data-testid="tweet"] img[src*="pbs.twimg.com"]',
          'img[src*="pbs.twimg.com"]'
        ]
        
        for (const selector of imageSelectors) {
          const imgElements = document.querySelectorAll(selector)
          imgElements.forEach((img) => {
            if (img instanceof HTMLImageElement && img.src) {
              const highResUrl = img.src.replace(/&name=\w+$/, "&name=large")
              if (!images.includes(highResUrl)) {
                images.push(highResUrl)
              }
            }
          })
        }
        return images
      })
      
    } catch (error) {
      console.log("⚠️ Error during content extraction:", error)
    }
    
    // Fallback: If no content found, try to extract any text content from the page
    if (!tweetContent) {
      console.log("🔄 Trying fallback content extraction...")
      try {
        tweetContent = await page.evaluate(() => {
          // Look for any text content that might be the tweet
          const possibleSelectors = [
            'article[data-testid="tweet"]',
            'div[data-testid="tweet"]',
            'main article',
            '[role="main"] article'
          ]
          
          for (const selector of possibleSelectors) {
            const element = document.querySelector(selector)
            if (element) {
              const text = element.textContent?.trim()
              if (text && text.length > 10 && text.length < 1000) {
                return text
              }
            }
          }
          return null
        })
        
        if (tweetContent) {
          console.log("✅ Found content using fallback method")
        }
      } catch (fallbackError) {
        console.log("⚠️ Fallback extraction also failed:", fallbackError)
      }
    }

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
