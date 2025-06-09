import { NextResponse } from "next/server"

interface RecentPost {
  title: string
  snippet: string
  link: string
  date?: string
  source: "search"
}

interface ProfileData {
  name: string | null
  headline: string | null
  source: "parsed" | "scraped" | "fallback"
  company?: string
  education?: string
  location?: string
  connections?: string
  recentPosts?: RecentPost[]
  rawData?: {
    ogTitle?: string
    ogDescription?: string
    scrapedElements?: string[]
  }
}

function extractNameFromUrl(url: string): string | null {
  try {
    // Extract username from LinkedIn URL
    const urlMatch = url.match(/linkedin\.com\/in\/([^/?]+)/)
    if (urlMatch) {
      const username = urlMatch[1]
      // Convert username to a readable name (replace hyphens with spaces, capitalize)
      const name = username
        .replace(/-/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
      return name
    }
    return null
  } catch (error) {
    return null
  }
}

function generateFallbackHeadline(name: string | null, url: string): string | null {
  if (!name) return null

  // Generate a generic but professional headline
  const templates = [
    `${name} - LinkedIn Professional`,
    `${name} - Professional at LinkedIn`,
    `${name} - Industry Professional`,
    `${name} - Business Professional`,
  ]

  return templates[0] // Use the first template for consistency
}

// Helper function to search for recent posts
async function searchRecentPosts(name: string, company?: string): Promise<RecentPost[]> {
  try {
    // Use the correct base URL for the API call
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/search-recent-posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personName: name,
        company: company,
      }),
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.posts || []
  } catch (error) {
    console.error("❌ Error searching recent posts:", error)
    return []
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate LinkedIn profile URL
    const linkedinProfileRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?(\?.*)?$/
    if (!linkedinProfileRegex.test(url.trim())) {
      return NextResponse.json({ error: "Invalid LinkedIn profile URL" }, { status: 400 })
    }

    console.log("🔍 Analyzing LinkedIn profile:", url)

    // Skip direct fetching due to LinkedIn's restrictions
    // Instead, create a smart fallback based on URL analysis

    try {
      // Extract name from URL
      const extractedName = extractNameFromUrl(url)
      const fallbackHeadline = generateFallbackHeadline(extractedName, url)

      console.log("📝 Extracted name from URL:", extractedName)

      // Search for recent posts if we have a name
      let recentPosts: RecentPost[] = []
      if (extractedName) {
        try {
          console.log("🔎 Searching for recent posts...")
          recentPosts = await searchRecentPosts(extractedName)
          console.log(`📊 Found ${recentPosts.length} recent posts`)
        } catch (searchError) {
          console.warn("⚠️ Failed to search recent posts:", searchError)
          // Continue without recent posts
        }
      }

      // Create profile data based on URL analysis and search results
      const profileData: ProfileData = {
        name: extractedName,
        headline: fallbackHeadline,
        source: "fallback",
        recentPosts,
        rawData: {
          ogTitle: extractedName ? `${extractedName} | LinkedIn` : null,
          ogDescription: fallbackHeadline,
          scrapedElements: [`URL-based extraction: ${extractedName || "Unknown"}`],
        },
      }

      // Determine if we have enough data for a good experience
      const hasGoodData = extractedName && (recentPosts.length > 0 || fallbackHeadline)

      return NextResponse.json({
        profileData,
        fallback: true,
        message: hasGoodData
          ? `Profile analyzed from URL. ${recentPosts.length > 0 ? `Found ${recentPosts.length} recent posts.` : "AI will generate personalized messages."}`
          : "Profile will be analyzed by AI from the URL.",
        success: true,
      })
    } catch (analysisError) {
      console.error("❌ Error during URL analysis:", analysisError)

      // Final fallback - minimal profile data
      const profileData: ProfileData = {
        name: null,
        headline: null,
        source: "fallback",
        recentPosts: [],
      }

      return NextResponse.json({
        profileData,
        fallback: true,
        message: "Profile will be analyzed by AI from the URL.",
        success: true,
      })
    }
  } catch (error) {
    console.error("❌ Error in profile analysis:", error)

    // Always return a valid fallback response
    const profileData: ProfileData = {
      name: null,
      headline: null,
      source: "fallback",
      recentPosts: [],
    }

    return NextResponse.json({
      profileData,
      fallback: true,
      message: "Profile will be analyzed by AI from the URL.",
      success: true,
    })
  }
}
