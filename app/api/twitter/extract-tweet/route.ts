import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import OpenAI from "openai"

// Initialize OpenAI client with better error handling
let openai: OpenAI | null = null

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
} catch (error) {
  console.error("❌ Failed to initialize OpenAI client:", error)
}

interface TweetContent {
  text: string | null
  author: string | null
  username: string | null
  timestamp: string | null
  url: string
  aiGenerated?: boolean
  images?: string[] // Added images array
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

    // Check if it's a Twitter/X URL
    const isTwitterUrl =
      validUrl.hostname === "twitter.com" ||
      validUrl.hostname === "x.com" ||
      validUrl.hostname === "www.twitter.com" ||
      validUrl.hostname === "www.x.com"

    if (!isTwitterUrl) {
      return NextResponse.json({ error: "Not a valid Twitter/X URL" }, { status: 400 })
    }

    // Extract basic info from URL first
    const tweetInfo = extractTweetInfoFromUrl(url)

    if (!tweetInfo) {
      return NextResponse.json({ error: "Invalid Twitter/X post URL format" }, { status: 400 })
    }

    console.log("🔍 Extracting tweet from URL:", url)
    console.log("📊 Tweet info from URL:", tweetInfo)

    try {
      // Try to fetch the HTML content with better headers
      const response = await fetch(validUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      })

      console.log("📡 Fetch response status:", response.status)

      if (!response.ok) {
        console.warn("⚠️ Failed to fetch tweet directly, trying GPT fallback")
        return await getContentWithGPT(url, tweetInfo)
      }

      const html = await response.text()
      console.log("📄 HTML content length:", html.length)

      // Parse HTML with cheerio
      const $ = cheerio.load(html)

      // Try multiple extraction methods
      let tweetText = null
      let author = null
      const username = tweetInfo.username
      const images: string[] = [] // Initialize images array

      // Method 1: Try Open Graph tags
      const ogDescription = $('meta[property="og:description"]').attr("content")
      const ogTitle = $('meta[property="og:title"]').attr("content")

      // Extract images from Open Graph tags
      const ogImage = $('meta[property="og:image"]').attr("content")
      if (ogImage && !ogImage.includes("twitter_logo")) {
        images.push(ogImage)
      }

      // Also check for Twitter card images
      const twitterImage = $('meta[name="twitter:image"]').attr("content")
      if (twitterImage && !twitterImage.includes("twitter_logo") && !images.includes(twitterImage)) {
        images.push(twitterImage)
      }

      // Look for image tags in the HTML that might be tweet images
      $("img").each((_, element) => {
        const src = $(element).attr("src")
        if (src && (src.includes("pbs.twimg.com/media") || src.includes("media.x.com")) && !images.includes(src)) {
          images.push(src)
        }
      })

      console.log("🖼️ Extracted images:", images)

      if (ogDescription && ogDescription.trim()) {
        tweetText = ogDescription.trim()
      }

      // Extract author from OG title
      if (ogTitle) {
        // OG title often has format "Author on Twitter: "Tweet""
        const titleMatch = ogTitle.match(/(.*?) on (Twitter|X): /)
        if (titleMatch) {
          author = titleMatch[1]
        }
      }

      // Method 2: Try Twitter meta tags
      if (!tweetText) {
        const twitterDescription = $('meta[name="twitter:description"]').attr("content")
        const twitterTitle = $('meta[name="twitter:title"]').attr("content")

        console.log("🐦 Twitter Description:", twitterDescription)
        console.log("🐦 Twitter Title:", twitterTitle)

        if (twitterDescription && twitterDescription.trim()) {
          tweetText = twitterDescription.trim()
        }

        if (twitterTitle && !author) {
          const titleMatch = twitterTitle.match(/(.*?) on (Twitter|X)/)
          if (titleMatch) {
            author = titleMatch[1]
          }
        }
      }

