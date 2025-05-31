import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface PostContent {
  title: string | null
  description: string | null
  image: string | null
  type: string | null
  url: string
  fallbackContent?: string | null
}

// In-memory rate limiter
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW = 3000 // 3 seconds in milliseconds

// Helper function to get client identifier (IP address)
function getClientId(request: Request): string {
  // Try to get real IP from various headers (for production with proxies)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  // Use the first available IP, fallback to a default
  const clientIp = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown"

  return clientIp.trim()
}

// Rate limiting function
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

  // Update the timestamp for this client
  rateLimitMap.set(clientId, now)

  // Clean up old entries (older than 1 minute) to prevent memory leaks
  for (const [id, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > 60000) {
      // 1 minute
      rateLimitMap.delete(id)
    }
  }

  return { allowed: true }
}

// Helper function to determine which model to use
// This can be extended later for premium users
function getModelForUser(isPremium = false): string {
  return isPremium ? "gpt-4" : "gpt-3.5-turbo"
}

// Smart text summarization function
function summarizeText(text: string, maxLength = 500): string {
  if (!text || text.length <= maxLength) {
    return text
  }

  // Remove extra whitespace and normalize
  const cleanText = text.replace(/\s+/g, " ").trim()

  if (cleanText.length <= maxLength) {
    return cleanText
  }

  // Try to find a natural break point (sentence ending)
  const sentences = cleanText.split(/[.!?]+/)
  let summary = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const potentialSummary = summary + (summary ? ". " : "") + trimmedSentence

    if (potentialSummary.length <= maxLength - 3) {
      // Leave room for "..."
      summary = potentialSummary
    } else {
      break
    }
  }

  // If we got at least one complete sentence, use it
  if (summary && summary.length > 50) {
    return summary + (summary.endsWith(".") ? "" : ".")
  }

  // Fallback: smart truncation at word boundary
  const words = cleanText.split(" ")
  let truncated = ""

  for (const word of words) {
    const potential = truncated + (truncated ? " " : "") + word
    if (potential.length <= maxLength - 3) {
      truncated = potential
    } else {
      break
    }
  }

  return truncated + "..."
}

// Process and optimize post content for GPT
function processPostContent(postContent: PostContent | null): string {
  if (!postContent) {
    return "No specific post content available - generate versatile comments"
  }

  const contentParts = []

  // Process title (keep shorter titles as-is, summarize longer ones)
  if (postContent.title) {
    const title = postContent.title.length > 100 ? summarizeText(postContent.title, 100) : postContent.title
    contentParts.push(`Title: ${title}`)
  }

  // Process description (prioritize this as main content)
  if (postContent.description) {
    const description =
      postContent.description.length > 300 ? summarizeText(postContent.description, 300) : postContent.description
    contentParts.push(`Description: ${description}`)
  }

  // Process fallback content only if no description exists
  if (postContent.fallbackContent && !postContent.description) {
    const fallback =
      postContent.fallbackContent.length > 300
        ? summarizeText(postContent.fallbackContent, 300)
        : postContent.fallbackContent
    contentParts.push(`Content: ${fallback}`)
  }

  const combinedContent = contentParts.join("\n")

  // Final check: if combined content is still too long, summarize further
  if (combinedContent.length > 500) {
    return summarizeText(combinedContent, 500)
  }

  return combinedContent || "No specific post content available - generate versatile comments"
}

