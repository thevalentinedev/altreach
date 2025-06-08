import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// In-memory rate limiter
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_WINDOW = 5000 // 5 seconds in milliseconds for image generation

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

interface GenerateImageRequest {
  content: string
  style?: string
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
          error: `Please wait a moment before generating another image. Try again in ${secondsRemaining} second${
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

    const requestData: GenerateImageRequest = await request.json()
    const { content, style = "social-media" } = requestData

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    try {
      // Create a prompt for DALL-E based on the content
      const imagePrompt = createImagePrompt(content.trim(), style)

      console.log("🎨 Generating image with prompt:", imagePrompt)

      // Call DALL-E 2 API (more cost-efficient than DALL-E 3)
      const response = await openai.images.generate({
        model: "dall-e-2",
        prompt: imagePrompt,
        size: "512x512", // Smaller size for cost efficiency
        // quality: "standard",
        n: 1,
      })

      const imageUrl = response.data[0]?.url

      if (!imageUrl) {
        throw new Error("No image URL returned from DALL-E")
      }

      console.log("✅ Image generated successfully")

      return NextResponse.json({
        imageUrl,
        prompt: imagePrompt,
        model: "dall-e-2",
        size: "512x512",
      })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)

      // Handle specific DALL-E errors
      if (openaiError instanceof Error) {
        if (openaiError.message.includes("content_policy_violation")) {
          return NextResponse.json(
            {
              error: "The content violates OpenAI's usage policies. Please try a different topic.",
            },
            { status: 400 },
          )
        }

        if (openaiError.message.includes("rate_limit")) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded for image generation. Please try again later.",
            },
            { status: 429 },
          )
        }
      }

      return NextResponse.json(
        {
          error: "Failed to generate image. Please try again shortly.",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating image:", error)
    return NextResponse.json({ error: "Image generation failed. Please try again." }, { status: 500 })
  }
}

// Helper function to create optimized prompts for DALL-E
function createImagePrompt(content: string, style: string): string {
  // Extract key themes and concepts from the content
  const cleanContent = content
    .replace(/#\w+/g, "") // Remove hashtags
    .replace(/@\w+/g, "") // Remove mentions
    .replace(/https?:\/\/\S+/g, "") // Remove URLs
    .trim()

  // Base style prompts
  const stylePrompts = {
    "social-media": "modern, clean, vibrant colors, social media style, engaging visual",
    professional: "professional, clean, business style, corporate colors",
    creative: "artistic, creative, colorful, abstract elements",
    minimalist: "minimalist, simple, clean lines, modern design",
  }

  const baseStyle = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts["social-media"]

  // Create a focused prompt
  let prompt = `${baseStyle}, illustration representing: ${cleanContent.substring(0, 100)}`

  // Add quality and style modifiers
  prompt += ", high quality, digital art, trending on social media, eye-catching"

  // Ensure the prompt is within DALL-E's limits (1000 characters)
  if (prompt.length > 1000) {
    prompt = prompt.substring(0, 997) + "..."
  }

  return prompt
}
