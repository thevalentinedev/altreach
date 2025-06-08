import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client with error handling
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

// In-memory rate limiter
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW = 5000 // 5 seconds in milliseconds

function getClientId(request: Request): string {
  try {
    const forwarded = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const cfConnectingIp = request.headers.get("cf-connecting-ip")

    const clientIp = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown"
    return clientIp.trim()
  } catch (error) {
    console.error("❌ Error getting client ID:", error)
    return "unknown"
  }
}

function checkRateLimit(clientId: string): { allowed: boolean; timeRemaining?: number } {
  try {
    const now = Date.now()
    const lastRequest = rateLimitMap.get(clientId)

    if (lastRequest) {
      const timeSinceLastRequest = now - lastRequest

      if (timeSinceLastRequest < RATE_LIMIT_WINDOW) {
        const timeRemaining = RATE_LIMIT_WINDOW - timeSinceLastRequest
        return { allowed: false, timeRemaining }
      }
    }

    rateLimitMap.set(clientId, now)

    // Clean up old entries
    for (const [id, timestamp] of rateLimitMap.entries()) {
      if (now - timestamp > 60000) {
        rateLimitMap.delete(id)
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error("❌ Error in rate limit check:", error)
    return { allowed: true } // Allow on error
  }
}

// Enhanced profile context builder with recent posts
function buildEnhancedProfileContext(profileData: ProfileData | null, profileUrl: string): string {
  try {
    if (!profileData) {
      return "LinkedIn professional (no profile data available)"
    }

    const contextParts: string[] = []

    // Add basic info
    if (profileData.name) {
      contextParts.push(`Name: ${profileData.name}`)
    }

    if (profileData.headline) {
      contextParts.push(`Current Role/Headline: ${profileData.headline}`)
    }

    // Add structured data
    if (profileData.company) {
      contextParts.push(`Current Company: ${profileData.company}`)
    }

    if (profileData.education) {
      contextParts.push(`Education: ${profileData.education}`)
    }

    if (profileData.location) {
      contextParts.push(`Location: ${profileData.location}`)
    }

    if (profileData.connections) {
      contextParts.push(`Network Size: ${profileData.connections} connections`)
    }

    // Add recent posts information
    if (profileData.recentPosts && profileData.recentPosts.length > 0) {
      contextParts.push("\nRecent LinkedIn Activity:")
      profileData.recentPosts.slice(0, 2).forEach((post, index) => {
        try {
          const postInfo = `${index + 1}. ${post.date ? `(${post.date}) ` : ""}${post.title}: ${post.snippet.substring(0, 150)}${post.snippet.length > 150 ? "..." : ""}`
          contextParts.push(postInfo)
        } catch (postError) {
          console.error("❌ Error processing post:", postError)
        }
      })
    }

    // Extract username from URL as fallback
    if (contextParts.length === 0) {
      try {
        const urlMatch = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/)
        const username = urlMatch ? urlMatch[1].replace(/-/g, " ") : "LinkedIn user"
        contextParts.push(`LinkedIn Username: ${username}`)
      } catch (urlError) {
        console.error("❌ Error extracting username from URL:", urlError)
        contextParts.push("LinkedIn professional")
      }
    }

    return contextParts.join("\n")
  } catch (error) {
    console.error("❌ Error building profile context:", error)
    return "LinkedIn professional (error building context)"
  }
}

// Parse GPT response in the format "Tone: [tone]\nMessage: [message]"
function parseGPTResponse(content: string): { tone: string; message: string } | null {
  try {
    // Default values in case parsing fails
    let tone = "Professional but warm"
    let message = ""

    // Try to parse as JSON first (in case GPT returns JSON despite instructions)
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.tone && parsed.message) {
          return { tone: parsed.tone, message: parsed.message }
        }
      }
    } catch (jsonError) {
      // Continue with text parsing
    }

    // Parse the expected format: "Tone: [tone]\nMessage: [message]"
    const toneMatch = content.match(/Tone:\s*(.+?)(?:\n|$)/i)
    const messageMatch = content.match(/Message:\s*([\s\S]+?)(?:\n\n|$)/i)

    if (toneMatch) {
      tone = toneMatch[1].trim()
    }

    if (messageMatch) {
      message = messageMatch[1].trim()
    } else {
      // If no message match, try to extract everything after "Message:" line
      const lines = content.split("\n")
      const messageIndex = lines.findIndex((line) => line.toLowerCase().startsWith("message:"))

      if (messageIndex !== -1 && messageIndex < lines.length - 1) {
        message = lines
          .slice(messageIndex + 1)
          .join(" ")
          .trim()
      }
    }

    // If we still don't have a message, try alternative parsing
    if (!message && content) {
      const afterTone = content.replace(/Tone:\s*.+?(?:\n|$)/i, "").trim()
      if (afterTone) {
        message = afterTone.replace(/^Message:\s*/i, "").trim()
      }
    }

    // Ensure we have at least some content
    if (message) {
      return { tone, message }
    }

    return null
  } catch (error) {
    console.error("❌ Error parsing GPT response:", error)
    return null
  }
}

