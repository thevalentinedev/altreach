import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// In-memory rate limiter
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW = 3000 // 3 seconds in milliseconds

// Helper function to get client identifier (IP address)
function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")
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

  rateLimitMap.set(clientId, now)

  // Clean up old entries to prevent memory leaks
  for (const [id, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > 60000) {
      rateLimitMap.delete(id)
    }
  }

  return { allowed: true }
}

interface GenerateCommentsRequest {
  tweetContent: {
    text: string
    author?: string | null
    username?: string | null
    images?: string[] // Add images array
  }
  tone: string
  length: "shorter" | "longer"
  useEmoji: boolean
  variations: number
  instructions?: string
}

interface GeneratedComment {
  text: string
  isRecommended: boolean
}

// Helper function to determine the appropriate model based on content complexity
function determineOptimalModel(text: string, isComplexRequest: boolean, hasImages = false): string {
  // Always use GPT-4o for image analysis
  if (hasImages) {
    console.log("Using GPT-4o for image analysis")
    return "gpt-4o"
  }

  // Default to GPT-3.5-turbo for most requests
  let model = "gpt-3.5-turbo-1106"

  // Check for complexity indicators
  const isComplex =
    isComplexRequest ||
    text.length > 500 ||
    text.includes("code") ||
    text.includes("technical") ||
    /\b(analyze|analyse|explain|compare|contrast)\b/i.test(text)

  if (isComplex) {
    model = "gpt-4o" // Use more capable model for complex requests
    console.log("Using GPT-4o for complex request")
  } else {
    console.log("Using GPT-3.5-turbo for standard request")
  }

  return model
}

