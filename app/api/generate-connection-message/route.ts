import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

// In-memory rate limiter (same as comments API)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW = 5000 // 5 seconds in milliseconds

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  const clientIp = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown"
  return clientIp.trim()
}

function checkRateLimit(clientId: string): { allowed: boolean; timeRemaining?: number } {
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
}

// Enhanced profile context builder with recent posts
function buildEnhancedProfileContext(profileData: ProfileData | null, profileUrl: string): string {
  console.log("🔧 Building enhanced profile context...")
  console.log("📊 Profile data received:", JSON.stringify(profileData, null, 2))

  if (!profileData) {
    console.log("❌ No profile data available")
    return "LinkedIn professional (no profile data available)"
  }

  let context = ""
  const contextParts: string[] = []

  // Add basic info
  if (profileData.name) {
    contextParts.push(`Name: ${profileData.name}`)
    console.log("✅ Added name to context:", profileData.name)
  }

  if (profileData.headline) {
    contextParts.push(`Current Role/Headline: ${profileData.headline}`)
    console.log("✅ Added headline to context:", profileData.headline)
  }

  // Add structured data
  if (profileData.company) {
    contextParts.push(`Current Company: ${profileData.company}`)
    console.log("✅ Added company to context:", profileData.company)
  }

  if (profileData.education) {
    contextParts.push(`Education: ${profileData.education}`)
    console.log("✅ Added education to context:", profileData.education)
  }

  if (profileData.location) {
    contextParts.push(`Location: ${profileData.location}`)
    console.log("✅ Added location to context:", profileData.location)
  }

  if (profileData.connections) {
    contextParts.push(`Network Size: ${profileData.connections} connections`)
    console.log("✅ Added connections to context:", profileData.connections)
  }

  // Add recent posts information
  if (profileData.recentPosts && profileData.recentPosts.length > 0) {
    contextParts.push("\nRecent LinkedIn Activity:")
    profileData.recentPosts.slice(0, 2).forEach((post, index) => {
      const postInfo = `${index + 1}. ${post.date ? `(${post.date}) ` : ""}${post.title}: ${post.snippet.substring(0, 150)}${post.snippet.length > 150 ? "..." : ""}`
      contextParts.push(postInfo)
      console.log("✅ Added recent post to context:", post.title.substring(0, 50) + "...")
    })
  }

  // Add raw data insights if available
  if (profileData.rawData) {
    console.log("🔍 Processing raw data...")

    if (profileData.rawData.ogTitle && profileData.rawData.ogTitle !== profileData.name) {
      contextParts.push(`Profile Title: ${profileData.rawData.ogTitle}`)
      console.log("✅ Added OG title to context:", profileData.rawData.ogTitle)
    }

    if (profileData.rawData.ogDescription && profileData.rawData.ogDescription !== profileData.headline) {
      contextParts.push(`Full Profile Description: ${profileData.rawData.ogDescription}`)
      console.log("✅ Added OG description to context:", profileData.rawData.ogDescription)
    }

    // Add scraped elements for more context
    if (profileData.rawData.scrapedElements && profileData.rawData.scrapedElements.length > 0) {
      console.log("🕷️ Adding scraped elements to context...")
      const relevantElements = profileData.rawData.scrapedElements
        .filter(
          (element) =>
            element.includes("About section") ||
            element.includes("Experience") ||
            element.includes("Headline candidate"),
        )
        .slice(0, 3) // Limit to most relevant elements

      if (relevantElements.length > 0) {
        contextParts.push("Additional Profile Information:")
        relevantElements.forEach((element) => {
          contextParts.push(`- ${element}`)
          console.log("✅ Added scraped element:", element.substring(0, 100) + "...")
        })
      }
    }
  }

  // Extract username from URL as fallback
  if (contextParts.length === 0) {
    const urlMatch = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/)
    const username = urlMatch ? urlMatch[1].replace(/-/g, " ") : "LinkedIn user"
    contextParts.push(`LinkedIn Username: ${username}`)
    console.log("⚠️ Using URL fallback:", username)
  }

  context = contextParts.join("\n")
  console.log("🎯 Final profile context:")
  console.log(context)
  console.log("📏 Context length:", context.length)

  return context
}

