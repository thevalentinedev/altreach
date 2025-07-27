import { NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client
let openai: OpenAI
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
} catch (initError) {
  console.error("Failed to initialize OpenAI client:", initError)
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key is missing")
    return NextResponse.json({ error: "OpenAI API key is not configured" }, { status: 500 })
  }

  try {
    // Add debugging for API key
    console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY)
    console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY?.length || 0)

    const { tweetContent } = await request.json()

    if (!tweetContent || !tweetContent.text) {
      return NextResponse.json({ error: "Tweet content is required" }, { status: 400 })
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a Twitter engagement expert who analyzes tweets to suggest the most effective tone for replies.

Your goal is to suggest a tone that maximizes the likelihood of engagement based on the tweet's content, style, and context.

Consider factors like:
- The tweet's own tone (casual, formal, humorous, serious)
- The topic being discussed (tech, politics, entertainment, personal)
- The apparent intent (sharing information, asking questions, expressing opinions)
- Whether the content contains claims, opinions, or statements that might benefit from critical analysis
- If the tweet makes bold claims, controversial statements, or oversimplifications
- Whether the content would benefit from questioning, skepticism, or alternative viewpoints

Tone Selection Guidelines:
- Use POSITIVE tones (supportive, enthusiastic, curious) for: personal updates, achievements, questions, helpful content
- Use CRITICAL tones (skeptical, analytical, disagreeing) for: bold claims, controversial opinions, oversimplifications, questionable statements
- Use NEUTRAL tones (professional, thoughtful) for: factual information, balanced discussions

Return ONLY a short descriptive phrase (2-4 words) that captures the optimal tone. Examples:
- "Witty and playful"
- "Supportive and encouraging" 
- "Curious and thoughtful"
- "Enthusiastic and excited"
- "Professional but friendly"
- "Casual and conversational"
- "Critical and analytical"
- "Skeptical and questioning"
- "Respectfully disagreeing"
- "Contrarian and challenging"
- "Unsupportive but constructive"
- "Doubtful and cautious"`,
          },
          {
            role: "user",
            content: `Given this tweet: "${tweetContent.text}", suggest the most effective tone of voice for a reply.`,
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
        tweetContext: tweetContent.text,
        reasoning: `Based on the tweet content: "${tweetContent.text.substring(0, 100)}${tweetContent.text.length > 100 ? "..." : ""}"`,
      })
    } catch (openaiError: any) {
      console.error("OpenAI API error details:", {
        message: openaiError?.message,
        type: openaiError?.type,
        code: openaiError?.code,
        status: openaiError?.status,
      })

      // Fallback tone suggestions based on simple heuristics
      let fallbackTone = "Casual and conversational"

      // Check for content that might benefit from critical analysis
      const text = tweetContent.text.toLowerCase()
      const hasBoldClaims = /\b(all|every|always|never|impossible|guaranteed|definitely|absolutely)\b/.test(text)
      const hasControversialTopics = /\b(politics|religion|conspiracy|fake|hoax|scam|fraud)\b/.test(text)
      const hasOversimplifications = /\b(simple|easy|just|only|merely|simply)\b/.test(text)
      const hasQuestionableStats = /\b(studies show|research proves|scientists say|experts agree)\b/.test(text)
      const hasAbsoluteStatements = /\b(no one|everyone|nobody|everybody|always|never)\b/.test(text)

      if (hasBoldClaims || hasControversialTopics || hasOversimplifications || hasQuestionableStats || hasAbsoluteStatements) {
        fallbackTone = "Skeptical and questioning"
      } else if (tweetContent.text.includes("?")) {
        fallbackTone = "Curious and thoughtful"
      } else if (text.includes("excited") || tweetContent.text.includes("!")) {
        fallbackTone = "Enthusiastic and excited"
      } else if (text.includes("opinion") || text.includes("think")) {
        fallbackTone = "Thoughtful and curious"
      }

      return NextResponse.json({
        suggestedTone: fallbackTone,
        tweetContext: tweetContent.text,
        reasoning: "Fallback suggestion based on tweet analysis",
        fallback: true,
      })
    }
  } catch (error) {
    console.error("Error detecting tone:", error)
    return NextResponse.json({ error: "Failed to detect tone. Please try again." }, { status: 500 })
  }
}
