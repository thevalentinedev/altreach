// Twitter API v2 endpoints
const TWITTER_API_BASE = "https://api.twitter.com/2"

interface TwitterAPIOptions {
  authToken: string
  ct0Token: string
}

interface TweetResponse {
  data?: {
    id: string
    text: string
    author_id?: string
    created_at?: string
    attachments?: {
      media_keys?: string[]
    }
  }
  includes?: {
    media?: {
      media_key: string
      type: string
      url?: string
    }[]
    users?: {
      id: string
      name: string
      username: string
    }[]
  }
  errors?: any[]
}

export class TwitterAPIClient {
  private authToken: string
  private ct0Token: string

  constructor(options: TwitterAPIOptions) {
    this.authToken = options.authToken
    this.ct0Token = options.ct0Token
  }

  private async makeRequest(url: string, method = "GET", body?: any) {
    const headers = {
      Authorization: `Bearer ${this.authToken}`,
      "x-csrf-token": this.ct0Token,
      Cookie: `auth_token=${this.authToken}; ct0=${this.ct0Token}`,
      "Content-Type": "application/json",
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Twitter API request failed:", error)
      throw error
    }
  }

  async getTweet(tweetId: string): Promise<TweetResponse> {
    // Extract tweet ID from URL if full URL is provided
    if (tweetId.includes("/")) {
      const urlParts = tweetId.split("/")
      tweetId = urlParts[urlParts.length - 1].split("?")[0]
    }

    const url = `${TWITTER_API_BASE}/tweets/${tweetId}?expansions=author_id,attachments.media_keys&media.fields=url,preview_image_url&user.fields=name,username,profile_image_url`
    return this.makeRequest(url)
  }

  // Extract tweet ID from a Twitter URL
  static extractTweetId(url: string): string | null {
    try {
      const parsedUrl = new URL(url)
      const pathParts = parsedUrl.pathname.split("/")

      // Check if it's a tweet URL
      if (
        (parsedUrl.hostname === "twitter.com" ||
          parsedUrl.hostname === "x.com" ||
          parsedUrl.hostname === "www.twitter.com" ||
          parsedUrl.hostname === "www.x.com") &&
        pathParts.length > 3 &&
        pathParts[2] === "status"
      ) {
        return pathParts[3]
      }
      return null
    } catch (error) {
      console.error("Error extracting tweet ID:", error)
      return null
    }
  }
}
