"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2,
  Twitter,
  AlertCircle,
  Zap,
  Link,
  Type,
  CheckCircle,
  Info,
  Sparkles,
  ImageIcon,
  Shield,
  RefreshCw,
  LogOut,
  Plus,
  ArrowLeft,
  Hash,
  Lightbulb,
  Copy,
  Download,
  LogIn,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HashtagTrends from "./hashtag-trends"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { CommentSkeleton, PostSkeleton } from "@/components/ui/skeleton-loader"

interface TweetContent {
  text: string | null
  author: string | null
  username: string | null
  timestamp: string | null
  url: string
  aiGenerated?: boolean
  images?: string[]
}

interface GeneratedComment {
  text: string
  isRecommended: boolean
}

interface GeneratedPost {
  id: string
  content: string
  hashtags: string[]
  generatedImage?: string
  isGeneratingImage?: boolean
}

// Update the AuthData interface to include the CT0 token
interface AuthData {
  authToken: string
  timestamp: number
  expiresAt?: number
  ct0Token?: string
}

type InputMethod = "url" | "manual"
type AuthState = "checking" | "unauthenticated" | "authenticating" | "authenticated"
type ViewState = "comments" | "create"

const toneOptions = [
  { value: "casual and conversational", label: "Casual" },
  { value: "witty and playful", label: "Witty" },
  { value: "supportive and encouraging", label: "Supportive" },
  { value: "curious and thoughtful", label: "Curious" },
  { value: "enthusiastic and excited", label: "Enthusiastic" },
  { value: "professional but friendly", label: "Professional" },
  { value: "humorous and light", label: "Humorous" },
  { value: "respectful and thoughtful", label: "Respectful" },
]

const AUTH_CACHE_KEY = "altreach_twitter_auth"
const AUTH_EXPIRY_HOURS = 24 // Auth expires after 24 hours

// Add a function to handle comment caching after the AUTH_CACHE_KEY constant
const COMMENT_CACHE_KEY_PREFIX = "altreach_twitter_comment_cache"
const COMMENT_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Add these functions after the AUTH_CACHE_KEY constant
const getCachedComments = (
  tweetUrl: string,
  tone: string,
  length: string,
  useEmoji: boolean,
): GeneratedComment[] | null => {
  try {
    const cacheKey = `${COMMENT_CACHE_KEY_PREFIX}:${tweetUrl}:${tone}:${length}:${useEmoji}`
    const cached = localStorage.getItem(cacheKey)

    if (cached) {
      const { comments, timestamp } = JSON.parse(cached)
      const now = Date.now()

      // Check if cache is still valid (24 hours)
      if (now - timestamp < COMMENT_CACHE_TTL) {
        console.log("✅ Found cached comments")
        return comments
      } else {
        // Remove expired cache
        localStorage.removeItem(cacheKey)
        console.log("⚠️ Cached comments expired")
      }
    }
  } catch (error) {
    console.error("❌ Error checking cached comments:", error)
  }

  return null
}

const cacheComments = (
  tweetUrl: string,
  tone: string,
  length: string,
  useEmoji: boolean,
  comments: GeneratedComment[],
) => {
  try {
    const cacheKey = `${COMMENT_CACHE_KEY_PREFIX}:${tweetUrl}:${tone}:${length}:${useEmoji}`
    const cacheData = {
      comments,
      timestamp: Date.now(),
    }

    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    console.log("✅ Comments cached successfully")
  } catch (error) {
    console.error("❌ Error caching comments:", error)
  }
}

interface TwitterInputProps {
  currentView?: "comments" | "create" | "hashtags"
  setCurrentView?: (view: "comments" | "create" | "hashtags") => void
}