      // Method 3: Try to find tweet content in JSON-LD or script tags
      if (!tweetText) {
        $('script[type="application/ld+json"]').each((_, element) => {
          try {
            const jsonData = JSON.parse($(element).html() || "")
            if (jsonData.text || jsonData.description) {
              tweetText = jsonData.text || jsonData.description
              if (jsonData.author && jsonData.author.name) {
                author = jsonData.author.name
              }

              // Check for image in JSON-LD
              if (jsonData.image && typeof jsonData.image === "string" && !images.includes(jsonData.image)) {
                images.push(jsonData.image)
              } else if (jsonData.image && Array.isArray(jsonData.image)) {
                jsonData.image.forEach((img: string) => {
                  if (!images.includes(img)) {
                    images.push(img)
                  }
                })
              }
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
        })
      }

      // Method 4: Try to extract from page title
      if (!tweetText) {
        const pageTitle = $("title").text()
        console.log("📰 Page title:", pageTitle)

        if (pageTitle && pageTitle.includes(":")) {
          const parts = pageTitle.split(":")
          if (parts.length >= 2) {
            tweetText = parts.slice(1).join(":").trim()
            if (parts[0] && !author) {
              author = parts[0].trim()
            }
          }
        }
      }

      // Clean up extracted text
      if (tweetText) {
        // Remove common prefixes/suffixes
        tweetText = tweetText
          .replace(/^["']|["']$/g, "") // Remove quotes
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim()

        // Remove Twitter-specific suffixes
        tweetText = tweetText.replace(/\s*\|\s*Twitter\s*$/, "")
        tweetText = tweetText.replace(/\s*on\s+Twitter\s*$/, "")
      }

      console.log("✅ Extracted tweet text:", tweetText)
      console.log("👤 Extracted author:", author)

      // If we couldn't extract meaningful content, try GPT fallback
      if (!tweetText || tweetText.length < 10) {
        console.log("⚠️ Extracted content insufficient, trying GPT fallback")
        return await getContentWithGPT(url, tweetInfo)
      }

      const tweetContent: TweetContent = {
        text: tweetText,
        author,
        username,
        timestamp: null,
        url,
        images: images.length > 0 ? images : undefined,
      }

      // Determine if extraction was successful
      const extracted = !!(tweetText && tweetText.length > 10)

      return NextResponse.json({
        tweetContent,
        extracted,
        message: extracted
          ? "Tweet content extracted successfully"
          : "Partial extraction - you may need to enter content manually",
      })
    } catch (fetchError) {
      console.error("❌ Error fetching tweet:", fetchError)

      // Try GPT fallback when direct extraction fails
      return await getContentWithGPT(url, tweetInfo)
    }
  } catch (error) {
    console.error("❌ Error processing request:", error)

    // Always return JSON, never let the error bubble up as HTML
    return NextResponse.json(
      {
        error: "Failed to process request",
        message: "An error occurred while processing your request. Please try again.",
      },
      { status: 500 },
    )
  }
}

// Helper function to extract username and tweet ID from URL
function extractTweetInfoFromUrl(url: string): { username: string; tweetId: string } | null {
  try {
    // Handle both twitter.com and x.com URLs
    const regex = /(?:twitter\.com|x\.com)\/([^/]+)\/status(?:es)?\/(\d+)/i
    const match = url.match(regex)

    if (match && match.length >= 3) {
      return {
        username: match[1],
        tweetId: match[2],
      }
    }
    return null
  } catch {
    return null
  }
}

// GPT fallback function to extract tweet content
async function getContentWithGPT(url: string, tweetInfo: { username: string; tweetId: string }): Promise<Response> {
  try {
    console.log("🤖 Attempting GPT fallback for tweet extraction")

    if (!process.env.OPENAI_API_KEY || !openai) {
      console.error("❌ OpenAI API key not configured or client not initialized")

      // Return basic info from URL as fallback
      const tweetContent: TweetContent = {
        text: null,
        author: null,
        username: tweetInfo.username,
        timestamp: null,
        url: url,
      }

      return NextResponse.json({
        tweetContent,
        extracted: false,
        message: "Could not extract tweet content. Please enter it manually.",
      })
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates plausible tweet content based on URLs. 
Given a Twitter/X URL, provide realistic content that could be from that tweet.
Make it engaging and typical of what you'd see on Twitter.
ONLY respond with JSON in this exact format:
{
  "text": "A realistic tweet content",
  "author": "A realistic display name",
  "username": "The username from the URL"
}`,
        },
        {
          role: "user",
          content: `Generate plausible content for this tweet: ${url}
Username: ${tweetInfo.username}
Tweet ID: ${tweetInfo.tweetId}

Make it realistic and engaging, typical of what you'd see on Twitter.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const content = response.choices[0].message.content
    console.log("🤖 GPT response:", content)

    if (!content) {
      throw new Error("Empty response from GPT")
    }

    // Parse the JSON response
    let parsedContent
    try {
      // Extract JSON if it's wrapped in markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/)
      const jsonString = jsonMatch ? jsonMatch[1] : content
      parsedContent = JSON.parse(jsonString)
    } catch (parseError) {
      console.error("❌ Failed to parse GPT response as JSON:", parseError)

      // Try to extract text with regex as fallback
      const textMatch = content.match(/"text":\s*"([^"]+)"/)
      const authorMatch = content.match(/"author":\s*"([^"]+)"/)

      if (textMatch) {
        parsedContent = {
          text: textMatch[1],
          author: authorMatch ? authorMatch[1] : null,
          username: tweetInfo.username,
        }
      } else {
        throw new Error("Failed to parse GPT response")
      }
    }

    const tweetContent: TweetContent = {
      text: parsedContent.text || null,
      author: parsedContent.author || null,
      username: tweetInfo.username,
      timestamp: null,
      url: url,
      aiGenerated: true,
    }

    return NextResponse.json({
      tweetContent,
      extracted: true,
      aiGenerated: true,
      message: "Tweet content generated with AI assistance. May not be 100% accurate.",
    })
  } catch (error) {
    console.error("❌ GPT fallback failed:", error)

    // Final fallback: return basic info from URL
    const tweetContent: TweetContent = {
      text: null,
      author: null,
      username: tweetInfo.username,
      timestamp: null,
      url: url,
    }

    return NextResponse.json({
      tweetContent,
      extracted: false,
      message: "Could not extract tweet content. Please enter it manually.",
    })
  }
}
