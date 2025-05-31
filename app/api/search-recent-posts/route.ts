import { NextResponse } from "next/server"

interface RecentPost {
  title: string
  snippet: string
  link: string
  date?: string
  source: "search"
}

interface SearchResult {
  posts: RecentPost[]
  searchQuery: string
  totalResults: number
}

// Helper function to clean and extract meaningful content from search results
function cleanSearchSnippet(snippet: string): string {
  return snippet
    .replace(/\s+/g, " ")
    .replace(/\.\.\./g, "")
    .replace(/^\d+\s*(days?|weeks?|months?)\s*ago\s*·?\s*/i, "")
    .replace(/^Posted\s*on\s*LinkedIn\s*·?\s*/i, "")
    .replace(/\s*·\s*LinkedIn\s*$/i, "")
    .trim()
}

// Helper function to extract date information from snippets
function extractDateFromSnippet(snippet: string): string | undefined {
  const dateMatch = snippet.match(/(\d+)\s*(days?|weeks?|months?)\s*ago/i)
  if (dateMatch) {
    return `${dateMatch[1]} ${dateMatch[2]} ago`
  }
  return undefined
}

// Real search implementation using Google Custom Search API
async function searchLinkedInPosts(personName: string, company?: string): Promise<SearchResult> {
  const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY
  const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX

  console.log("🔍 Searching for recent posts by:", personName, company ? `at ${company}` : "")

  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    console.error("❌ Google Search API not configured")
    throw new Error("Search service not configured")
  }

  // Build search query
  let searchQuery = `site:linkedin.com "${personName}"`
  if (company) {
    searchQuery += ` "${company}"`
  }
  searchQuery += " (posts OR activity OR shared OR published) -profile -about"

  console.log("🔍 Search query:", searchQuery)

  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(searchQuery)}&num=5&sort=date`

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AltreachBot/1.0)",
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ Google Search API error:", data.error)
      throw new Error(`Search API error: ${data.error?.message || response.statusText}`)
    }

    console.log("📊 Search API response:", {
      totalResults: data.searchInformation?.totalResults || 0,
      itemsFound: data.items?.length || 0,
    })

    const posts: RecentPost[] = (data.items || [])
      .map((item: any) => {
        const cleanSnippet = cleanSearchSnippet(item.snippet || "")
        const extractedDate = extractDateFromSnippet(item.snippet || "")

        console.log("📝 Processing search result:", {
          title: item.title?.substring(0, 50) + "...",
          snippet: cleanSnippet.substring(0, 100) + "...",
          date: extractedDate,
        })

        return {
          title: item.title || "",
          snippet: cleanSnippet,
          link: item.link || "",
          date: extractedDate,
          source: "search" as const,
        }
      })
      .filter((post) => {
        // Filter out profile pages and non-post content
        const isProfilePage = post.link.includes("/in/") && !post.link.includes("/posts/")
        const isActivityPage = post.link.includes("/activity") || post.link.includes("/posts/")
        const hasContent = post.snippet.length > 20

        return !isProfilePage && hasContent && (isActivityPage || post.title.toLowerCase().includes("post"))
      })

    console.log("✅ Filtered posts:", posts.length)

    return {
      posts: posts.slice(0, 3), // Limit to 3 most relevant posts
      searchQuery,
      totalResults: Number.parseInt(data.searchInformation?.totalResults || "0"),
    }
  } catch (error) {
    console.error("❌ Search API error:", error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const { personName, company, profileUrl } = await request.json()

    console.log("🚀 Starting recent posts search for:", { personName, company })

    if (!personName) {
      return NextResponse.json({ error: "Person name is required" }, { status: 400 })
    }

    try {
      // Search for recent posts
      const searchResult = await searchLinkedInPosts(personName, company)

      console.log("✅ Found posts:", searchResult.posts.length)
      searchResult.posts.forEach((post, index) => {
        console.log(`📝 Post ${index + 1}:`, post.title.substring(0, 50) + "...")
      })

      return NextResponse.json({
        success: true,
        ...searchResult,
        message:
          searchResult.posts.length > 0 ? `Found ${searchResult.posts.length} recent posts` : "No recent posts found",
      })
    } catch (searchError) {
      console.error("❌ Search error:", searchError)

      // Return empty results with more specific error info
      return NextResponse.json({
        success: true,
        posts: [],
        searchQuery: `"${personName}" posts`,
        totalResults: 0,
        message:
          searchError instanceof Error
            ? `Search temporarily unavailable: ${searchError.message}`
            : "Could not search for recent posts at this time",
        fallback: true,
      })
    }
  } catch (error) {
    console.error("❌ Error searching recent posts:", error)
    return NextResponse.json({ error: "Failed to search recent posts" }, { status: 500 })
  }
}
