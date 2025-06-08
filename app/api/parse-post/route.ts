import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

interface ScrapedContent {
  title: string | null
  description: string | null
  image: string | null
  type: string | null
  url: string
  fallbackContent?: string | null
}

function extractFallbackText($: cheerio.CheerioAPI): string | null {
  // Remove script and style elements
  $("script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar").remove()

  // Try to find meaningful content in order of preference
  const contentSelectors = [
    'meta[name="description"]',
    "article p:first-of-type",
    "main p:first-of-type",
    ".post-content p:first-of-type",
    ".content p:first-of-type",
    ".entry-content p:first-of-type",
    "p:first-of-type",
    "article",
    "main",
    ".post-content",
    ".content",
    ".entry-content",
  ]

  for (const selector of contentSelectors) {
    let text = ""

    if (selector.includes("meta")) {
      text = $(selector).attr("content") || ""
    } else {
      text = $(selector).text().trim()
    }

    if (text && text.length > 50 && text.length < 1000) {
      // Clean up the text
      return text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim().substring(0, 500) // Limit to 500 characters
    }
  }

  // Last resort: get first meaningful paragraph
  const paragraphs = $("p").toArray()
  for (const p of paragraphs) {
    const text = $(p).text().trim()
    if (text.length > 50 && text.length < 1000) {
      return text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim().substring(0, 500)
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    let validUrl: URL
    try {
      validUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Fetch the HTML content
    const response = await fetch(validUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.status}` }, { status: 400 })
    }

    const html = await response.text()

    // Parse HTML with cheerio
    const $ = cheerio.load(html)

    // Extract Open Graph data
    const ogTitle =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="og:title"]').attr("content") ||
      $("title").text().trim()

    const ogDescription =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content")

    const ogImage = $('meta[property="og:image"]').attr("content") || $('meta[name="og:image"]').attr("content")

    const ogType = $('meta[property="og:type"]').attr("content") || $('meta[name="og:type"]').attr("content")

    // If Open Graph data is insufficient, try fallback text scraping
    let fallbackContent: string | null = null
    const hasMinimalOGData = ogTitle || ogDescription

    if (!hasMinimalOGData) {
      fallbackContent = extractFallbackText($)
    }

    // Return null if no meaningful content found at all
    if (!ogTitle && !ogDescription && !fallbackContent) {
      return NextResponse.json({
        postContent: null,
        message: "No content could be extracted from this URL",
      })
    }

    const postContent: ScrapedContent = {
      title: ogTitle || null,
      description: ogDescription || null,
      image: ogImage || null,
      type: ogType || null,
      url: validUrl.toString(),
      fallbackContent: fallbackContent || null,
    }

    return NextResponse.json({
      postContent,
      usedFallback: !hasMinimalOGData && !!fallbackContent,
    })
  } catch (error) {
    console.error("Error parsing post:", error)

    // Handle specific error types
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "Unable to access the URL. It might be blocked or require authentication.",
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to parse post content",
      },
      { status: 500 },
    )
  }
}
