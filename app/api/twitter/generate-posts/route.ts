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

interface GeneratePostsRequest {
  topic: string
  tone: string
  length: "shorter" | "longer"
  useEmoji: boolean
  variations: number
  instructions?: string
}

interface GeneratedPost {
  content: string
  hashtags: string[]
}

export async function POST(request: Request) {
  try {
    // Rate limiting check
    const clientId = getClientId(request)
    const rateLimitResult = checkRateLimit(clientId)

    if (!rateLimitResult.allowed) {
      const secondsRemaining = Math.ceil((rateLimitResult.timeRemaining || 0) / 1000)
      return NextResponse.json(
        {
          error: `Please wait a moment before generating another post. Try again in ${secondsRemaining} second${
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

    const requestData: GeneratePostsRequest = await request.json()
    const { topic, tone, length, useEmoji, variations, instructions } = requestData

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 })
    }

    if (!tone) {
      return NextResponse.json({ error: "Tone is required" }, { status: 400 })
    }

    // Validate variations
    const numVariations = variations || 3
    if (numVariations < 1 || numVariations > 5) {
      return NextResponse.json({ error: "Number of variations must be between 1 and 5" }, { status: 400 })
    }

    try {
      // Build the system prompt
      const systemPrompt = `You are a viral social media content creator specializing in Twitter/X posts. 
Your goal is to create engaging, shareable content that maximizes reach and engagement.

Guidelines:
- Create posts with a ${tone} tone
- Keep posts ${length === "shorter" ? "concise (under 140 characters)" : "more detailed (140-280 characters)"}
- ${useEmoji ? "Include relevant emojis naturally" : "Do not use emojis"}
- Generate ${numVariations} unique post variation${numVariations > 1 ? "s" : ""}
- Include 3-5 relevant hashtags for each post to maximize discoverability
- Focus on creating viral, engaging content that encourages interaction
- Make posts authentic and human, not generic or AI-generated
- Include trending elements when relevant to the topic

${instructions ? `Additional instructions: ${instructions}` : ""}

You MUST respond with a valid JSON object in this exact format:
{
  "posts": [
    {
      "content": "First post content here",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
    },
    {
      "content": "Second post content here", 
      "hashtags": ["#hashtag1", "#hashtag4", "#hashtag5"]
    }
  ]
}`

      // Create the user prompt
      const userPrompt = `Create ${numVariations} viral Twitter/X post${numVariations > 1 ? "s" : ""} about: ${topic.trim()}

Make each post unique, engaging, and optimized for maximum reach and engagement. Include relevant hashtags that will help the posts get discovered by the right audience.`

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106", // Using a model with JSON mode support
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      })

      const content = response.choices[0].message.content

      if (!content) {
        throw new Error("No content returned from OpenAI")
      }

      // Parse the JSON response
      let posts: GeneratedPost[] = []
      try {
        const parsedResponse = JSON.parse(content)

        // Handle different possible JSON structures
        if (parsedResponse.posts && Array.isArray(parsedResponse.posts)) {
          posts = parsedResponse.posts
        } else if (Array.isArray(parsedResponse)) {
          posts = parsedResponse
        } else {
          console.error("Unexpected response structure:", parsedResponse)
          throw new Error("Invalid response format from AI")
        }
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError)
        console.error("Raw content:", content)
        throw new Error("Failed to parse AI response")
      }

      // Validate and clean up posts
      const validPosts = posts
        .filter((post) => post && typeof post === "object" && post.content && typeof post.content === "string")
        .map((post) => ({
          content: post.content.trim(),
          hashtags: Array.isArray(post.hashtags)
            ? post.hashtags
                .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
                .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
            : [],
        }))
        .filter((post) => post.content.length > 0)

      // Ensure we have at least one post
      if (!validPosts.length) {
        console.error("No valid posts generated. Original posts:", posts)
        throw new Error("AI failed to generate valid content. Please try again with a different topic.")
      }

      return NextResponse.json({
        posts: validPosts,
        topic: topic.trim(),
        tone,
        metadata: {
          length,
          useEmoji,
          variations: numVariations,
          hasInstructions: !!instructions,
        },
      })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)
      return NextResponse.json(
        {
          error: "Failed to generate posts. Our AI service is experiencing issues. Please try again shortly.",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating posts:", error)
    return NextResponse.json({ error: "Post generation failed. Please try again." }, { status: 500 })
  }
}