export default function TwitterInput({
  currentView: externalView,
  setCurrentView: setExternalView,
}: TwitterInputProps) {
  // View state
  const [internalCurrentView, setInternalCurrentView] = useState<"comments" | "create" | "hashtags">("comments")
  const currentView = externalView || internalCurrentView
  const setCurrentView = (view: "comments" | "create" | "hashtags") => {
    if (setExternalView) {
      setExternalView(view)
    } else {
      setInternalCurrentView(view)
    }
  }

  // Authentication state
  const [authState, setAuthState] = useState<AuthState>("checking")
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Input method state
  const [inputMethod, setInputMethod] = useState<InputMethod>("url")

  // URL and content state
  const [url, setUrl] = useState("")
  const [tweetContent, setTweetContent] = useState<TweetContent | null>(null)
  const [manualContent, setManualContent] = useState("")
  const [isExtractingTweet, setIsExtractingTweet] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractSuccess, setExtractSuccess] = useState(false)
  const [extractMessage, setExtractMessage] = useState<string | null>(null)
  const [isAiGenerated, setIsAiGenerated] = useState(false)

  // Tone state
  const [tone, setTone] = useState("casual and conversational")
  const [isDetectingTone, setIsDetectingTone] = useState(false)
  const [useSmartTone, setUseSmartTone] = useState(true)
  const [detectedTone, setDetectedTone] = useState<string | null>(null)

  // Advanced settings
  const [commentInstructions, setCommentInstructions] = useState("")
  const [commentLength, setCommentLength] = useState<"shorter" | "longer">("shorter")
  const [useEmoji, setUseEmoji] = useState(true)
  const [variations, setVariations] = useState(3)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [comments, setComments] = useState<GeneratedComment[]>([])
  const [copied, setCopied] = useState<number | null>(null)

  // Image state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [imageError, setImageError] = useState<boolean>(false)

  // Content creation state
  const [topic, setTopic] = useState("")
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([])
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false)
  const [postGenerationError, setPostGenerationError] = useState<string | null>(null)
  const [copiedPost, setCopiedPost] = useState<string | null>(null)

  // Manual Auth State
  const [manualAuthToken, setManualAuthToken] = useState("")
  const [manualCt0Token, setManualCt0Token] = useState("")

  // Check for cached authentication on component mount
  useEffect(() => {
    checkCachedAuth()
  }, [])

  // Authentication functions
  const checkCachedAuth = () => {
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY)
      if (cached) {
        const authData: AuthData = JSON.parse(cached)
        const now = Date.now()

        // Check if auth is expired (24 hours)
        const expiryTime = authData.timestamp + AUTH_EXPIRY_HOURS * 60 * 60 * 1000

        if (now < expiryTime && authData.authToken) {
          setAuthData(authData)
          setAuthState("authenticated")
          console.log("✅ Found valid cached authentication")
          return
        } else {
          // Remove expired auth
          localStorage.removeItem(AUTH_CACHE_KEY)
          console.log("⚠️ Cached authentication expired")
        }
      }
    } catch (error) {
      console.error("❌ Error checking cached auth:", error)
      localStorage.removeItem(AUTH_CACHE_KEY)
    }

    setAuthState("unauthenticated")
  }

  // Update the saveAuthToCache function to accept an optional CT0 token
  const saveAuthToCache = (authToken: string, ct0Token?: string) => {
    const authData: AuthData = {
      authToken,
      timestamp: Date.now(),
      ...(ct0Token && { ct0Token }),
    }

    try {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(authData))
      setAuthData(authData)
      setAuthState("authenticated")
      console.log("✅ Authentication cached successfully")
    } catch (error) {
      console.error("❌ Error caching auth:", error)
    }
  }

  const clearAuthCache = () => {
    try {
      localStorage.removeItem(AUTH_CACHE_KEY)
      setAuthData(null)
      setAuthState("unauthenticated")
      // Clear any extracted content
      setTweetContent(null)
      setUrl("")
      setManualContent("")
      setComments([])
      setCurrentView("comments")
      console.log("✅ Authentication cache cleared")
    } catch (error) {
      console.error("❌ Error clearing auth cache:", error)
    }
  }

  // Add these new authentication functions after the clearAuthCache function

  // Function to use predefined authentication from environment variables
  const usePredefinedAuth = async () => {
    setIsLoggingIn(true)
    setLoginError(null)
    setAuthState("authenticating")

    try {
      console.log("🔑 Using predefined authentication...")

      const response = await fetch("/api/twitter/predefined-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await safeParseResponse(response)

      if (!response.ok || !data.success || data.error) {
        const errorMessage = data.error || data.message || `Server error (${response.status})`
        console.error("❌ Predefined auth failed:", errorMessage)
        setLoginError(errorMessage)
        setAuthState("unauthenticated")
        return
      }

      if (data.cookies?.auth_token) {
        saveAuthToCache(data.cookies.auth_token)
        setLoginError(null)
        console.log("✅ Predefined auth successful, token cached")
      } else {
        setLoginError("Predefined auth completed but could not extract session token")
        setAuthState("unauthenticated")
      }
    } catch (error) {
      console.error("❌ Error during predefined auth:", error)

      if (error instanceof Error) {
        setLoginError(`Request failed: ${error.message}`)
      } else {
        setLoginError("An unexpected error occurred during authentication. Please try again.")
      }
      setAuthState("unauthenticated")
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Function to login with manually entered cookies
  const loginWithManualCookies = async () => {
    setIsLoggingIn(true)
    setLoginError(null)
    setAuthState("authenticating")

    try {
      console.log("🚀 Attempting login with manual cookies...")

      const response = await fetch("/api/twitter/manual-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authToken: manualAuthToken,
          ct0: manualCt0Token,
        }),
      })

      const data = await safeParseResponse(response)

      if (!response.ok || !data.success || data.error) {
        const errorMessage = data.error || data.message || `Server error (${response.status})`
        console.error("❌ Manual auth failed:", errorMessage)
        setLoginError(errorMessage)
        setAuthState("unauthenticated")
        return
      }

      if (data.authToken) {
        saveAuthToCache(data.authToken, manualCt0Token)
        setLoginError(null)
        console.log("✅ Manual auth successful, token cached")
      } else {
        setLoginError("Manual auth completed but could not extract session token")
        setAuthState("unauthenticated")
      }
    } catch (error) {
      console.error("❌ Error during manual auth:", error)

      if (error instanceof TypeError && error.message.includes("fetch")) {
        setLoginError("Network error: Could not connect to the server. Please check your connection.")
      } else if (error instanceof Error) {
        setLoginError(`Request failed: ${error.message}`)
      } else {
        setLoginError("An unexpected error occurred during login. Please try again.")
      }
      setAuthState("unauthenticated")
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Helper to validate Twitter URLs
  const isValidTwitterUrl = (url: string): boolean => {
    if (!url.trim()) return false
    return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status(es)?\/\d+/.test(url)
  }

  // Helper to safely parse JSON response
  const safeParseResponse = async (response: Response) => {
    try {
      const text = await response.text()

      if (response.headers.get("content-type")?.includes("application/json")) {
        return JSON.parse(text)
      }

      try {
        return JSON.parse(text)
      } catch {
        console.error("❌ Non-JSON response received:", text.substring(0, 200))
        return {
          error: "Server returned an invalid response",
          message: "The server encountered an error. Please try again.",
        }
      }
    } catch (error) {
      console.error("❌ Failed to parse response:", error)
      return {
        error: "Failed to parse server response",
        message: "Unable to process server response. Please try again.",
      }
    }
  }

  // Extract tweet content when URL changes
  useEffect(() => {
    const extractTweetFromUrl = async () => {
      if (!url.trim() || !isValidTwitterUrl(url) || inputMethod !== "url" || !authData?.authToken) {
        return
      }

      console.log("🚀 Starting tweet extraction for:", url)
      setIsExtractingTweet(true)
      setExtractError(null)
      setExtractSuccess(false)
      setExtractMessage(null)
      setTweetContent(null)
      setIsAiGenerated(false)
      setSelectedImageIndex(0)
      setImageError(false)

      try {
        const response = await fetch("/api/twitter/extract-with-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
            authToken: authData.authToken,
            ct0Token: authData.ct0Token,
          }),
        })

        const data = await safeParseResponse(response)

        if (!response.ok || data.error) {
          setExtractError(data.message || data.error || "Failed to extract tweet content")
          return
        }

        const tweetContent: TweetContent = {
          text: data.content,
          author: data.author || null,
          username: data.username || null,
          timestamp: data.timestamp || null,
          url: url,
          images: data.images || [],
        }

        setTweetContent(tweetContent)
        setExtractSuccess(true)
        setExtractMessage("Tweet content extracted successfully")

        // If we successfully extracted content and smart tone is enabled, detect tone
        if (tweetContent.text && useSmartTone) {
          console.log("🎯 Triggering tone detection for:", tweetContent.text)
          detectTone(tweetContent)
        }

        setExtractError(null)
      } catch (error) {
        console.error("❌ Error extracting tweet:", error)
        setExtractError("Failed to extract tweet content. Please check the URL or try manual input.")
      } finally {
        setIsExtractingTweet(false)
      }
    }

    const timeoutId = setTimeout(() => {
      if (url.trim() && inputMethod === "url" && authState === "authenticated") {
        extractTweetFromUrl()
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [url, inputMethod, authData, authState])

  // Update preview when manual content changes
  useEffect(() => {
    if (inputMethod === "manual" && manualContent.trim()) {
      if (useSmartTone && manualContent.trim().length > 10) {
        const mockTweetContent: TweetContent = {
          text: manualContent,
          author: null,
          username: null,
          timestamp: null,
          url: "",
        }
        detectTone(mockTweetContent)
      }
    }
  }, [manualContent, inputMethod, useSmartTone])

  // Detect tone from tweet content
  const detectTone = async (content: TweetContent) => {
    if (!content.text) return

    console.log("🎯 Detecting tone for content:", content.text)
    setIsDetectingTone(true)

    try {
      const response = await fetch("/api/twitter/detect-tone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tweetContent: content }),
      })

      const data = await safeParseResponse(response)

      if (!response.ok || data.error) {
        console.warn("⚠️ Failed to detect tone:", data.error)
        return
      }

      console.log("✅ Tone detected:", data.suggestedTone)
      setDetectedTone(data.suggestedTone)

      const detectedTone = data.suggestedTone.toLowerCase()
      const matchedTone = toneOptions.find(
        (option) => detectedTone.includes(option.value) || option.value.includes(detectedTone),
      )

      if (matchedTone) {
        setTone(matchedTone.value)
      } else {
        const words = detectedTone.split(/\s+/)
        for (const word of words) {
          if (word.length < 4) continue

          const partialMatch = toneOptions.find((option) => option.value.includes(word))

          if (partialMatch) {
            setTone(partialMatch.value)
            break
          }
        }
      }
    } catch (error) {
      console.error("❌ Error detecting tone:", error)
    } finally {
      setIsDetectingTone(false)
    }
  }

  // Generate comments
  const generateComments = async () => {
    const effectiveContent = inputMethod === "manual" ? manualContent : tweetContent?.text || ""
    const tweetUrl = inputMethod === "manual" ? "manual-input" : tweetContent?.url || ""

    if (!effectiveContent.trim()) {
      setGenerationError("Please provide tweet content")
      return
    }

    // Check cache first
    const cachedComments = getCachedComments(tweetUrl, tone, commentLength, useEmoji)
    if (cachedComments) {
      setComments(cachedComments)
      return
    }

    setIsGenerating(true)
    setGenerationError(null)
    setComments([])

    try {
      const response = await fetch("/api/twitter/generate-comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tweetContent: {
            text: effectiveContent,
            author: tweetContent?.author || null,
            username: tweetContent?.username || null,
          },
          tone,
          length: commentLength,
          useEmoji,
          variations,
          instructions: commentInstructions.trim() || undefined,
        }),
      })

      const data = await safeParseResponse(response)

      if (response.status === 429) {
        setGenerationError(`Rate limit reached. Please try again in ${data.retryAfter || 30} seconds.`)
        return
      }

      if (!response.ok || data.error) {
        setGenerationError(data.error || "Failed to generate comments")
        return
      }

      setComments(data.comments || [])

      // Cache the generated comments
      if (data.comments && data.comments.length > 0) {
        cacheComments(tweetUrl, tone, commentLength, useEmoji, data.comments)
      }
    } catch (error) {
      console.error("Error generating comments:", error)
      setGenerationError("Failed to generate comments. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Generate posts from topic
  const generatePosts = async () => {
    if (!topic.trim()) {
      setPostGenerationError("Please enter a topic")
      return
    }

    setIsGeneratingPosts(true)
    setPostGenerationError(null)
    setGeneratedPosts([])

    try {
      const response = await fetch("/api/twitter/generate-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
          tone,
          length: commentLength,
          useEmoji,
          variations,
          instructions: commentInstructions.trim() || undefined,
        }),
      })

      const data = await safeParseResponse(response)

      if (response.status === 429) {
        setPostGenerationError(`Rate limit reached. Please try again in ${data.retryAfter || 30} seconds.`)
        return
      }

      if (!response.ok || data.error) {
        setPostGenerationError(data.error || "Failed to generate posts")
        return
      }

      const posts = (data.posts || []).map((post: any, index: number) => ({
        id: `post-${Date.now()}-${index}`,
        content: post.content,
        hashtags: post.hashtags || [],
      }))

      setGeneratedPosts(posts)
    } catch (error) {
      console.error("Error generating posts:", error)
      setPostGenerationError("Failed to generate posts. Please try again.")
    } finally {
      setIsGeneratingPosts(false)
    }
  }

  // Generate image for post
  const generateImage = async (postId: string, content: string) => {
    setGeneratedPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, isGeneratingImage: true } : post)))

    try {
      const response = await fetch("/api/twitter/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content,
          style: "social-media",
        }),
      })

      const data = await safeParseResponse(response)

      if (!response.ok || data.error) {
        console.error("Failed to generate image:", data.error)
        return
      }

      setGeneratedPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, generatedImage: data.imageUrl, isGeneratingImage: false } : post,
        ),
      )
    } catch (error) {
      console.error("Error generating image:", error)
    } finally {
      setGeneratedPosts((prev) =>
        prev.map((post) => (post.id === postId ? { ...post, isGeneratingImage: false } : post)),
      )
    }
  }

  // Copy comment to clipboard
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error("Failed to copy text:", error)
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  // Copy post to clipboard
  const copyPostToClipboard = async (postId: string, content: string, hashtags: string[]) => {
    const fullContent = `${content}\n\n${hashtags.join(" ")}`
    try {
      await navigator.clipboard.writeText(fullContent)
      setCopiedPost(postId)
      setTimeout(() => setCopiedPost(null), 2000)
    } catch (error) {
      console.error("Failed to copy post:", error)
      const textArea = document.createElement("textarea")
      textArea.value = fullContent
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopiedPost(postId)
      setTimeout(() => setCopiedPost(null), 2000)
    }
  }

  // Get effective content for validation
  const getEffectiveContent = (): string => {
    return inputMethod === "manual" ? manualContent : tweetContent?.text || ""
  }

  // Handle image error
  const handleImageError = () => {
    setImageError(true)
  }

  // Format auth timestamp for display
  const formatAuthTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Render authentication checking state
  if (authState === "checking") {
    return (
      <Card className="w-full max-w-4xl mx-auto shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        <CardHeader className="pb-4 sm:pb-6 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-white leading-tight">
                Smart Twitter Comments
              </CardTitle>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
                Generate engaging Twitter replies with AI-powered tone analysis
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView("hashtags")}
                className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
              >
                <Hash className="h-4 w-4" />
                <span className="hidden sm:inline">Hashtags</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView("create")}
                className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#1DA1F2] mx-auto" />
            <p className="text-slate-600 dark:text-slate-400">Checking authentication...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render login required state
  if (authState === "unauthenticated") {
    // Login UI remains the same...
    return (
      <Card className="w-full max-w-4xl mx-auto shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        <CardHeader className="pb-4 sm:pb-6 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-white leading-tight">
                Smart Twitter Comments
              </CardTitle>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
                Generate engaging Twitter replies with AI-powered tone analysis
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView("hashtags")}
                className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
              >
                <Hash className="h-4 w-4" />
                <span className="hidden sm:inline">Hashtags</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView("create")}
                className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
          {/* Login Required Card content remains the same... */}
          {/* Login Required Card */}
          {/* Login Card with Authentication Options */}
          <Card className="border-[#1DA1F2]/20 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-900/10 dark:to-cyan-900/10">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#1DA1F2] to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <Twitter className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-[#1E293B] dark:text-white">
                Connect Your Twitter Account
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Choose one of the authentication methods below to connect your Twitter account.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Authentication Methods Tabs */}
              <Tabs defaultValue="predefined" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="predefined" className="text-xs sm:text-sm">
                    Predefined Auth
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="text-xs sm:text-sm">
                    Manual Input
                  </TabsTrigger>
                </TabsList>

                {/* Predefined Auth Tab */}
                <TabsContent value="predefined" className="space-y-4 pt-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Use predefined authentication credentials stored in environment variables.
                    </p>
                    <Button
                      className="w-full h-14 text-base font-semibold bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white transition-all duration-200 shadow-lg hover:shadow-xl rounded-xl disabled:opacity-50"
                      onClick={usePredefinedAuth}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Applying Predefined Auth...
                        </>
                      ) : (
                        <>
                          <Shield className="mr-3 h-5 w-5" />
                          Use Predefined Auth
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      This option uses authentication credentials configured by your administrator.
                    </p>
                  </div>
                </TabsContent>

                {/* Manual Input Tab */}
                <TabsContent value="manual" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Manually enter your Twitter authentication cookies. You can find these in your browser's developer
                      tools.
                    </p>

                    <div className="space-y-2">
                      <label htmlFor="auth-token" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                        Auth Token
                      </label>
                      <Input
                        id="auth-token"
                        placeholder="Enter your auth_token cookie value"
                        value={manualAuthToken}
                        onChange={(e) => setManualAuthToken(e.target.value)}
                        className="h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Find this in your browser cookies as "auth_token"
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="ct0-token" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                        CT0 Token (Optional)
                      </label>
                      <Input
                        id="ct0-token"
                        placeholder="Enter your ct0 cookie value (optional)"
                        value={manualCt0Token}
                        onChange={(e) => setManualCt0Token(e.target.value)}
                        className="h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Find this in your browser cookies as "ct0" (optional)
                      </p>
                    </div>

                    <Button
                      className="w-full h-14 text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 text-white transition-all duration-200 shadow-lg hover:shadow-xl rounded-xl disabled:opacity-50"
                      onClick={loginWithManualCookies}
                      disabled={isLoggingIn || !manualAuthToken.trim()}
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        <>
                          <LogIn className="mr-3 h-5 w-5" />
                          Login Now
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Login Process Info */}
              {authState === "authenticating" && (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-600 dark:text-blue-400">
                    <div className="space-y-1">
                      <p className="font-medium">Authentication in progress...</p>
                      <p className="text-sm">
                        {process.env.NODE_ENV === "production"
                          ? "Processing your login request. This may take a moment as we securely authenticate with Twitter."
                          : "A browser window will open. Please log in to Twitter/X and wait for the process to complete."}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Login Error */}
              {loginError && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                >
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-600 dark:text-red-400">
                    <div className="space-y-2">
                      <p className="font-medium">Authentication Failed</p>
                      <p className="text-sm">{loginError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLoginError(null)}
                        className="mt-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Try Again
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Security Notice */}
              <Alert className="bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
                <Shield className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <AlertDescription className="text-slate-600 dark:text-slate-400">
                  <div className="space-y-1">
                    <p className="font-medium text-xs">Security & Privacy</p>
                    <p className="text-xs">
                      Your authentication is processed securely and stored locally in your browser. We never store your
                      Twitter credentials on our servers. Session data expires automatically after 24 hours.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    )
  }

  // Render hashtags view
  if (currentView === "hashtags") {
    return <HashtagTrends onBack={() => setCurrentView("comments")} />
  }

  // Render content creation view
  if (currentView === "create") {
    // Content creation UI remains the same...
    return (
      <Card className="w-full max-w-4xl mx-auto shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        {/* Header with Back Button */}
        <CardHeader className="pb-4 sm:pb-6 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView("comments")}
                className="text-slate-600 dark:text-slate-400 hover:text-[#1DA1F2] dark:hover:text-[#1DA1F2]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-white leading-tight">
                  Create Content
                </CardTitle>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
                  Generate viral Twitter posts with AI
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
          {/* Content Creation Tabs */}
          <Tabs defaultValue="topics" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="topics" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Topics
              </TabsTrigger>
              <TabsTrigger
                value="hashtags"
                className="flex items-center gap-2"
                onClick={() => setCurrentView("hashtags")}
              >
                <Hash className="h-4 w-4" />
                Hashtags
              </TabsTrigger>
            </TabsList>

            {/* Topics Tab Content remains the same... */}
            <TabsContent value="topics" className="space-y-6">
              {/* Topics content remains the same... */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[#1E293B] dark:text-white">
                    Generate Posts from Topic
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Enter a topic and let AI create engaging posts with relevant hashtags
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Topic Input */}
                  <div className="space-y-2">
                    <label htmlFor="topic" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                      Topic
                    </label>
                    <Input
                      id="topic"
                      placeholder="e.g., AI in healthcare, sustainable living, productivity tips..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Advanced Settings Accordion */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="content-settings" className="border-slate-200 dark:border-slate-700">
                      <AccordionTrigger className="text-sm font-medium text-[#1E293B] dark:text-slate-300 hover:no-underline">
                        <span>Content Settings</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 pb-2">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tone Selection */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Tone</label>
                              <Select value={tone} onValueChange={setTone}>
                                <SelectTrigger className="bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {toneOptions.map((toneOption) => (
                                    <SelectItem key={toneOption.value} value={toneOption.value}>
                                      {toneOption.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Length Setting */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Length</label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={commentLength === "shorter" ? "default" : "outline"}
                                  size="sm"
                                  className={commentLength === "shorter" ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}
                                  onClick={() => setCommentLength("shorter")}
                                >
                                  Short
                                </Button>
                                <Button
                                  type="button"
                                  variant={commentLength === "longer" ? "default" : "outline"}
                                  size="sm"
                                  className={commentLength === "longer" ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}
                                  onClick={() => setCommentLength("longer")}
                                >
                                  Long
                                </Button>
                              </div>
                            </div>

                            {/* Variations */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                                Variations
                              </label>
                              <div className="flex gap-2">
                                {[1, 3, 5].map((num) => (
                                  <Button
                                    key={num}
                                    type="button"
                                    variant={variations === num ? "default" : "outline"}
                                    size="sm"
                                    className={variations === num ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}
                                    onClick={() => setVariations(num)}
                                  >
                                    {num}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            {/* Use Emoji */}
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                                Use Emoji
                              </label>
                              <Switch
                                checked={useEmoji}
                                onCheckedChange={setUseEmoji}
                                className="data-[state=checked]:bg-[#1DA1F2]"
                              />
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="mt-4 space-y-2">
                            <label
                              htmlFor="instructions"
                              className="text-sm font-medium text-[#1E293B] dark:text-slate-300"
                            >
                              Additional Instructions (Optional)
                            </label>
                            <Input
                              id="instructions"
                              placeholder="e.g., Make it more professional, include statistics..."
                              value={commentInstructions}
                              onChange={(e) => setCommentInstructions(e.target.value)}
                              className="bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Generate Button */}
                  <Button
                    className="w-full h-12 text-base font-semibold bg-[#1DA1F2] hover:bg-[#1a91da] text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg disabled:opacity-50"
                    onClick={generatePosts}
                    disabled={isGeneratingPosts || !topic.trim()}
                  >
                    {isGeneratingPosts ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Posts...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate {variations} Post{variations !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>

                  {/* Generation Error */}
                  {postGenerationError && (
                    <Alert
                      variant="destructive"
                      className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    >
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-600 dark:text-red-400">
                        {postGenerationError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Generated Posts */}
                  {isGeneratingPosts && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">Generating Posts...</h3>
                      </div>
                      <div className="space-y-4">
                        {Array.from({ length: variations }).map((_, index) => (
                          <PostSkeleton key={index} />
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedPosts.length > 0 && !isGeneratingPosts && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">Generated Posts</h3>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {generatedPosts.length} post{generatedPosts.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>

                      <div className="space-y-4">
                        {generatedPosts.map((post, index) => (
                          <Card key={post.id} className="border-slate-200 dark:border-slate-700">
                            <CardContent className="p-5">
                              <div className="space-y-4">
                                {/* Post Content */}
                                <div className="relative">
                                  <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed text-base pr-12">
                                    {post.content}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    onClick={() => copyPostToClipboard(post.id, post.content, post.hashtags)}
                                  >
                                    {copiedPost === post.id ? (
                                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                      <Copy className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                    )}
                                  </Button>
                                </div>

                                {/* Hashtags */}
                                {post.hashtags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {post.hashtags.map((hashtag, hashIndex) => (
                                      <Badge
                                        key={hashIndex}
                                        variant="secondary"
                                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                      >
                                        {hashtag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                {/* Generated Image */}
                                {post.generatedImage && (
                                  <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                    <OptimizedImage
                                      src={post.generatedImage}
                                      alt="Generated image"
                                      className="w-full h-64"
                                      width={600}
                                      height={256}
                                      priority={false}
                                      fallbackSrc="/placeholder.svg?height=256&width=600"
                                    />
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => generateImage(post.id, post.content)}
                                    disabled={post.isGeneratingImage || !!post.generatedImage}
                                    className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  >
                                    {post.isGeneratingImage ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                      </>
                                    ) : post.generatedImage ? (
                                      <>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Image Generated
                                      </>
                                    ) : (
                                      <>
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Generate Image
                                      </>
                                    )}
                                  </Button>

                                  {post.generatedImage && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const link = document.createElement("a")
                                        link.href = post.generatedImage!
                                        link.download = `twitter-post-image-${index + 1}.png`
                                        link.click()
                                      }}
                                      className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                    >
                                      <Download className="mr-2 h-4 w-4" />
                                      Download
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hashtags Tab (Empty for now) */}
            {/* <TabsContent value="hashtags" className="space-y-6">
              <Card>
                <CardContent className="p-8 text-center">
                  <Hash className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white mb-2">Hashtag Generator</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Coming soon! Generate trending hashtags for maximum reach.
                  </p>
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  >
                    In Development
                  </Badge>
                </CardContent>
              </Card>
            </TabsContent> */}
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  // Render authenticated state with main functionality (comments view)
  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
      {/* Header with Title and Plus Button */}
      <CardHeader className="pb-4 sm:pb-6 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-white leading-tight">
              Smart Twitter Comments
            </CardTitle>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
              Generate engaging Twitter replies with AI-powered tone analysis
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView("hashtags")}
              className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
            >
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Hashtags</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView("create")}
              className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 min-h-[36px] px-3"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
        {/* Authentication Status Bar */}
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-800/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200 text-sm">Twitter Account Connected</p>
                  <p className="text-xs text-green-600 dark:text-green-400 truncate">
                    Authenticated on {authData ? formatAuthTime(authData.timestamp) : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkCachedAuth}
                  className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-900/20 min-h-[32px]"
                >
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAuthCache}
                  className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 min-h-[32px]"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Method Tabs */}
        <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as InputMethod)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Tweet URL
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Manual Input
            </TabsTrigger>
          </TabsList>

          {/* URL Input Method */}
          <TabsContent value="url" className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="tweet-url" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                Twitter/X Post URL
              </label>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="tweet-url"
                  placeholder="https://twitter.com/username/status/123456789"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white"
                />
                {isExtractingTweet && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#1DA1F2]" />
                  </div>
                )}
                {extractSuccess && !isExtractingTweet && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                )}
              </div>

              {/* URL Status Messages */}
              {isExtractingTweet && (
                <div className="flex items-center gap-2 text-xs text-[#1DA1F2]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Extracting tweet content...
                </div>
              )}

              {url.trim() && !isValidTwitterUrl(url) && !isExtractingTweet && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Please enter a valid Twitter/X post URL
                </div>
              )}

              {extractSuccess && !isExtractingTweet && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Tweet content extracted successfully
                </div>
              )}

              {extractMessage && !extractSuccess && !extractError && !isExtractingTweet && (
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <Info className="h-3 w-3" />
                  {extractMessage}
                </div>
              )}
            </div>

            {/* Extract Error Alert */}
            {extractError && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-600 dark:text-red-400">
                  {extractError}
                  <Button
                    variant="link"
                    className="h-auto p-0 ml-2 text-red-600 dark:text-red-400 underline"
                    onClick={() => setInputMethod("manual")}
                  >
                    Switch to manual input
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Manual Input Method */}
          <TabsContent value="manual" className="space-y-2">
            <label htmlFor="tweet-content" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
              Tweet Content
            </label>
            <Textarea
              id="tweet-content"
              placeholder="Enter the tweet content here..."
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              className="min-h-[120px] border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white resize-none"
            />
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
              <span>Enter the tweet text you want to reply to</span>
              <span>{manualContent.length} characters</span>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tweet Preview */}
        {(tweetContent?.text || (inputMethod === "manual" && manualContent.trim())) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Tweet Preview</h3>
              <Badge variant="outline" className="text-xs border-[#1DA1F2] text-[#1DA1F2]">
                {inputMethod === "url" ? "Extracted" : "Manual Input"}
              </Badge>
            </div>
            <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    {tweetContent?.username ? (
                      <div className="w-10 h-10 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center overflow-hidden">
                        <img
                          src={`https://unavatar.io/twitter/${tweetContent.username}`}
                          alt={tweetContent.author || "Twitter user"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://avatar.vercel.sh/${tweetContent.username}`
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center">
                        <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                      {tweetContent?.author ? (
                        <>
                          <span className="font-bold text-[#1E293B] dark:text-white text-sm truncate">
                            {tweetContent.author}
                          </span>
                          {tweetContent.username && (
                            <span className="text-slate-500 dark:text-slate-400 text-xs">@{tweetContent.username}</span>
                          )}
                        </>
                      ) : (
                        <span className="font-bold text-[#1E293B] dark:text-white text-sm">Twitter User</span>
                      )}
                    </div>

                    {/* Truncated Text Content */}
                    <p className="text-[#1E293B] dark:text-white text-sm leading-relaxed break-words line-clamp-1">
                      {inputMethod === "url" ? tweetContent?.text : manualContent}
                      {((inputMethod === "url" && tweetContent?.text && tweetContent.text.length > 60) ||
                        (inputMethod === "manual" && manualContent.length > 60)) && (
                        <span className="text-slate-500 dark:text-slate-400">...</span>
                      )}
                    </p>

                    {/* Tweet Images - Optimized with lazy loading */}
                    {tweetContent?.images && tweetContent.images.length > 0 && !imageError && (
                      <div className="mt-2">
                        <div className="relative rounded-md overflow-hidden bg-slate-100 dark:bg-slate-700 max-h-20">
                          <OptimizedImage
                            src={tweetContent.images[selectedImageIndex] || "/placeholder.svg"}
                            alt="Tweet image"
                            className="w-20 h-20"
                            width={80}
                            height={80}
                            onError={handleImageError}
                            fallbackSrc="/placeholder.svg?height=80&width=80"
                          />

                          {/* Image Navigation Controls */}
                          {tweetContent.images.length > 1 && (
                            <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                              {tweetContent.images.map((_, index) => (
                                <button
                                  key={index}
                                  onClick={() => setSelectedImageIndex(index)}
                                  className={`w-1 h-1 rounded-full ${
                                    index === selectedImageIndex ? "bg-[#1DA1F2]" : "bg-slate-300 dark:bg-slate-600"
                                  }`}
                                  aria-label={`Image ${index + 1}`}
                                />
                              ))}
                            </div>
                          )}

                          {/* Image Counter Badge */}
                          {tweetContent.images.length > 1 && (
                            <div className="absolute top-0.5 right-0.5">
                              <Badge className="bg-black/70 text-white text-xs py-0 px-1 h-4 text-[10px]">
                                <ImageIcon className="h-2 w-2 mr-0.5" />
                                {selectedImageIndex + 1}/{tweetContent.images.length}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Twitter</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tone Selection */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-[#1DA1F2]" />
                <h4 className="text-sm font-semibold text-[#1E293B] dark:text-white">Comment Tone</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-700 dark:text-blue-400">Smart Tone</span>
                <Switch
                  checked={useSmartTone}
                  onCheckedChange={(checked) => {
                    setUseSmartTone(checked)
                    if (checked && tweetContent?.text) {
                      detectTone(tweetContent)
                    }
                  }}
                  className="data-[state=checked]:bg-[#1DA1F2]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800 h-10 sm:h-11">
                  <SelectValue placeholder="Select a tone" />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((toneOption) => (
                    <SelectItem key={toneOption.value} value={toneOption.value}>
                      {toneOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {useSmartTone
                    ? "AI will suggest the optimal tone based on the tweet content"
                    : "Manually select the tone for your comment"}
                </p>
                {isDetectingTone && (
                  <div className="flex items-center gap-1 text-xs text-[#1DA1F2] flex-shrink-0">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyzing...
                  </div>
                )}
              </div>

              {detectedTone && useSmartTone && (
                <div className="mt-1">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                  >
                    AI Suggested: {detectedTone}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced-settings" className="border-slate-200 dark:border-slate-700">
            <AccordionTrigger className="text-sm font-medium text-[#1E293B] dark:text-slate-300 hover:no-underline">
              <span>Advanced Settings</span>
            </AccordionTrigger>
            <AccordionContent className="pt-3 sm:pt-4 pb-2 space-y-3 sm:space-y-4">
              {/* Comment Instructions */}
              <div className="space-y-2">
                <label
                  htmlFor="comment-instructions"
                  className="text-sm font-medium text-[#1E293B] dark:text-slate-300"
                >
                  Comment Instructions (Optional)
                </label>
                <Input
                  id="comment-instructions"
                  placeholder="E.g., Make it more Gen Z or Keep it respectful"
                  value={commentInstructions}
                  onChange={(e) => setCommentInstructions(e.target.value)}
                  className="h-10 sm:h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#1DA1F2] dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Length Setting */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Comment Length</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={commentLength === "shorter" ? "default" : "outline"}
                    className={`flex-1 h-10 text-sm ${commentLength === "shorter" ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}`}
                    onClick={() => setCommentLength("shorter")}
                  >
                    Shorter (≤140)
                  </Button>
                  <Button
                    type="button"
                    variant={commentLength === "longer" ? "default" : "outline"}
                    className={`flex-1 h-10 text-sm ${commentLength === "longer" ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}`}
                    onClick={() => setCommentLength("longer")}
                  >
                    Longer (≤280)
                  </Button>
                </div>
              </div>

              {/* Number of Variations */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Number of Variations</label>
                <div className="flex gap-2">
                  {[1, 3, 5].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant={variations === num ? "default" : "outline"}
                      className={`flex-1 h-10 text-sm ${variations === num ? "bg-[#1DA1F2] hover:bg-[#1a91da]" : ""}`}
                      onClick={() => setVariations(num)}
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Use Emoji Setting */}
              <div className="flex items-center justify-between py-1">
                <label className="text-sm font-medium text-[#1E293B] dark:text-slate-300">Use Emoji</label>
                <Switch
                  checked={useEmoji}
                  onCheckedChange={setUseEmoji}
                  className="data-[state=checked]:bg-[#1DA1F2]"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Generate Button */}
        <Button
          className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold bg-[#1DA1F2] hover:bg-[#1a91da] text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg disabled:opacity-50 touch-manipulation"
          onClick={generateComments}
          disabled={isGenerating || !getEffectiveContent().trim()}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              <span className="hidden sm:inline">Generating Comments...</span>
              <span className="sm:hidden">Generating...</span>
            </>
          ) : (
            <>
              <Twitter className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">
                Generate {variations} Comment{variations !== 1 ? "s" : ""}
              </span>
              <span className="sm:hidden">Generate ({variations})</span>
            </>
          )}
        </Button>

        {/* Generation Error */}
        {generationError && (
          <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-600 dark:text-red-400">{generationError}</AlertDescription>
          </Alert>
        )}

        {/* Generated Comments */}
        {isGenerating && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">Generating Comments...</h3>
            </div>
            <div className="space-y-4">
              {Array.from({ length: variations }).map((_, index) => (
                <CommentSkeleton key={index} />
              ))}
            </div>
          </div>
        )}

        {comments.length > 0 && !isGenerating && (
          <div className="space-y-3 sm:space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-[#1E293B] dark:text-white">Generated Comments</h3>
              <Badge
                variant="secondary"
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                {comments.length} comment{comments.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {comments.map((comment, index) => (
                <div
                  key={index}
                  className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                    comment.isRecommended
                      ? "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  {comment.isRecommended && (
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs">
                        Recommended
                      </Badge>
                    </div>
                  )}
                  <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed pr-10 sm:pr-12 text-sm sm:text-base">
                    {comment.text}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 sm:top-4 right-3 sm:right-4 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors h-8 w-8 sm:h-10 sm:w-10 touch-manipulation"
                    onClick={() => copyToClipboard(comment.text, index)}
                  >
                    {copied === index ? (
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 dark:text-slate-400" />
                    )}
                    <span className="sr-only">Copy comment</span>
                  </Button>
                  {copied === index && (
                    <div className="absolute top-3 sm:top-4 right-12 sm:right-16 bg-green-600 text-white text-xs px-2 py-1 rounded-md animate-in fade-in duration-200">
                      Copied!
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
