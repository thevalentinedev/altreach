import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ProfileData {
  name: string | null
  headline: string | null
  source: "parsed" | "scraped" | "fallback"
}

export async function POST(request: Request) {
  try {
    const { profileData, profileUrl } = await request.json()

    if (!profileData) {
      return NextResponse.json({ error: "Profile data is required" }, { status: 400 })
    }

    // Build context for tone detection
    let profileContext = ""

    if (profileData.name && profileData.headline) {
      profileContext = `${profileData.name} - ${profileData.headline}`
    } else if (profileData.headline) {
      profileContext = profileData.headline
    } else if (profileData.name) {
      profileContext = `${profileData.name} (LinkedIn profile)`
    } else if (profileUrl) {
      // Fallback: extract username from URL for context
      const urlMatch = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/)
      const username = urlMatch ? urlMatch[1].replace(/-/g, " ") : "LinkedIn user"
      profileContext = `${username} (LinkedIn profile)`
    } else {
      profileContext = "LinkedIn professional"
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a LinkedIn networking expert who analyzes professional profiles to suggest the most effective tone for connection requests.

Your goal is to suggest a tone that maximizes the likelihood of connection acceptance based on the person's role, industry, and professional context.

Consider factors like:
- Seniority level (C-suite = more formal, individual contributors = more casual)
- Industry culture (tech = casual, finance = formal, creative = friendly)
- Role type (sales = warm, engineering = direct, HR = supportive)

Return ONLY a short descriptive phrase (2-4 words) that captures the optimal tone. Examples:
- "Professional but warm"
- "Casual and supportive" 
- "Confident and direct"
- "Friendly and enthusiastic"
- "Respectful and formal"
- "Approachable and genuine"`,
          },
          {
            role: "user",
            content: `Given this professional context: "${profileContext}", suggest the most effective tone of voice for a LinkedIn connection request.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 50,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      })

      const suggestedTone = response.choices[0].message.content?.trim()

      if (!suggestedTone) {
        throw new Error("No tone suggestion returned from OpenAI")
      }

      // Clean up the response (remove quotes, extra punctuation)
      const cleanTone = suggestedTone
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/\.$/, "") // Remove trailing period
        .trim()

      return NextResponse.json({
        suggestedTone: cleanTone,
        profileContext,
        reasoning: `Based on the professional context: "${profileContext}"`,
      })
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError)

      // Fallback tone suggestions based on simple heuristics
      let fallbackTone = "Professional but warm"

      if (profileContext.toLowerCase().includes("ceo") || profileContext.toLowerCase().includes("founder")) {
        fallbackTone = "Respectful and formal"
      } else if (
        profileContext.toLowerCase().includes("engineer") ||
        profileContext.toLowerCase().includes("developer")
      ) {
        fallbackTone = "Direct and genuine"
      } else if (
        profileContext.toLowerCase().includes("sales") ||
        profileContext.toLowerCase().includes("business development")
      ) {
        fallbackTone = "Friendly and enthusiastic"
      } else if (
        profileContext.toLowerCase().includes("marketing") ||
        profileContext.toLowerCase().includes("creative")
      ) {
        fallbackTone = "Casual and supportive"
      }

      return NextResponse.json({
        suggestedTone: fallbackTone,
        profileContext,
        reasoning: "Fallback suggestion based on role analysis",
        fallback: true,
      })
    }
  } catch (error) {
    console.error("Error detecting tone:", error)
    return NextResponse.json({ error: "Failed to detect tone. Please try again." }, { status: 500 })
  }
}