// Parse GPT response in the format "Tone: [tone]\nComment: [comment]"
function parseGPTResponse(content: string): { tone: string; comment: string } | null {
  try {
    // Default values in case parsing fails
    let tone = "Conversational"
    let comment = ""

    // Try to parse as JSON first (in case GPT returns JSON despite instructions)
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.tone && parsed.comment) {
          return { tone: parsed.tone, comment: parsed.comment }
        }
      }
    } catch (jsonError) {
      // No console log here
    }

    // Parse the expected format: "Tone: [tone]\nComment: [comment]"
    const toneMatch = content.match(/Tone:\s*(.+?)(?:\n|$)/i)
    const commentMatch = content.match(/Comment:\s*([\s\S]+?)(?:\n\n|$)/i)

    if (toneMatch) {
      tone = toneMatch[1].trim()
    }

    if (commentMatch) {
      comment = commentMatch[1].trim()
    } else {
      // If no comment match, try to extract everything after "Tone:" line
      const lines = content.split("\n")
      const toneIndex = lines.findIndex((line) => line.toLowerCase().startsWith("tone:"))

      if (toneIndex !== -1 && toneIndex < lines.length - 1) {
        // Skip the tone line and join everything else
        comment = lines
          .slice(toneIndex + 1)
          .join(" ")
          .replace(/^comment:/i, "")
          .trim()
      }
    }

    // If we still don't have a comment, use the whole content as a comment
    if (!comment && content) {
      comment = content.trim()
    }

    // Ensure we have at least some content
    if (comment) {
      return { tone, comment }
    }

    return null
  } catch (error) {
    console.error("Error parsing GPT response:", error)
    return null
  }
}