// Generate fallback message
function generateFallbackMessage(
  profileData: ProfileData | null,
  profileUrl: string,
  tone: string,
  existingMessages: string[] = [],
): string {
  try {
    const messageNumber = existingMessages.length + 1
    const name = profileData?.name || "there"
    const company = profileData?.company || profileData?.headline || "your field"
    const education = profileData?.education
    const recentPost = profileData?.recentPosts?.[0]

    if (tone.toLowerCase().includes("professional") || tone.toLowerCase().includes("formal")) {
      const variations = [
        recentPost
          ? `Hi ${name}, I found your recent post about ${recentPost.title.toLowerCase()} insightful. I'd like to connect and learn more about your work at ${company}.`
          : `Hi ${name}, I noticed your work at ${company} and would like to connect to learn more about your experience.`,
        `Hello ${name}, your role at ${company} caught my attention. I'd appreciate connecting with you.`,
        education
          ? `Hi ${name}, fellow ${education} alum here! I'd love to connect and learn about your journey at ${company}.`
          : `Hi ${name}, I'm interested in your work at ${company} and would value the opportunity to connect.`,
      ]
      return variations[(messageNumber - 1) % variations.length]
    } else if (tone.toLowerCase().includes("friendly") || tone.toLowerCase().includes("casual")) {
      const variations = [
        recentPost
          ? `Hi ${name}! Loved your recent thoughts on ${recentPost.title.toLowerCase()}. Your work at ${company} looks fascinating - would love to connect!`
          : `Hi ${name}! Your work at ${company} caught my attention. Would love to connect and learn from your experience.`,
        `Hello ${name}! I'm impressed by your role at ${company}. Hope we can connect!`,
        education
          ? `Hi ${name}! Fellow ${education} grad here! Your work at ${company} looks fascinating. Would be great to connect!`
          : `Hi ${name}! Your expertise at ${company} looks fascinating. Would be great to connect and chat.`,
      ]
      return variations[(messageNumber - 1) % variations.length]
    } else {
      const variations = [
        recentPost
          ? `Hi ${name}, your recent post about ${recentPost.title.toLowerCase()} resonated with me. I'd like to connect and discuss your work at ${company}.`
          : `Hi ${name}, I'd like to connect and learn more about your experience at ${company}.`,
        `Hello ${name}, your background at ${company} interests me. Hope we can connect.`,
        education
          ? `Hi ${name}, as a fellow ${education} graduate, I'm curious about your work at ${company}. Would appreciate connecting.`
          : `Hi ${name}, I'm curious about your work at ${company}. Would appreciate connecting.`,
      ]
      return variations[(messageNumber - 1) % variations.length]
    }
  } catch (error) {
    console.error("❌ Error generating fallback message:", error)
    return "Hi! I'd like to connect with you on LinkedIn. Looking forward to networking!"
  }
}

