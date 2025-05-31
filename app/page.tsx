"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Check,
  Copy,
  Loader2,
  Star,
  ExternalLink,
  Clock,
  Plus,
  Zap,
  AlertCircle,
  Linkedin,
  User,
  MessageSquare,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"

interface GeneratedComment {
  text: string
  isRecommended: boolean
}

interface PostContent {
  title: string | null
  description: string | null
  image: string | null
  type: string | null
  url: string
  fallbackContent?: string | null
}

interface ToneAnalysis {
  recommendedTone: string
  reasoning: string
}

interface ToneOption {
  value: string
  label: string
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
}

interface ConnectionToneAnalysis {
  suggestedTone: string
  profileContext: string
  reasoning: string
  fallback?: boolean
}

interface ConnectionMessage {
  text: string
  suggestedTone: string
  characterCount: number
}

export default function CommentGenerator() {
  const [url, setUrl] = useState("")
  const [platform, setPlatform] = useState<string | null>("LinkedIn")
  const [copied, setCopied] = useState<number | null>(null)
  const [comments, setComments] = useState<GeneratedComment[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingAnother, setIsGeneratingAnother] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postContent, setPostContent] = useState<PostContent | null>(null)
  const [isParsingPost, setIsParsingPost] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [toneAnalysis, setToneAnalysis] = useState<ToneAnalysis | null>(null)
  const [rateLimitInfo, setRateLimitInfo] = useState<{ retryAfter?: number } | null>(null)
  const [manualContent, setManualContent] = useState<string>("")
  const [useManualContent, setUseManualContent] = useState<boolean>(false)
  const [parseError, setParseError] = useState<boolean>(false)

  const [useSmartTone, setUseSmartTone] = useState(true)
  const [selectedTone, setSelectedTone] = useState<string>("supportive")

  // Connections view state
  const [profileUrl, setProfileUrl] = useState("")
  const [isDetectingProfile, setIsDetectingProfile] = useState(false)
  const [profileDetectionError, setProfileDetectionError] = useState<string | null>(null)
  const [profileDetected, setProfileDetected] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [profileFallback, setProfileFallback] = useState(false)

  // Connection tone detection state (simplified since we're combining calls)
  const [useSmartConnectionTone, setUseSmartConnectionTone] = useState(true)
  const [selectedConnectionTone, setSelectedConnectionTone] = useState<string>("friendly")

  // Connection message generation state
  const [connectionMessages, setConnectionMessages] = useState<ConnectionMessage[]>([])
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false)
  const [isGeneratingAnotherMessage, setIsGeneratingAnotherMessage] = useState(false)
  const [messageGenerationError, setMessageGenerationError] = useState<string | null>(null)
  const [messageCopiedStates, setMessageCopiedStates] = useState<boolean[]>([])
  const [messageRateLimitInfo, setMessageRateLimitInfo] = useState<{ retryAfter?: number } | null>(null)

  // Client-side rate limiting state
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitTimeRemaining, setRateLimitTimeRemaining] = useState(0)

  const toneOptions: ToneOption[] = [
    { value: "supportive", label: "Supportive" },
    { value: "curious", label: "Curious" },
    { value: "professional", label: "Professional" },
    { value: "enthusiastic", label: "Enthusiastic" },
    { value: "thoughtful", label: "Thoughtful" },
    { value: "witty", label: "Witty" },
    { value: "casual", label: "Casual" },
    { value: "confident", label: "Confident" },
    { value: "humble", label: "Humble" },
  ]

  const connectionToneOptions: ToneOption[] = [
    { value: "friendly", label: "Friendly" },
    { value: "professional", label: "Professional" },
    { value: "supportive", label: "Supportive" },
    { value: "funny", label: "Funny" },
    { value: "bold", label: "Bold" },
  ]

  const [currentView, setCurrentView] = useState<"comments" | "connections">("comments")

  const detectPlatform = (url: string): string | null => {
    if (!url.trim()) return "LinkedIn"

    // Normalize the URL by removing protocol and www
    const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")

    // Platform detection patterns
    if (normalizedUrl.match(/^(twitter\.com|x\.com)/)) {
      return "Twitter"
    } else if (normalizedUrl.match(/^linkedin\.com/)) {
      return "LinkedIn"
    } else if (normalizedUrl.match(/^instagram\.com/)) {
      return "Instagram"
    }

    return "LinkedIn"
  }

  const parsePostContent = async (url: string) => {
    if (!url.trim()) {
      setPostContent(null)
      setUsedFallback(false)
      setParseError(false)
      return
    }

    setIsParsingPost(true)
    setError(null)
    setParseError(false)

    try {
      const response = await fetch("/api/parse-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.warn("Failed to parse post:", data.error)
        setPostContent(null)
        setUsedFallback(false)
        setParseError(true)
        return
      }

      setPostContent(data.postContent)
      setUsedFallback(data.usedFallback || false)
    } catch (error) {
      console.error("Error parsing post content:", error)
      setPostContent(null)
      setUsedFallback(false)
      setParseError(true)
    } finally {
      setIsParsingPost(false)
    }
  }

  const generateComment = async (
    platform: string,
    url: string,
    postContent: PostContent | null,
    isAdditional = false,
  ) => {
    const setLoadingState = isAdditional ? setIsGeneratingAnother : setIsGenerating
    setLoadingState(true)
    setError(null)
    setRateLimitInfo(null)

    try {
      // Create a custom postContent object if using manual content
      let contentToUse = postContent
      if (useManualContent && manualContent.trim()) {
        contentToUse = {
          title: "Manual Content",
          description: manualContent,
          image: null,
          type: null,
          url: url || "https://linkedin.com",
        }
      }

      const response = await fetch("/api/generate-comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          url,
          postContent: contentToUse,
          existingComments: comments.map((c) => c.text),
          useSmartTone,
          selectedTone: !useSmartTone ? selectedTone : undefined,
        }),
      })

      // Handle rate limiting
      if (response.status === 429) {
        const data = await response.json()
        setRateLimitInfo({ retryAfter: data.retryAfter })
        throw new Error(data.error)
      }

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        console.warn("Comment generation failed with status:", response.status)

        // Try to parse error message if possible
        try {
          const errorData = await response.json()
          throw new Error(errorData.error || "Comment generation failed. Please try again.")
        } catch (jsonError) {
          // If JSON parsing fails, use status text
          throw new Error(`Comment generation failed (${response.status}): ${response.statusText || "Unknown error"}`)
        }
      }

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Comment generation returned non-JSON response")
        throw new Error("Invalid response format. Please try again.")
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        throw new Error("Failed to parse response. Please try again.")
      }

      if (!data.comment || typeof data.comment.text !== "string") {
        console.error("Invalid comment data:", data)
        throw new Error("Invalid comment data received. Please try again.")
      }

      // Update tone analysis if this is the first comment
      if (!isAdditional && data.toneAnalysis) {
        setToneAnalysis(data.toneAnalysis)
      }

      return data.comment
    } catch (error) {
      console.error("Error generating comment:", error)
      setError(error instanceof Error ? error.message : "Comment generation failed. Please try again.")
      return null
    } finally {
      setLoadingState(false)
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setUrl(newUrl)

    const detectedPlatform = detectPlatform(newUrl)
    setPlatform(detectedPlatform || "LinkedIn")
  }

  // Parse post content when URL changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (url && platform) {
        parsePostContent(url)
      } else {
        setPostContent(null)
        setToneAnalysis(null)
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeoutId)
  }, [url, platform])

  const handleGenerateComment = async () => {
    if (!platform) {
      setError("Please enter a valid LinkedIn URL first.")
      return
    }

    if (parseError && !useManualContent && !manualContent.trim()) {
      setError("Please enter post content manually or try another URL.")
      return
    }

    setComments([]) // Clear previous comments when starting fresh
    setToneAnalysis(null) // Clear previous tone analysis

    try {
      const generatedComment = await generateComment(platform, url, postContent, false)

      if (generatedComment) {
        setComments([generatedComment])
      } else {
        setError("No comment was generated. Please try again.")
      }
    } catch (error) {
      console.error("Error generating comment:", error)
      setError(error instanceof Error ? error.message : "Failed to generate comment. Please try again.")
    }
  }

  const handleGenerateAnother = async () => {
    if (!platform) {
      setError("Please enter a valid LinkedIn URL first.")
      return
    }

    try {
      const generatedComment = await generateComment(platform, url, postContent, true)

      if (generatedComment) {
        // Mark additional comments as not recommended (only first is recommended)
        const newComment = { ...generatedComment, isRecommended: false }
        setComments((prev) => [...prev, newComment])
      } else {
        setError("No additional comment was generated. Please try again.")
      }
    } catch (error) {
      console.error("Error generating additional comment:", error)
      setError(error instanceof Error ? error.message : "Failed to generate additional comment. Please try again.")
    }
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error("Failed to copy text:", error)
      // Fallback for older browsers
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

  const validateLinkedInProfileUrl = (url: string): boolean => {
    if (!url.trim()) return false

    // LinkedIn profile URL patterns
    const linkedinProfileRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?(\?.*)?$/

    return linkedinProfileRegex.test(url.trim())
  }

  const handleDetectProfile = async () => {
    setProfileDetectionError(null)
    setProfileDetected(false)
    setProfileData(null)
    setProfileFallback(false)

    if (!validateLinkedInProfileUrl(profileUrl)) {
      setProfileDetectionError("Please enter a valid LinkedIn profile URL.")
      return
    }

    setIsDetectingProfile(true)

    try {
      const response = await fetch("/api/analyze-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: profileUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze profile")
      }

      setProfileData(data.profileData)
      setProfileFallback(data.fallback || false)
      setProfileDetected(true)
      setProfileDetectionError(null)
    } catch (error) {
      console.error("Error analyzing profile:", error)
      setProfileDetectionError(error instanceof Error ? error.message : "Failed to analyze profile. Please try again.")
    } finally {
      setIsDetectingProfile(false)
    }
  }

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case "parsed":
        return "Profile preview"
      case "scraped":
        return "Scraped from page"
      case "fallback":
        return "AI inference"
      default:
        return "Unknown source"
    }
  }

  const checkClientRateLimit = (): boolean => {
    const lastRequestKey = "altreach_last_connection_request"
    const lastRequestTime = localStorage.getItem(lastRequestKey)

    if (lastRequestTime) {
      const timeSinceLastRequest = Date.now() - Number.parseInt(lastRequestTime)
      const rateLimitWindow = 5000 // 5 seconds

      if (timeSinceLastRequest < rateLimitWindow) {
        const timeRemaining = Math.ceil((rateLimitWindow - timeSinceLastRequest) / 1000)
        setIsRateLimited(true)
        setRateLimitTimeRemaining(timeRemaining)

        // Start countdown timer
        const countdownInterval = setInterval(() => {
          setRateLimitTimeRemaining((prev) => {
            if (prev <= 1) {
              setIsRateLimited(false)
              clearInterval(countdownInterval)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        return false // Rate limited
      }
    }

    // Update last request time
    localStorage.setItem(lastRequestKey, Date.now().toString())
    return true // Not rate limited
  }

  const generateConnectionMessage = async (isAdditional = false) => {
    // Check client-side rate limiting first
    if (!checkClientRateLimit()) {
      setMessageGenerationError(
        `Please wait ${rateLimitTimeRemaining} second${rateLimitTimeRemaining !== 1 ? "s" : ""} before generating another message.`,
      )
      return
    }

    const setLoadingState = isAdditional ? setIsGeneratingAnotherMessage : setIsGeneratingMessage
    setLoadingState(true)
    setMessageGenerationError(null)
    setMessageRateLimitInfo(null)
    setIsRateLimited(false) // Clear any existing rate limit state

    try {
      const response = await fetch("/api/generate-connection-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileData,
          useSmartTone: useSmartConnectionTone,
          manualTone: !useSmartConnectionTone ? selectedConnectionTone : undefined,
          profileUrl,
          existingMessages: connectionMessages.map((msg) => msg.text), // Pass existing messages to avoid repetition
        }),
      })

      // Handle rate limiting
      if (response.status === 429) {
        let data
        try {
          data = await response.json()
        } catch (jsonError) {
          console.error("Failed to parse rate limit response:", jsonError)
          throw new Error("Rate limit active. Please wait a moment before trying again.")
        }
        setMessageRateLimitInfo({ retryAfter: data.retryAfter })
        throw new Error(data.error)
      }

      if (!response.ok) {
        let errorMessage = "Failed to generate message"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (jsonError) {
          console.error("Failed to parse error response:", jsonError)
          // Try to get error from response text
          try {
            const errorText = await response.text()
            if (errorText && errorText.length < 200) {
              errorMessage = errorText
            }
          } catch (textError) {
            console.error("Failed to get error text:", textError)
          }
        }
        throw new Error(errorMessage)
      }

      // Check if response is actually JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Non-JSON response received:", contentType)
        throw new Error("Invalid response format. Please try again.")
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        throw new Error("Failed to parse response. Please try again.")
      }

      // Validate response data
      if (!data.message || typeof data.message !== "string") {
        console.error("Invalid response data:", data)
        throw new Error("Invalid response data. Please try again.")
      }

      // Create new connection message object
      const newMessage: ConnectionMessage = {
        text: data.message,
        suggestedTone: data.suggestedTone || "Professional but warm",
        characterCount: data.characterCount || data.message.length,
      }

      // Append the new message
      setConnectionMessages((prev) => [...prev, newMessage])
      setMessageCopiedStates((prev) => [...prev, false])
      setMessageGenerationError(null)
    } catch (error) {
      console.error("Error generating connection message:", error)
      setMessageGenerationError(error instanceof Error ? error.message : "Couldn't generate message. Please try again.")
    } finally {
      setLoadingState(false)
    }
  }

  const copyConnectionMessage = async (messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(connectionMessages[messageIndex].text)
      setMessageCopiedStates((prev) => prev.map((state, index) => (index === messageIndex ? true : state)))
      setTimeout(() => {
        setMessageCopiedStates((prev) => prev.map((state, index) => (index === messageIndex ? false : state)))
      }, 2000)
    } catch (error) {
      console.error("Failed to copy message:", error)
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = connectionMessages[messageIndex].text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setMessageCopiedStates((prev) => prev.map((state, index) => (index === messageIndex ? true : state)))
      setTimeout(() => {
        setMessageCopiedStates((prev) => prev.map((state, index) => (index === messageIndex ? false : state)))
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-slate-900 transition-colors duration-200">
      {/* Brand Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#3B82F6]" />
            <h1 className="text-xl font-bold text-[#1E293B] dark:text-white">Altreach</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* View Toggle */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setCurrentView("comments")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                currentView === "comments"
                  ? "border-[#3B82F6] text-[#3B82F6] bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              Comments
            </button>
            <button
              onClick={() => setCurrentView("connections")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                currentView === "connections"
                  ? "border-[#3B82F6] text-[#3B82F6] bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              Connections
            </button>
          </div>
        </div>
      </div>

      <main className="py-8 px-4 sm:py-12">
        <div className="container max-w-3xl mx-auto">
          {currentView === "comments" ? (
            // Existing Comments UI
            <Card className="shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
              <CardHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-2xl font-bold text-[#1E293B] dark:text-white">
                  Smart LinkedIn Comments
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Generate engaging comments with AI-powered tone analysis
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* URL Input */}
                <div className="space-y-2">
                  <label htmlFor="url" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                    LinkedIn Post URL
                  </label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="url"
                      placeholder="https://linkedin.com/posts/example"
                      value={url}
                      onChange={handleUrlChange}
                      className="pl-10 h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#3B82F6] dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  {isParsingPost && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analyzing post...
                    </div>
                  )}
                </div>

                {/* Parse Error Alert */}
                {parseError && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="text-red-600 dark:text-red-400">
                      Couldn't analyze that post. Try another one or paste the content manually.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Manual Content Input */}
                {(parseError || useManualContent) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="manual-content"
                        className="text-sm font-medium text-[#1E293B] dark:text-slate-300"
                      >
                        Post Content
                      </label>
                      <Switch
                        id="use-manual"
                        checked={useManualContent}
                        onCheckedChange={setUseManualContent}
                        className="data-[state=checked]:bg-[#3B82F6]"
                      />
                    </div>
                    <Textarea
                      id="manual-content"
                      placeholder="Paste the LinkedIn post content here..."
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      className="min-h-[100px] border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#3B82F6] dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}

                {/* Post Preview */}
                {postContent && !useManualContent && (
                  <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {postContent.image && (
                          <div className="flex-shrink-0">
                            <img
                              src={postContent.image || "/placeholder.svg"}
                              alt="Post preview"
                              className="w-16 h-16 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = "none"
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {usedFallback ? "Text Scraped" : "Post Preview"}
                            </Badge>
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </div>
                          {postContent.title && (
                            <h4 className="font-medium text-[#1E293B] dark:text-white text-sm line-clamp-2 mb-1">
                              {postContent.title}
                            </h4>
                          )}
                          {postContent.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-2">
                              {postContent.description}
                            </p>
                          )}
                          {postContent.fallbackContent && (
                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">
                                Extracted Content:
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-400 line-clamp-4">
                                {postContent.fallbackContent}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Tone Selection */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-[#3B82F6]" />
                        <h4 className="text-sm font-semibold text-[#1E293B] dark:text-white">Comment Tone</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 dark:text-blue-400">Smart Tone</span>
                        <Switch
                          checked={useSmartTone}
                          onCheckedChange={setUseSmartTone}
                          className="data-[state=checked]:bg-[#3B82F6]"
                        />
                      </div>
                    </div>

                    {useSmartTone ? (
                      // AI-determined tone display
                      toneAnalysis ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-medium text-[#1E293B] dark:text-white">
                              {toneAnalysis.recommendedTone}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                            >
                              Auto-Generated
                            </Badge>
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{toneAnalysis.reasoning}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                          AI will determine the optimal tone based on the post content
                        </p>
                      )
                    ) : (
                      // Manual tone selection
                      <div className="flex flex-col gap-1">
                        <Select value={selectedTone} onValueChange={setSelectedTone}>
                          <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800">
                            <SelectValue placeholder="Select a tone" />
                          </SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((tone) => (
                              <SelectItem key={tone.value} value={tone.value}>
                                {tone.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Manually select the tone for your comment
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full h-12 text-base font-semibold bg-[#3B82F6] hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg"
                  onClick={handleGenerateComment}
                  disabled={isGenerating || (!url && !useManualContent)}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Generate Comment
                    </>
                  )}
                </Button>

                {/* Rate Limit Warning */}
                {rateLimitInfo && rateLimitInfo.retryAfter && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        <span className="font-medium">Rate limit active:</span> Please wait {rateLimitInfo.retryAfter}{" "}
                        second
                        {rateLimitInfo.retryAfter !== 1 ? "s" : ""} before trying again.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                {/* Comments Section */}
                {comments.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">Generated Comment</h3>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {comments.length} comment{comments.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {comments.map((comment, index) => (
                        <div
                          key={index}
                          className={`relative p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                            comment.isRecommended
                              ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          {comment.isRecommended && (
                            <div className="flex items-center gap-2 mb-3">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs">
                                AI Recommended
                              </Badge>
                            </div>
                          )}
                          <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed pr-12 text-base">
                            {comment.text}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
                            onClick={() => copyToClipboard(comment.text, index)}
                          >
                            {copied === index ? (
                              <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                            ) : (
                              <Copy className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            )}
                            <span className="sr-only">Copy comment</span>
                          </Button>
                          {copied === index && (
                            <div className="absolute top-4 right-16 bg-green-600 text-white text-xs px-2 py-1 rounded-md animate-in fade-in duration-200">
                              Copied!
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Generate Another Button */}
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={handleGenerateAnother}
                        disabled={isGeneratingAnother}
                        className="h-10 px-5 text-sm border-2 border-[#3B82F6] text-[#3B82F6] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 rounded-lg"
                      >
                        {isGeneratingAnother ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Another...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Generate Another Comment
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-slate-100 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Powered by Altreach AI • © 2025 Altreach
              </CardFooter>
            </Card>
          ) : (
            // Connections UI
            <Card className="shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
              <CardHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-2xl font-bold text-[#1E293B] dark:text-white">
                  Smart LinkedIn Connections
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Generate personalized connection requests that get accepted
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* Profile URL Input */}
                <div className="space-y-2">
                  <label htmlFor="profile-url" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
                    LinkedIn Profile URL
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Linkedin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="profile-url"
                        placeholder="https://linkedin.com/in/username"
                        value={profileUrl}
                        onChange={(e) => setProfileUrl(e.target.value)}
                        className="pl-10 h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#3B82F6] dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <Button
                      onClick={handleDetectProfile}
                      disabled={isDetectingProfile || !profileUrl.trim()}
                      className="h-11 px-6 bg-[#3B82F6] hover:bg-blue-600 text-white font-medium rounded-lg transition-all duration-200"
                    >
                      {isDetectingProfile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Detect Profile"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Profile Detection Error */}
                {profileDetectionError && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  >
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="text-red-600 dark:text-red-400">
                      {profileDetectionError}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Profile Detected Success */}
                {profileDetected && !profileFallback && (
                  <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-600 dark:text-green-400">
                      <span className="font-medium">Profile detected and analyzed successfully.</span>
                      {profileData?.recentPosts && profileData.recentPosts.length > 0 && (
                        <span> Found {profileData.recentPosts.length} recent posts.</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Profile Fallback Warning */}
                {profileDetected && profileFallback && (
                  <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-600 dark:text-amber-400">
                      <span className="font-medium">Profile content could not be extracted.</span> AI will infer from
                      URL.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Profile Preview */}
                {profileDetected && profileData && (
                  <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-[#3B82F6]" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {getSourceLabel(profileData.source)}
                            </Badge>
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </div>
                          {profileData.name && (
                            <h4 className="font-medium text-[#1E293B] dark:text-white text-base mb-1">
                              {profileData.name}
                            </h4>
                          )}
                          {profileData.headline && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{profileData.headline}</p>
                          )}
                          {profileData.company && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              <span className="font-medium">Company:</span> {profileData.company}
                            </p>
                          )}
                          {profileData.education && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              <span className="font-medium">Education:</span> {profileData.education}
                            </p>
                          )}
                          {profileData.location && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              <span className="font-medium">Location:</span> {profileData.location}
                            </p>
                          )}
                          {profileData.connections && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                              <span className="font-medium">Network:</span> {profileData.connections} connections
                            </p>
                          )}

                          {/* Recent Posts Section */}
                          {profileData.recentPosts && profileData.recentPosts.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                  Recent Activity
                                </span>
                              </div>
                              <div className="space-y-2">
                                {profileData.recentPosts.slice(0, 2).map((post, index) => (
                                  <div
                                    key={index}
                                    className="bg-white dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h5 className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                                        {post.title}
                                      </h5>
                                      {post.date && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                          {post.date}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                      {post.snippet}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!profileData.name && !profileData.headline && !profileData.company && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                              Profile content will be inferred by AI
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Connection Tone Selection */}
                {profileDetected && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-[#3B82F6]" />
                          <h4 className="text-sm font-semibold text-[#1E293B] dark:text-white">Connection Tone</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-700 dark:text-blue-400">Smart Tone</span>
                          <Switch
                            checked={useSmartConnectionTone}
                            onCheckedChange={setUseSmartConnectionTone}
                            className="data-[state=checked]:bg-[#3B82F6]"
                          />
                        </div>
                      </div>

                      {useSmartConnectionTone ? (
                        // AI-determined tone display
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                            AI will determine the optimal tone and generate the message together
                          </p>
                        </div>
                      ) : (
                        // Manual tone selection
                        <div className="flex flex-col gap-1">
                          <Select value={selectedConnectionTone} onValueChange={setSelectedConnectionTone}>
                            <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800">
                              <SelectValue placeholder="Select a tone" />
                            </SelectTrigger>
                            <SelectContent>
                              {connectionToneOptions.map((tone) => (
                                <SelectItem key={tone.value} value={tone.value}>
                                  {tone.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Manually select the tone for your connection request
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Generate Message Button */}
                {profileDetected && (
                  <div className="space-y-4">
                    <Button
                      onClick={() => generateConnectionMessage(false)}
                      disabled={isGeneratingMessage || isRateLimited}
                      className="w-full h-12 text-base font-semibold bg-[#3B82F6] hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg"
                    >
                      {isGeneratingMessage ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Creating message...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-5 w-5" />
                          Generate Connection Message
                        </>
                      )}
                    </Button>

                    {/* Rate Limit Warning */}
                    {messageRateLimitInfo && messageRateLimitInfo.retryAfter && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <span className="font-medium">Rate limit active:</span> Please wait{" "}
                            {messageRateLimitInfo.retryAfter} second{messageRateLimitInfo.retryAfter !== 1 ? "s" : ""}{" "}
                            before trying again.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Client-side Rate Limit Warning */}
                    {isRateLimited && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          <p className="text-sm text-orange-800 dark:text-orange-300">
                            <span className="font-medium">Please wait:</span> You can generate another message in{" "}
                            {rateLimitTimeRemaining} second{rateLimitTimeRemaining !== 1 ? "s" : ""}.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Message Generation Error */}
                    {messageGenerationError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                        {messageGenerationError}
                      </div>
                    )}

                    {/* Generated Messages */}
                    {connectionMessages.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">Generated Messages</h3>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {connectionMessages.length} message{connectionMessages.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>

                        <div className="space-y-4">
                          {connectionMessages.map((message, index) => (
                            <Card
                              key={index}
                              className={`${
                                index === 0
                                  ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800"
                                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                              } rounded-lg overflow-hidden`}
                            >
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-2">
                                    {index === 0 && (
                                      <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        AI Recommended
                                      </Badge>
                                    )}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      index === 0
                                        ? "text-green-700 dark:text-green-400 border-green-300 dark:border-green-600"
                                        : "text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                                    }`}
                                  >
                                    {message.characterCount}/300 characters
                                  </Badge>
                                </div>

                                {/* Display suggested tone */}
                                <div className="mb-3">
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Suggested Tone:</p>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                                  >
                                    {message.suggestedTone}
                                  </Badge>
                                </div>

                                <div className="relative">
                                  <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed text-base mb-4 pr-12">
                                    {message.text}
                                  </p>

                                  <Button
                                    onClick={() => copyConnectionMessage(index)}
                                    variant="ghost"
                                    size="icon"
                                    className={`absolute top-3 right-3 h-8 w-8 ${
                                      index === 0
                                        ? "text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20"
                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                    }`}
                                    title={messageCopiedStates[index] ? "Copied!" : "Copy message"}
                                  >
                                    {messageCopiedStates[index] ? (
                                      <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Generate Another Button */}
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            onClick={() => generateConnectionMessage(true)}
                            disabled={isGeneratingAnotherMessage || isRateLimited}
                            className="h-10 px-5 text-sm border-2 border-[#3B82F6] text-[#3B82F6] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 rounded-lg"
                          >
                            {isGeneratingAnotherMessage ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Another...
                              </>
                            ) : (
                              <>
                                <Plus className="mr-2 h-4 w-4" />
                                Generate Another Message
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t border-slate-100 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Powered by Altreach AI • © 2025 Altreach
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