export async function POST(request: Request) {
  try {
    // Rate limiting check (keep existing code)
    const clientId = getClientId(request)
    const rateLimitResult = checkRateLimit(clientId)

    if (!rateLimitResult.allowed) {
      const secondsRemaining = Math.ceil((rateLimitResult.timeRemaining || 0) / 1000)
      return NextResponse.json(
        {
          error: `Please wait a moment before generating another comment. Try again in ${secondsRemaining} second${
            secondsRemaining !== 1 ? "s" : ""
          }.`,
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

    const requestData: GenerateCommentsRequest = await request.json()
    const { tweetContent, tone, length, useEmoji, variations, instructions } = requestData

    if (!tweetContent || !tweetContent.text) {
      return NextResponse.json({ error: "Tweet content is required" }, { status: 400 })
    }

    // Validate variations
    const numVariations = variations || 3
    if (numVariations < 1 || numVariations > 5) {
      return NextResponse.json({ error: "Number of variations must be between 1 and 5" }, { status: 400 })
    }

    try {
      // Check if we have images
      const hasImages = tweetContent.images && tweetContent.images.length > 0

      // Build the system prompt
      const systemPrompt = `You are a social media copywriter specializing in Twitter/X replies. 
Given a tweet${hasImages ? " with images" : ""}, first analyze its content to determine the most appropriate tone for a reply, then generate ${numVariations} comment variation${
        numVariations > 1 ? "s" : ""
      } using that tone (unless a specific tone is requested).

${tone ? `The requested tone is: ${tone}` : "Determine the optimal tone based on the tweet content."}

Guidelines:
- ${tone ? `Use the requested ${tone} tone` : "First determine the optimal tone, then use it consistently"}
- Keep replies ${length === "shorter" ? "concise (under 140 characters)" : "more detailed (140-280 characters)"}
- ${useEmoji ? "Include relevant emojis naturally" : "Do not use emojis"}
- Make each variation distinct and engaging
- Focus on driving conversation and engagement
- Sound authentic and human, not generic or AI-generated
- Avoid generic phrases like "Great post!" or "Thanks for sharing!"
- Respond directly to the content of the tweet
${hasImages ? "- Consider the visual content in the images when crafting your response" : ""}

${instructions ? `Additional instructions: ${instructions}` : ""}

Return your response as a JSON object with the following structure:
{
  "detectedTone": "brief description of the detected tone (only if no tone was specified)",
  "comments": ["First comment variation", "Second comment variation", "Third comment variation"]
}
`

      // Create the user prompt with the tweet content
      const userPrompt = `Tweet${tweetContent.author ? ` by ${tweetContent.author}` : ""}:
"${tweetContent.text.substring(0, 280)}${tweetContent.text.length > 280 ? "..." : ""}"

${tone ? `Generate ${numVariations} ${tone} reply variation${numVariations > 1 ? "s" : ""}.` : `Determine the best tone for replying, then generate ${numVariations} reply variation${numVariations > 1 ? "s" : ""} using that tone.`}`

      // Determine if this is a complex request
      const isComplexRequest =
        !!instructions &&
        (instructions.length > 100 || instructions.includes("technical") || instructions.includes("analyze"))

      // Determine the optimal model
      const modelToUse = determineOptimalModel(tweetContent.text, isComplexRequest, hasImages)

      // Create messages array - handle images if present
      const messages: any[] = [{ role: "system", content: systemPrompt }]

      if (hasImages && tweetContent.images) {
        // Create vision message with images
        const imageContent = tweetContent.images.map((imageUrl) => ({
          type: "image_url",
          image_url: {
            url: imageUrl,
            detail: "low", // Use low detail for faster processing and lower cost
          },
        }))

        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            ...imageContent,
          ],
        })
      } else {
        // Text-only message
        messages.push({
          role: "user",
          content: userPrompt,
        })
      }

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: modelToUse,
        messages: messages,
        temperature: 0.8,
        response_format: { type: "json_object" },
        max_tokens: 1000,
      })

      const content = response.choices[0].message.content

      if (!content) {
        throw new Error("No content returned from OpenAI")
      }

      // Parse the JSON response (keep existing parsing logic)
      let comments: string[] = []
      let detectedTone: string | null = null
      try {
        const parsedResponse = JSON.parse(content)

        // Extract detected tone if available
        if (parsedResponse.detectedTone && !tone) {
          detectedTone = parsedResponse.detectedTone
        }

        // Handle different possible JSON structures
        if (Array.isArray(parsedResponse)) {
          comments = parsedResponse
        } else if (parsedResponse.comments && Array.isArray(parsedResponse.comments)) {
          comments = parsedResponse.comments
        } else if (parsedResponse.replies && Array.isArray(parsedResponse.replies)) {
          comments = parsedResponse.replies
        } else if (parsedResponse.variations && Array.isArray(parsedResponse.variations)) {
          comments = parsedResponse.variations
        } else {
          // Try to extract any array property
          const arrayProps = Object.values(parsedResponse).filter((val) => Array.isArray(val))
          if (arrayProps.length > 0 && Array.isArray(arrayProps[0])) {
            comments = arrayProps[0] as string[]
          }
        }
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError)

        // Fallback: try to extract an array from the content
        const arrayMatch = content.match(/\[(.*)\]/s)
        if (arrayMatch && arrayMatch[1]) {
          try {
            comments = JSON.parse(`[${arrayMatch[1]}]`)
          } catch {
            // If all parsing fails, split by newlines and clean up
            comments = content
              .split("\n")
              .filter((line) => line.trim().startsWith('"') || line.trim().startsWith("'"))
              .map((line) => line.trim().replace(/^["']|["'],?$/g, ""))
          }
        }
      }

      // Ensure we have at least one comment
      if (!comments.length) {
        throw new Error("Failed to generate comments")
      }

      // Format the comments
      const formattedComments: GeneratedComment[] = comments.map((text, index) => ({
        text: text.trim().replace(/^["']|["']$/g, ""), // Remove quotes if present
        isRecommended: index === 0, // First comment is recommended
      }))

      return NextResponse.json({
        comments: formattedComments,
        tweetContext: tweetContent.text,
        tone: detectedTone || tone,
        detectedTone: detectedTone,
        hasImages: hasImages,
        imageCount: hasImages ? tweetContent.images?.length || 0 : 0,
        metadata: {
          length,
          useEmoji,
          variations: numVariations,
          hasInstructions: !!instructions,
          modelUsed: modelToUse,
        },
      })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)
      return NextResponse.json(
        {
          error: "Failed to generate comments. Our AI service is experiencing issues. Please try again shortly.",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating comments:", error)
    return NextResponse.json({ error: "Comment generation failed. Please try again." }, { status: 500 })
  }
}
