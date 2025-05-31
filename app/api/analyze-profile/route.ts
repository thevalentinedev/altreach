import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

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

function extractNameFromTitle(title: string): string | null {
  if (!title) return null

  // Remove common LinkedIn suffixes
  const cleanTitle = title
    .replace(/\s*\|\s*LinkedIn$/i, "")
    .replace(/\s*on LinkedIn$/i, "")
    .replace(/\s*-\s*LinkedIn$/i, "")

  // Extract name before first | or -
  const nameMatch = cleanTitle.match(/^([^|-]+)/)
  if (nameMatch) {
    const extractedName = nameMatch[1].trim()
    return extractedName
  }

  const fallbackName = cleanTitle.trim() || null
  return fallbackName
}

function extractHeadlineFromDescription(description: string): string | null {
  if (!description) return null

  // Clean up common LinkedIn description patterns
  let cleanDescription = description
    .replace(/^View\s+[^'s]+['']s\s+profile\s+on\s+LinkedIn[.,]?\s*/i, "")
    .replace(/\s*on\s+LinkedIn[.,]?\s*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .replace(/^LinkedIn\s*[-|]\s*/i, "")
    .replace(/,\s*a\s+professional\s+community\s+of\s+[\d\w\s]+members\.?$/i, "")
    .trim()

  // Enhanced parsing for LinkedIn's structured format
  // Pattern: "Name is a [role/description] · Experience: Company · Education: School · Location: Place"

  // Extract the main professional description (everything before first ·)
  const mainDescMatch = cleanDescription.match(/^[^·]+?is\s+an?\s+([^·]+?)(?:\s*·|$)/i)
  if (mainDescMatch) {
    const headline = mainDescMatch[1].trim()
    return headline
  }

  // Try to extract experience information
  const experienceMatch = cleanDescription.match(/Experience:\s*([^·]+)/i)
  if (experienceMatch) {
    const experience = experienceMatch[1].trim()
    return `Professional at ${experience}`
  }

  // Try to extract from education if no experience
  const educationMatch = cleanDescription.match(/Education:\s*([^·]+)/i)
  if (educationMatch) {
    const education = educationMatch[1].trim()
    return `Graduate from ${education}`
  }

  // Fallback to original logic for other formats
  if (cleanDescription.endsWith(" is a") || cleanDescription.endsWith(" is an") || cleanDescription.endsWith(" is")) {
    return null
  }

  // If it's too long, try to extract the first complete sentence
  if (cleanDescription.length > 200) {
    const sentences = cleanDescription.split(/[.!?]+/)
    if (sentences.length > 0 && sentences[0].length > 20) {
      cleanDescription = sentences[0].trim()
    } else {
      const words = cleanDescription.split(" ")
      let truncated = ""
      for (const word of words) {
        if ((truncated + " " + word).length <= 180) {
          truncated += (truncated ? " " : "") + word
        } else {
          break
        }
      }
      cleanDescription = truncated + (truncated.length < cleanDescription.length ? "..." : "")
    }
  }

  if (cleanDescription.length < 10 || cleanDescription.match(/\b\w{1,2}\s*$/)) {
    return null
  }

  return cleanDescription || null
}

function extractStructuredData(description: string): {
  company?: string
  education?: string
  location?: string
  connections?: string
} {
  const data: any = {}

  if (!description) return data

  // Extract company/experience
  const experienceMatch = description.match(/Experience:\s*([^·]+)/i)
  if (experienceMatch) {
    data.company = experienceMatch[1].trim()
  }

  // Extract education
  const educationMatch = description.match(/Education:\s*([^·]+)/i)
  if (educationMatch) {
    data.education = educationMatch[1].trim()
  }

  // Extract location
  const locationMatch = description.match(/Location:\s*([^·]+)/i)
  if (locationMatch) {
    data.location = locationMatch[1].trim()
  }

  // Extract connections
  const connectionsMatch = description.match(/(\d+\+?)\s+connections/i)
  if (connectionsMatch) {
    data.connections = connectionsMatch[1]
  }

  return data
}

function scrapeFallbackContent($: cheerio.CheerioAPI): {
  name: string | null
  headline: string | null
  scrapedElements: string[]
} {
  let name: string | null = null
  let headline: string | null = null
  const scrapedElements: string[] = []

  // Try to find name from various selectors
  const nameSelectors = [
    "h1",
    ".top-card-layout__title",
    ".pv-text-details__left-panel h1",
    ".text-heading-xlarge",
    "[data-generated-suggestion-target]",
    ".profile-photo-edit__preview",
    ".pv-top-card--list li:first-child",
    ".artdeco-entity-lockup__title",
  ]

  for (const selector of nameSelectors) {
    const element = $(selector).first()
    if (element.length) {
      const text = element.text().trim()
      scrapedElements.push(`Name candidate (${selector}): ${text}`)
      if (text && text.length > 2 && text.length < 100 && !name) {
        name = text
      }
    }
  }

  // Try to find headline from various selectors
  const headlineSelectors = [
    ".top-card-layout__headline",
    ".pv-text-details__left-panel .text-body-medium",
    ".text-body-medium.break-words",
    ".pv-top-card--list-bullet li",
    ".pv-top-card-v2-ctas .pv-text-details__left-panel .text-body-medium",
    ".pv-top-card .pv-entity__summary",
    "h2.top-card-layout__headline",
    ".profile-section-card .pv-entity__summary",
    "[data-generated-suggestion-target] + .text-body-medium",
    ".artdeco-entity-lockup__subtitle",
    ".pv-top-card--list li:nth-child(2)",
    ".pv-entity__summary",
  ]

  for (const selector of headlineSelectors) {
    const element = $(selector).first()
    if (element.length) {
      const text = element.text().trim()
      scrapedElements.push(`Headline candidate (${selector}): ${text}`)
      if (text && text.length > 5 && text.length < 300 && !headline) {
        headline = text
      }
    }
  }

  // Try to extract additional context from about section
  const aboutSelectors = [
    ".pv-about-section .pv-about__summary-text",
    ".about-section .pv-about__summary-text",
    "[data-section='summary'] .pv-about__summary-text",
    ".pv-oc .pv-about__summary-text",
  ]

  for (const selector of aboutSelectors) {
    const element = $(selector).first()
    if (element.length) {
      const text = $(element).text().trim()
      if (text && text.length > 20) {
        scrapedElements.push(`About section: ${text.substring(0, 300)}`)
      }
    }
  }

  // Try to extract experience/current role
  const experienceSelectors = [
    ".pv-entity__summary",
    ".pv-entity__position-group-pager .pv-entity__summary",
    ".experience-section .pv-entity__summary",
    ".pv-profile-section__card-item .pv-entity__summary",
  ]

  for (const selector of experienceSelectors) {
    const elements = $(selector).slice(0, 3) // Get first 3 experience items
    elements.each((i, el) => {
      const text = $(el).text().trim()
      if (text && text.length > 10) {
        scrapedElements.push(`Experience ${i + 1}: ${text.substring(0, 200)}`)
      }
    })
  }

  // If we found a name but no headline, try to extract from the first paragraph
  if (name && !headline) {
    const paragraphs = $("p").toArray()
    for (const p of paragraphs) {
      const text = $(p).text().trim()
      if (text.length > 10 && text.length < 200) {
        scrapedElements.push(`Paragraph: ${text}`)
        if (!headline) {
          headline = text
        }
      }
    }
  }

  return { name, headline, scrapedElements }
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

    try {
      // Fetch the HTML content
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`)
      }

      const html = await response.text()

      const $ = cheerio.load(html)

      // Step 1: Try to parse Open Graph tags
      const ogTitle =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="og:title"]').attr("content") ||
        $("title").text().trim()

      const ogDescription =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content")

      if (ogTitle || ogDescription) {
        const name = extractNameFromTitle(ogTitle || "")
        const headline = extractHeadlineFromDescription(ogDescription || "")
        const structuredData = extractStructuredData(ogDescription || "")

        if (name || headline || structuredData.company) {
          // Search for recent posts if we have a name
          let recentPosts: RecentPost[] = []
          if (name) {
            recentPosts = await searchRecentPosts(name, structuredData.company)
          }

          const profileData: ProfileData = {
            name,
            headline,
            source: "parsed",
            ...structuredData,
            recentPosts,
            rawData: {
              ogTitle,
              ogDescription,
            },
          }

          return NextResponse.json({ profileData })
        }
      }

      // Step 2: Scrape fallback
      const scrapedData = scrapeFallbackContent($)

      if (scrapedData.name || scrapedData.headline) {
        // Search for recent posts if we have a name
        let recentPosts: RecentPost[] = []
        if (scrapedData.name) {
          recentPosts = await searchRecentPosts(scrapedData.name)
        }

        const profileData: ProfileData = {
          name: scrapedData.name,
          headline: scrapedData.headline,
          source: "scraped",
          recentPosts,
          rawData: {
            ogTitle,
            ogDescription,
            scrapedElements: scrapedData.scrapedElements,
          },
        }

        return NextResponse.json({ profileData })
      }

      // Step 3: Fallback to GPT inference
      const profileData: ProfileData = {
        name: null,
        headline: null,
        source: "fallback",
        recentPosts: [],
        rawData: {
          ogTitle,
          ogDescription,
          scrapedElements: scrapedData.scrapedElements,
        },
      }

      return NextResponse.json({
        profileData,
        fallback: true,
        message: "Profile content could not be extracted. AI will infer from URL.",
      })
    } catch (fetchError) {
      console.error("❌ Error fetching profile:", fetchError)

      // Return fallback response
      const profileData: ProfileData = {
        name: null,
        headline: null,
        source: "fallback",
        recentPosts: [],
      }

      return NextResponse.json({
        profileData,
        fallback: true,
        message: "Unable to access profile. AI will infer from URL.",
      })
    }
  } catch (error) {
    console.error("❌ Error analyzing profile:", error)

    return NextResponse.json({ error: "Failed to analyze profile. Please try again." }, { status: 500 })
  }
}