// Parse GPT response in the format "Tone: [tone]\nMessage: [message]"
function parseGPTResponse(content: string): { tone: string; message: string } | null {
  try {
    // Log the raw response for debugging
    console.log("🤖 Raw GPT response:", content)

    // Default values in case parsing fails
    let tone = "Professional but warm"
    let message = ""

    // Try to parse as JSON first (in case GPT returns JSON despite instructions)
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.tone && parsed.message) {
          console.log("✅ Parsed as JSON:", { tone: parsed.tone, message: parsed.message.substring(0, 100) + "..." })
          return { tone: parsed.tone, message: parsed.message }
        }
      }
    } catch (jsonError) {
      console.log("ℹ️ Not valid JSON, continuing with text parsing")
    }

    // Parse the expected format: "Tone: [tone]\nMessage: [message]"
    const toneMatch = content.match(/Tone:\s*(.+?)(?:\n|$)/i)
    const messageMatch = content.match(/Message:\s*([\s\S]+?)(?:\n\n|$)/i)

    if (toneMatch) {
      tone = toneMatch[1].trim()
      console.log("✅ Extracted tone:", tone)
    }

    if (messageMatch) {
      message = messageMatch[1].trim()
      console.log("✅ Extracted message:", message.substring(0, 100) + "...")
    } else {
      // If no message match, try to extract everything after "Message:" line
      const lines = content.split("\n")
      const messageIndex = lines.findIndex((line) => line.toLowerCase().startsWith("message:"))

      if (messageIndex !== -1 && messageIndex < lines.length - 1) {
        // Skip the message line and join everything else
        message = lines
          .slice(messageIndex + 1)
          .join(" ")
          .trim()
        console.log("✅ Extracted message from lines:", message.substring(0, 100) + "...")
      }
    }

    // If we still don't have a message, try alternative parsing
    if (!message && content) {
      // Look for any text that might be a message (after tone)
      const afterTone = content.replace(/Tone:\s*.+?(?:\n|$)/i, "").trim()
      if (afterTone) {
        message = afterTone.replace(/^Message:\s*/i, "").trim()
        console.log("✅ Extracted message (alternative):", message.substring(0, 100) + "...")
      }
    }

    // Ensure we have at least some content
    if (message) {
      console.log("🎯 Final parsed result:", { tone, messageLength: message.length })
      return { tone, message }
    }

    console.log("❌ No valid message found in response")
    return null
  } catch (error) {
    console.error("❌ Error parsing GPT response:", error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OpenAI API key is not configured")
      return NextResponse.json({ error: "Service configuration error. Please try again later." }, { status: 500 })
    }

    // Parse request body with error handling
    let requestData
    try {
      requestData = await request.json()
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid request format. Please try again." }, { status: 400 })
    }

    console.log("📥 Request data received:", JSON.stringify(requestData, null, 2))

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

    const { profileData, useSmartTone = true, manualTone, profileUrl, existingMessages = [] } = requestData

    if (!profileData && !profileUrl) {
      return NextResponse.json({ error: "Profile data or URL is required" }, { status: 400 })
    }

    // Build enhanced context using all available data including recent posts
    const profileContext = buildEnhancedProfileContext(profileData, profileUrl)

    // Build context about existing messages to avoid repetition
    let existingMessagesContext = ""
    if (existingMessages.length > 0) {
      existingMessagesContext = `\n\nPrevious messages already generated (create a different approach):\n${existingMessages
        .map((msg: string, index: number) => `${index + 1}. ${msg}`)
        .join("\n")}`
      console.log("📝 Added existing messages context:", existingMessagesContext.length, "characters")
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
      // Combined tone detection and message generation
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
      // Use manual tone for message generation
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

    console.log("📤 Sending prompt to GPT:")
    console.log("System:", systemPrompt.substring(0, 200) + "...")
    console.log("User:", userPrompt.substring(0, 300) + "...")

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8, // Balanced creativity for both tone analysis and message generation
        max_tokens: 300, // Increased to accommodate both tone and message
        presence_penalty: 0.6, // Encourage unique content
        frequency_penalty: 0.4, // Reduce repetition
      })

      const messageText = response.choices[0]?.message?.content?.trim()

      if (!messageText) {
        console.error("❌ No content returned from OpenAI")
        return NextResponse.json({ error: "No content generated. Please try again." }, { status: 500 })
      }

      // Parse the combined response
      const parsed = parseGPTResponse(messageText)

      if (!parsed) {
        console.error("❌ Failed to parse GPT response:", messageText)

        // Fallback: use a default tone and the raw content as message
        return NextResponse.json({
          message: messageText.trim().substring(0, 300), // Use the raw content, limited to 300 chars
          characterCount: Math.min(messageText.trim().length, 300),
          suggestedTone: useSmartTone ? "Professional but warm" : manualTone,
          truncated: messageText.trim().length > 300,
          fallback: true,
        })
      }

      // Clean up the message
      const cleanMessage = parsed.message
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/\n+/g, " ") // Replace newlines with spaces
        .trim()

      console.log("🎯 Final message generated:", cleanMessage)
      console.log("📏 Message length:", cleanMessage.length)

      // Check character limit
      if (cleanMessage.length > 300) {
        // Try to truncate at a sentence boundary
        const sentences = cleanMessage.split(/[.!?]+/)
        let truncated = ""

        for (const sentence of sentences) {
          const potential = truncated + (truncated ? ". " : "") + sentence.trim()
          if (potential.length <= 297) {
            // Leave room for "..."
            truncated = potential
          } else {
            break
          }
        }

        if (truncated && truncated.length > 50) {
          const finalMessage = truncated + (truncated.endsWith(".") ? "" : ".")
          console.log("✂️ Truncated message:", finalMessage)
          return NextResponse.json({
            message: finalMessage,
            characterCount: finalMessage.length,
            suggestedTone: parsed.tone,
            truncated: true,
          })
        } else {
          // Fallback: hard truncate
          const hardTruncated = cleanMessage.substring(0, 297) + "..."
          console.log("✂️ Hard truncated message:", hardTruncated)
          return NextResponse.json({
            message: hardTruncated,
            characterCount: 300,
            suggestedTone: parsed.tone,
            truncated: true,
          })
        }
      }

      console.log("✅ Message generation successful")
      return NextResponse.json({
        message: cleanMessage,
        characterCount: cleanMessage.length,
        suggestedTone: parsed.tone,
        truncated: false,
      })
    } catch (openaiError) {
      console.error("❌ OpenAI API error:", openaiError)

      // Enhanced fallback message generation with variation using available data
      let fallbackMessage = ""
      const fallbackTone = useSmartTone ? "Professional but warm" : manualTone
      const messageNumber = existingMessages.length + 1

      // Use available profile data for fallback
      const name = profileData?.name || "there"
      const company = profileData?.company || profileData?.headline || "your field"
      const education = profileData?.education
      const recentPost = profileData?.recentPosts?.[0]

      console.log("🔄 Generating fallback message with:", {
        name,
        company,
        education,
        hasRecentPost: !!recentPost,
        tone: fallbackTone,
      })

      if (fallbackTone.toLowerCase().includes("professional") || fallbackTone.toLowerCase().includes("formal")) {
        const variations = [
          recentPost
            ? `Hi ${name}, I found your recent post about ${recentPost.title.toLowerCase()} insightful. I'd like to connect and learn more about your work at ${company}.`
            : `Hi ${name}, I noticed your work at ${company} and would like to connect to learn more about your experience.`,
          `Hello ${name}, your role at ${company} caught my attention. I'd appreciate connecting with you.`,
          education
            ? `Hi ${name}, fellow ${education} alum here! I'd love to connect and learn about your journey at ${company}.`
            : `Hi ${name}, I'm interested in your work at ${company} and would value the opportunity to connect.`,
        ]
        fallbackMessage = variations[(messageNumber - 1) % variations.length]
      } else if (fallbackTone.toLowerCase().includes("friendly") || fallbackTone.toLowerCase().includes("casual")) {
        const variations = [
          recentPost
            ? `Hi ${name}! Loved your recent thoughts on ${recentPost.title.toLowerCase()}. Your work at ${company} looks fascinating - would love to connect!`
            : `Hi ${name}! Your work at ${company} caught my attention. Would love to connect and learn from your experience.`,
          `Hello ${name}! I'm impressed by your role at ${company}. Hope we can connect!`,
          education
            ? `Hi ${name}! Fellow ${education} grad here! Your work at ${company} looks fascinating. Would be great to connect!`
            : `Hi ${name}! Your expertise at ${company} looks fascinating. Would be great to connect and chat.`,
        ]
        fallbackMessage = variations[(messageNumber - 1) % variations.length]
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
        fallbackMessage = variations[(messageNumber - 1) % variations.length]
      }

      console.log("🔄 Fallback message generated:", fallbackMessage)

      return NextResponse.json({
        message: fallbackMessage,
        characterCount: fallbackMessage.length,
        suggestedTone: fallbackTone,
        truncated: false,
        fallback: true,
      })
    }
  } catch (error) {
    console.error("❌ Error generating connection message:", error)

    // Always return valid JSON, even for unexpected errors
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse request data. Please try again." }, { status: 400 })
    }

    return NextResponse.json({ error: "Couldn't generate message. Please try again." }, { status: 500 })
  }
}