// Update the POST function to accept the new parameters
export async function POST(request: Request) {
  try {
    // Rate limiting check - BEFORE any processing
    const clientId = getClientId(request)
    const rateLimitResult = checkRateLimit(clientId)

    if (!rateLimitResult.allowed) {
      const secondsRemaining = Math.ceil((rateLimitResult.timeRemaining || 0) / 1000)
      return NextResponse.json(
        {
          error: `Please wait a moment before generating another comment. Try again in ${secondsRemaining} second${secondsRemaining !== 1 ? "s" : ""}.`,
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

    const {
      platform,
      url,
      postContent,
      existingComments = [],
      useSmartTone = true,
      selectedTone,
    } = await request.json()

    if (!platform) {
      return NextResponse.json({ error: "Missing required parameter: platform" }, { status: 400 })
    }

    // Process and optimize post content for token efficiency
    const optimizedPostContent = processPostContent(postContent)

    // Platform-specific guidelines
    const platformGuidelines: Record<string, string> = {
      Twitter:
        "Keep comments punchy and under 280 characters. Use relevant emojis sparingly. Focus on wit, insights, or questions that spark replies.",
      LinkedIn:
        "Write thoughtful, professional comments that add value. Aim for 1-3 sentences that show expertise or ask meaningful questions.",
      Instagram:
        "Be friendly, authentic, and engaging. Use emojis naturally. Focus on building community and encouraging interaction.",
    }

    // Build context about existing comments to avoid repetition
    let existingCommentsContext = ""
    if (existingComments.length > 0) {
      existingCommentsContext = `\n\nPrevious comments already generated (avoid repeating these approaches):\n${existingComments
        .map((comment: string, index: number) => `${index + 1}. ${comment}`)
        .join("\n")}`
    }

    // Create the combined system prompt
    const systemPrompt = `You are a social media strategist and engagement expert who specializes in creating high-engagement comments.

Your expertise includes:
- Understanding platform-specific cultures and best practices
- Analyzing post content to determine optimal engagement tone
- Crafting comments that drive replies, not just likes
- Writing authentically to avoid generic AI-sounding responses

Platform guidelines for ${platform}:
${platformGuidelines[platform] || "Focus on authentic engagement and value-adding comments."}

Always prioritize genuine human connection over generic responses.`

    // Create the user prompt based on whether smart tone is enabled or not
    let userPrompt = ""

    if (useSmartTone) {
      // Original prompt for AI to determine tone
      userPrompt = `A user wants to leave a high-quality comment on the following ${platform} post:

---
${optimizedPostContent}
---${existingCommentsContext}

First, determine the most effective tone of voice to use for engaging with this post (e.g. confident, witty, curious, bold, humble, supportive, etc.).

Then, based on that tone, generate 1 comment that:
- Feels human and authentic
- Matches ${platform}'s style and culture
- Maximizes engagement and visibility
- Has a natural tone (not generic or robotic)
- Is distinctly different from any previous comments shown above

Return the result in this exact format:
Tone: [descriptive tone]
Comment: [full comment]

Focus on creating a unique, high-quality comment that encourages meaningful interaction.`
    } else {
      // Modified prompt for user-selected tone
      userPrompt = `A user wants to leave a high-quality comment with a ${selectedTone} tone on the following ${platform} post:

---
${optimizedPostContent}
---${existingCommentsContext}

Generate 1 comment that:
- Uses a ${selectedTone} tone of voice
- Feels human and authentic
- Matches ${platform}'s style and culture
- Maximizes engagement and visibility
- Has a natural tone (not generic or robotic)
- Is distinctly different from any previous comments shown above

Return the result in this exact format:
Tone: ${selectedTone}
Comment: [full comment]

Focus on creating a unique, high-quality comment with a ${selectedTone} tone that encourages meaningful interaction.`
    }

    try {
      // Call OpenAI API with combined prompt
      const response = await openai.chat.completions.create({
        model: getModelForUser(), // Uses gpt-3.5-turbo by default, can be upgraded for premium users
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8, // Balanced creativity for both tone analysis and comment generation
        max_tokens: 400, // Increased slightly to accommodate both tone and comment
        presence_penalty: 0.4, // Higher penalty to encourage unique content
        frequency_penalty: 0.4, // Higher penalty to reduce repetition
      })

      // Extract and parse the response
      const content = response.choices[0].message.content

      if (!content) {
        throw new Error("No content returned from OpenAI")
      }

      // Parse the combined response
      const parsed = parseGPTResponse(content)

      if (!parsed) {
        console.error("Failed to parse GPT response:", content)

        // Fallback: use a default tone and the raw content as comment
        return NextResponse.json({
          comment: {
            text: content.trim().substring(0, 500), // Use the raw content, limited to 500 chars
            isRecommended: true,
          },
          toneAnalysis: {
            recommendedTone: useSmartTone ? "Conversational" : selectedTone,
            reasoning: useSmartTone ? "Default tone used due to parsing issue" : "User-selected tone",
          },
          metadata: {
            platform: platform,
            hasPostContent: !!postContent,
            parsingFallback: true,
            combinedGeneration: true,
            manualTone: !useSmartTone,
          },
        })
      }

      // Ensure we have a valid comment
      if (!parsed.comment || parsed.comment.trim().length < 5) {
        throw new Error("Generated comment is too short or empty")
      }

      // If manual tone is selected, override the parsed tone
      const finalTone = !useSmartTone ? selectedTone : parsed.tone || "Conversational"
      const toneReasoning = !useSmartTone ? "User-selected tone" : "AI-determined optimal tone for this post"

      return NextResponse.json({
        comment: {
          text: parsed.comment,
          isRecommended: true, // Single comments are always "recommended"
        },
        toneAnalysis: {
          recommendedTone: finalTone,
          reasoning: toneReasoning,
        },
        metadata: {
          platform: platform,
          hasPostContent: !!postContent,
          contentOptimized: postContent
            ? optimizedPostContent.length <
              (postContent.title?.length || 0) +
                (postContent.description?.length || 0) +
                (postContent.fallbackContent?.length || 0)
            : false,
          isAdditional: existingComments.length > 0,
          combinedGeneration: true, // Flag to indicate this was a combined call
          manualTone: !useSmartTone,
        },
      })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)

      // Return a friendly error message
      return NextResponse.json(
        {
          error: "Failed to generate comment. Our AI service is experiencing issues. Please try again shortly.",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating comment:", error)

    // Provide specific error messages
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Failed to parse request data. Please try again." }, { status: 400 })
    }

    // Always return valid JSON
    return NextResponse.json({ error: "Comment generation failed. Please try again." }, { status: 500 })
  }
}