export async function POST(request: Request) {
  console.log("🔄 Starting connection message generation...")

  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OpenAI API key is not configured")
      return NextResponse.json({ error: "Service configuration error. Please try again later." }, { status: 500 })
    }

    if (!openai) {
      console.error("❌ OpenAI client not initialized")
      return NextResponse.json({ error: "Service initialization error. Please try again later." }, { status: 500 })
    }

    // Parse request body with error handling
    let requestData
    try {
      const body = await request.text()
      console.log("📝 Request body length:", body.length)
      requestData = JSON.parse(body)
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid request format. Please try again." }, { status: 400 })
    }

    const { profileData, useSmartTone = true, manualTone, profileUrl, existingMessages = [] } = requestData

    console.log("📊 Request data:", {
      hasProfileData: !!profileData,
      useSmartTone,
      manualTone,
      hasProfileUrl: !!profileUrl,
      existingMessagesCount: existingMessages.length,
    })

    if (!profileData && !profileUrl) {
      return NextResponse.json({ error: "Profile data or URL is required" }, { status: 400 })
    }

    // Rate limiting check
    const clientId = getClientId(request)
    const rateLimitResult = checkRateLimit(clientId)

    if (!rateLimitResult.allowed) {
      const secondsRemaining = Math.ceil((rateLimitResult.timeRemaining || 0) / 1000)
      return NextResponse.json(
        {
          error: `Please wait a moment before generating another message. Try again in ${secondsRemaining} second${secondsRemaining !== 1 ? "s" : ""}.`,
          rateLimited: true,
          retryAfter: secondsRemaining,
        },
        {
          status: 429,
          headers: {
            "Retry-After": secondsRemaining.toString(),
          },
        },
      )
    }

    // Build enhanced context using all available data including recent posts
    const profileContext = buildEnhancedProfileContext(profileData, profileUrl || "")
    console.log("🔍 Profile context built, length:", profileContext.length)

    // Build context about existing messages to avoid repetition
    let existingMessagesContext = ""
    if (existingMessages.length > 0) {
      existingMessagesContext = `\n\nPrevious messages already generated (create a different approach):\n${existingMessages
        .map((msg: string, index: number) => `${index + 1}. ${msg}`)
        .join("\n")}`
    }

    const systemPrompt = `You are a LinkedIn networking strategist who specializes in writing connection requests that get accepted.

Your expertise includes:
- Analyzing professional profiles to determine optimal communication tone
- Writing natural, human-sounding messages that reference specific details from the person's profile
- Leveraging recent posts and activity to create timely, relevant connection requests
- Avoiding generic, salesy, or AI-generated language
- Crafting messages that are specific and personalized based on actual profile information
- Understanding LinkedIn etiquette and best practices
- Keeping messages concise and under LinkedIn's character limits
- Creating unique variations that don't repeat previous approaches

IMPORTANT: Always use specific details from the profile information provided. Never use placeholder text like "[mention a specific aspect]" or generic phrases. If you don't have enough specific information, focus on what you do know about the person.

When recent posts are available, consider referencing them to show genuine interest in their content and thoughts.

Always provide both tone analysis and message generation that work together harmoniously.`

    let userPrompt = ""

    if (useSmartTone) {
      userPrompt = `Given this LinkedIn profile information:

${profileContext}${existingMessagesContext}

First, suggest the best tone of voice for engaging this person based on their professional background, role, and recent activity (e.g. 'professional but warm', 'casual and curious', 'confident and direct', etc.).

Then, write a short, personalized LinkedIn connection request that:
- Matches that tone perfectly
- References specific details from their actual profile information (role, company, experience, etc.)
- If recent posts are available, consider mentioning or relating to their recent content to show genuine engagement
- Feels human and natural
- Is under 300 characters
- Avoids generic phrases like "I'd love to connect" or "expand my network"
- Uses concrete details rather than placeholder text
- Is distinctly different from any previous messages shown above

Return the output in this exact format:
Tone: [descriptive tone]
Message: [connection message with specific profile references]`
    } else {
      userPrompt = `Given this LinkedIn profile information:

${profileContext}${existingMessagesContext}

Write a short, personalized LinkedIn connection request with a "${manualTone}" tone that:
- Reflects the "${manualTone}" tone perfectly
- References specific details from their actual profile information (role, company, experience, etc.)
- If recent posts are available, consider mentioning or relating to their recent content to show genuine engagement
- Feels human and natural
- Is under 300 characters
- Avoids generic phrases like "I'd love to connect" or "expand my network"
- Uses concrete details rather than placeholder text
- Is distinctly different from any previous messages shown above

Return the output in this exact format:
Tone: ${manualTone}
Message: [connection message with specific profile references]`
    }

    console.log("🤖 Calling OpenAI API...")

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 300,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
      })

      console.log("✅ OpenAI API response received")

      const messageText = response.choices[0]?.message?.content?.trim()

      if (!messageText) {
        console.error("❌ No content returned from OpenAI")
        throw new Error("No content generated from AI")
      }

      console.log("📝 Raw AI response length:", messageText.length)

      // Parse the combined response
      const parsed = parseGPTResponse(messageText)

      if (!parsed) {
        console.warn("⚠️ Failed to parse GPT response, using fallback")
        const fallbackTone = useSmartTone ? "Professional but warm" : manualTone || "Professional but warm"
        const fallbackMessage = generateFallbackMessage(profileData, profileUrl || "", fallbackTone, existingMessages)

        return NextResponse.json({
          message: fallbackMessage,
          characterCount: fallbackMessage.length,
          suggestedTone: fallbackTone,
          truncated: false,
          fallback: true,
        })
      }

      // Clean up the message
      const cleanMessage = parsed.message
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/\n+/g, " ") // Replace newlines with spaces
        .trim()

      console.log("✨ Generated message length:", cleanMessage.length)

      // Check character limit
      if (cleanMessage.length > 300) {
        // Try to truncate at a sentence boundary
        const sentences = cleanMessage.split(/[.!?]+/)
        let truncated = ""

        for (const sentence of sentences) {
          const potential = truncated + (truncated ? ". " : "") + sentence.trim()
          if (potential.length <= 297) {
            truncated = potential
          } else {
            break
          }
        }

        if (truncated && truncated.length > 50) {
          const finalMessage = truncated + (truncated.endsWith(".") ? "" : ".")
          return NextResponse.json({
            message: finalMessage,
            characterCount: finalMessage.length,
            suggestedTone: parsed.tone,
            truncated: true,
          })
        } else {
          // Fallback: hard truncate
          const hardTruncated = cleanMessage.substring(0, 297) + "..."
          return NextResponse.json({
            message: hardTruncated,
            characterCount: 300,
            suggestedTone: parsed.tone,
            truncated: true,
          })
        }
      }

      return NextResponse.json({
        message: cleanMessage,
        characterCount: cleanMessage.length,
        suggestedTone: parsed.tone,
        truncated: false,
      })
    } catch (openaiError) {
      console.error("❌ OpenAI API error:", openaiError)

      // Generate fallback message
      const fallbackTone = useSmartTone ? "Professional but warm" : manualTone || "Professional but warm"
      const fallbackMessage = generateFallbackMessage(profileData, profileUrl || "", fallbackTone, existingMessages)

      return NextResponse.json({
        message: fallbackMessage,
        characterCount: fallbackMessage.length,
        suggestedTone: fallbackTone,
        truncated: false,
        fallback: true,
      })
    }
  } catch (error) {
    console.error("❌ Unexpected error in connection message generation:", error)

    // Always return valid JSON, even for unexpected errors
    try {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: "Failed to parse request data. Please try again." }, { status: 400 })
      }

      // Provide a user-friendly error message
      const errorMessage = "Service temporarily unavailable. Please try again in a moment."

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    } catch (jsonError) {
      console.error("❌ Failed to return JSON error:", jsonError)
      // Last resort: return a plain text error
      return new Response("Internal server error", { status: 500 })
    }
  }
}
