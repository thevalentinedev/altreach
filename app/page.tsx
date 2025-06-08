"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Check,
  Copy,
  Loader2,
  ExternalLink,
  Clock,
  Plus,
  Zap,
  AlertCircle,
  Linkedin,
  User,
  MessageSquare,
  Info,
  Twitter,
  Sparkles,
  Bell,
  Instagram,
  Facebook,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import TwitterInput from "@/components/twitter/twitter-input"

// Platform types
type Platform = "linkedin" | "twitter" | "instagram" | "facebook"
type LinkedInView = "comments" | "connections"

// Existing interfaces
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

interface ConnectionMessage {
  text: string
  suggestedTone: string
  characterCount: number
}

// Platform Selector Component
const PlatformSelector = ({
  selectedPlatform,
  onPlatformChange,
}: {
  selectedPlatform: Platform
  onPlatformChange: (platform: Platform) => void
}) => {
  const platforms = [
    { id: "linkedin" as Platform, name: "LinkedIn", icon: Linkedin, color: "text-[#0A66C2]" },
    { id: "twitter" as Platform, name: "Twitter", icon: Twitter, color: "text-[#1DA1F2]" },
    { id: "instagram" as Platform, name: "Instagram", icon: Instagram, color: "text-[#E4405F]" },
    { id: "facebook" as Platform, name: "Facebook", icon: Facebook, color: "text-[#1877F2]" },
  ]

  const selectedIndex = platforms.findIndex((p) => p.id === selectedPlatform)

  return (
    <div className="flex items-center justify-center mb-6 sm:mb-8">
      <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner w-full max-w-md">
        <div className="flex relative">
          {/* Background slider */}
          <div
            className="absolute top-1 bottom-1 bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-transform duration-300 ease-out"
            style={{
              width: `${100 / platforms.length}%`,
              transform: `translateX(${selectedIndex * 100}%)`,
            }}
          />

          {/* Platform Buttons */}
          {platforms.map((platform) => {
            const IconComponent = platform.icon
            const isSelected = selectedPlatform === platform.id

            return (
              <button
                key={platform.id}
                onClick={() => {
                  onPlatformChange(platform.id)
                }}
                className={`relative z-10 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex-1 min-h-[48px] touch-manipulation ${
                  isSelected
                    ? `${platform.color} dark:text-blue-400`
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
                aria-pressed={isSelected}
              >
                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">{platform.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// LinkedIn View Toggle Component
const LinkedInViewToggle = ({
  currentView,
  onViewChange,
}: {
  currentView: LinkedInView
  onViewChange: (view: LinkedInView) => void
}) => {
  return (
    <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex">
          <button
            onClick={() => onViewChange("comments")}
            className={`px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition-colors duration-200 flex-1 sm:flex-initial min-h-[48px] touch-manipulation ${
              currentView === "comments"
                ? "border-[#3B82F6] text-[#3B82F6] bg-blue-50/50 dark:bg-blue-900/10"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => onViewChange("connections")}
            className={`px-4 sm:px-6 py-4 text-sm font-medium border-b-2 transition-colors duration-200 flex-1 sm:flex-initial min-h-[48px] touch-manipulation ${
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
  )
}

// Twitter Coming Soon Component
const TwitterComingSoon = () => {
  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Twitter className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-[#1E293B] dark:text-white mb-3">Twitter Support Coming Soon</h2>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            We're working hard to bring you AI-powered Twitter engagement tools. Get ready for smart tweet replies and
            connection features!
          </p>

          {/* Features Preview */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Smart Tweet Replies</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
              <span>Engagement Analytics</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Thread Generation</span>
            </div>
          </div>

          {/* Notify Button */}
          <Button
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium h-11 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            disabled
          >
            <Bell className="mr-2 h-4 w-4" />
            Notify Me When Ready
          </Button>

          {/* Status Badge */}
          <div className="mt-6">
            <Badge
              variant="secondary"
              className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              In Development
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Instagram Coming Soon Component
const InstagramComingSoon = () => {
  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Instagram className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-[#1E293B] dark:text-white mb-3">Instagram Support Coming Soon</h2>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            We're crafting AI-powered Instagram engagement tools to help you create authentic comments and build
            meaningful connections with your audience.
          </p>

          {/* Features Preview */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
              <span>Smart Story Replies</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Authentic Comments</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Hashtag Optimization</span>
            </div>
          </div>

          {/* Notify Button */}
          <Button
            className="w-full bg-gradient-to-r from-pink-600 via-red-600 to-orange-600 hover:from-pink-700 hover:via-red-700 hover:to-orange-700 text-white font-medium h-11 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            disabled
          >
            <Bell className="mr-2 h-4 w-4" />
            Notify Me When Ready
          </Button>

          {/* Status Badge */}
          <div className="mt-6">
            <Badge
              variant="secondary"
              className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              In Development
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Facebook Coming Soon Component
const FacebookComingSoon = () => {
  return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
              <Facebook className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-[#1E293B] dark:text-white mb-3">Facebook Support Coming Soon</h2>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Get ready for intelligent Facebook engagement tools that help you connect with your community through
            thoughtful comments and meaningful interactions.
          </p>

          {/* Features Preview */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Group Engagement</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span>Page Comments</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Community Building</span>
            </div>
          </div>

          {/* Notify Button */}
          <Button
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium h-11 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            disabled
          >
            <Bell className="mr-2 h-4 w-4" />
            Notify Me When Ready
          </Button>

          {/* Status Badge */}
          <div className="mt-6">
            <Badge
              variant="secondary"
              className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              In Development
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Content Wrapper with Animation
const AnimatedContent = ({
  children,
  isVisible,
}: {
  children: React.ReactNode
  isVisible: boolean
}) => {
  return (
    <div
      className={`transition-all duration-500 ease-in-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none absolute inset-0"
      }`}
    >
      {children}
    </div>
  )
}

export default function HomePage() {
  // Platform state
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("linkedin")

  // LinkedIn state (existing state variables)
  const [url, setUrl] = useState("")
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
  const [profileAnalysisMessage, setProfileAnalysisMessage] = useState<string>("")

  const [useSmartConnectionTone, setUseSmartConnectionTone] = useState(true)
  const [selectedConnectionTone, setSelectedConnectionTone] = useState<string>("friendly")

  const [connectionMessages, setConnectionMessages] = useState<ConnectionMessage[]>([])
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false)
  const [isGeneratingAnotherMessage, setIsGeneratingAnotherMessage] = useState(false)
  const [messageGenerationError, setMessageGenerationError] = useState<string | null>(null)
  const [messageCopiedStates, setMessageCopiedStates] = useState<boolean[]>([])
  const [messageRateLimitInfo, setMessageRateLimitInfo] = useState<{ retryAfter?: number } | null>(null)

  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitTimeRemaining, setRateLimitTimeRemaining] = useState(0)

  const [currentLinkedInView, setCurrentLinkedInView] = useState<LinkedInView>("comments")
  const [currentView, setCurrentView] = useState<"comments" | "create" | "hashtags">("comments")

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

  // Existing functions (keeping all the original logic)
  const detectPlatform = (url: string): string | null => {
    if (!url.trim()) return "LinkedIn"

    const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")

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

      if (response.status === 429) {
        const data = await response.json()
        setRateLimitInfo({ retryAfter: data.retryAfter })
        throw new Error(data.error)
      }

      if (!response.ok) {
        console.warn("Comment generation failed with status:", response.status)
        try {
          const errorData = await response.json()
          throw new Error(errorData.error || "Comment generation failed. Please try again.")
        } catch (jsonError) {
          throw new Error(`Comment generation failed (${response.status}): ${response.statusText || "Unknown error"}`)
        }
      }

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
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (url) {
        parsePostContent(url)
      } else {
        setPostContent(null)
        setToneAnalysis(null)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [url])

  const handleGenerateComment = async () => {
    if (parseError && !useManualContent && !manualContent.trim()) {
      setError("Please enter post content manually or try another URL.")
      return
    }

    setComments([])
    setToneAnalysis(null)

    try {
      const generatedComment = await generateComment("LinkedIn", url, postContent, false)

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
    try {
      const generatedComment = await generateComment("LinkedIn", url, postContent, true)

      if (generatedComment) {
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
    const linkedinProfileRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?(\?.*)?$/
    return linkedinProfileRegex.test(url.trim())
  }

  const handleDetectProfile = async () => {
    setProfileDetectionError(null)
    setProfileDetected(false)
    setProfileData(null)
    setProfileFallback(false)
    setProfileAnalysisMessage("")

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
      setProfileAnalysisMessage(data.message || "Profile analyzed successfully.")
      setProfileDetectionError(null)
    } catch (error) {
      console.error("Error analyzing profile:", error)

      const fallbackProfileData: ProfileData = {
        name: null,
        headline: null,
        source: "fallback",
        recentPosts: [],
      }

      setProfileData(fallbackProfileData)
      setProfileFallback(true)
      setProfileDetected(true)
      setProfileAnalysisMessage("Profile will be analyzed by AI from the URL.")
      setProfileDetectionError(null)
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
      const rateLimitWindow = 5000

      if (timeSinceLastRequest < rateLimitWindow) {
        const timeRemaining = Math.ceil((rateLimitWindow - timeSinceLastRequest) / 1000)
        setIsRateLimited(true)
        setRateLimitTimeRemaining(timeRemaining)

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

        return false
      }
    }

    localStorage.setItem(lastRequestKey, Date.now().toString())
    return true
  }

  const generateConnectionMessage = async (isAdditional = false) => {
    console.log("🚀 Starting connection message generation...")

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
    setIsRateLimited(false)

    try {
      console.log("📤 Sending request to API...")

      const requestBody = {
        profileData,
        useSmartTone: useSmartConnectionTone,
        manualTone: !useSmartConnectionTone ? selectedConnectionTone : undefined,
        profileUrl,
        existingMessages: connectionMessages.map((msg) => msg.text),
      }

      const response = await fetch("/api/generate-connection-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      if (response.status === 429) {
        let data
        try {
          const responseText = await response.text()
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error("Failed to parse rate limit response:", parseError)
          throw new Error("Rate limit active. Please wait a moment before trying again.")
        }
        setMessageRateLimitInfo({ retryAfter: data.retryAfter })
        throw new Error(data.error || "Rate limit active. Please wait before trying again.")
      }

      if (!response.ok) {
        let errorMessage = `Failed to generate message (${response.status})`

        try {
          const responseText = await response.text()

          if (!responseText) {
            throw new Error("Empty response")
          }

          try {
            const errorData = JSON.parse(responseText)
            errorMessage = errorData.error || errorMessage
          } catch (jsonError) {
            if (responseText.length < 200 && !responseText.includes("<")) {
              errorMessage = responseText
            } else {
              errorMessage = `Server error (${response.status}). Please try again.`
            }
          }
        } catch (textError) {
          console.error("Failed to get error response:", textError)
          errorMessage = `Network error (${response.status}). Please try again.`
        }

        throw new Error(errorMessage)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Non-JSON response received:", contentType)
        throw new Error("Invalid response format. Please try again.")
      }

      let data
      try {
        const responseText = await response.text()
        data = JSON.parse(responseText)
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError)
        throw new Error("Failed to parse response. Please try again.")
      }

      if (!data || typeof data !== "object") {
        console.error("Invalid response data:", data)
        throw new Error("Invalid response data. Please try again.")
      }

      if (!data.message || typeof data.message !== "string") {
        console.error("Missing or invalid message in response:", data)
        throw new Error("No message generated. Please try again.")
      }

      const newMessage: ConnectionMessage = {
        text: data.message,
        suggestedTone: data.suggestedTone || "Professional but warm",
        characterCount: data.characterCount || data.message.length,
      }

      setConnectionMessages((prev) => [...prev, newMessage])
      setMessageCopiedStates((prev) => [...prev, false])
      setMessageGenerationError(null)
    } catch (error) {
      console.error("❌ Error generating connection message:", error)

      let userMessage = "Couldn't generate message. Please try again."

      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          userMessage = "Network error. Please check your connection and try again."
        } else if (error.message.includes("Rate limit")) {
          userMessage = error.message
        } else if (error.message.includes("Invalid response")) {
          userMessage = "Service temporarily unavailable. Please try again in a moment."
        } else if (error.message.length < 100) {
          userMessage = error.message
        }
      }

      setMessageGenerationError(userMessage)
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

  useEffect(() => {
    if (profileUrl.trim()) {
      const isValid = validateLinkedInProfileUrl(profileUrl)
      if (isValid && profileDetectionError) {
        setProfileDetectionError(null)
      }
    }
  }, [profileUrl, profileDetectionError])

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-slate-900 transition-colors duration-200">
      {/* Brand Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#1E293B] dark:text-white">Altreach</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="py-6 px-4 sm:py-8 sm:px-4 lg:py-12">
        <div className="container max-w-5xl mx-auto">
          {/* Platform Selector */}
          <PlatformSelector
            selectedPlatform={selectedPlatform}
            onPlatformChange={(platform) => {
              setSelectedPlatform(platform)
              setCurrentView("comments")
            }}
          />

          {/* Content Area with Animation */}
          <div className="relative">
            {/* LinkedIn Content */}
            <AnimatedContent isVisible={selectedPlatform === "linkedin"}>
              <div>
                {/* LinkedIn View Toggle */}
                <LinkedInViewToggle currentView={currentLinkedInView} onViewChange={setCurrentLinkedInView} />

                {/* LinkedIn Content */}
                <div className="mt-0">
                  {currentLinkedInView === "comments" ? (
                    // Comments UI
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
                                <span className="font-medium">Rate limit active:</span> Please wait{" "}
                                {rateLimitInfo.retryAfter} second
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
                              <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">
                                Generated Comment
                              </h3>
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
                                  <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed pr-12">
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
                            <Button
                              variant="outline"
                              className="w-full border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={handleGenerateAnother}
                              disabled={isGeneratingAnother}
                            >
                              {isGeneratingAnother ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Generate Another Comment
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    // Connections UI
                    <Card className="shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
                      <CardHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-2xl font-bold text-[#1E293B] dark:text-white">
                          Connection Messages
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400">
                          Generate personalized LinkedIn connection requests
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-6 pt-6">
                        {/* Profile URL Input */}
                        <div className="space-y-2">
                          <label
                            htmlFor="profile-url"
                            className="text-sm font-medium text-[#1E293B] dark:text-slate-300"
                          >
                            LinkedIn Profile URL
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              id="profile-url"
                              placeholder="https://linkedin.com/in/username"
                              value={profileUrl}
                              onChange={(e) => setProfileUrl(e.target.value)}
                              className="pl-10 h-11 border-slate-200 dark:border-slate-700 rounded-lg focus-visible:ring-[#3B82F6] dark:bg-slate-800 dark:text-white"
                            />
                          </div>
                          {profileDetectionError && (
                            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3 w-3" />
                              {profileDetectionError}
                            </div>
                          )}
                        </div>

                        {/* Analyze Profile Button */}
                        <Button
                          className="w-full h-12 text-base font-semibold bg-[#3B82F6] hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg"
                          onClick={handleDetectProfile}
                          disabled={isDetectingProfile || !profileUrl.trim()}
                        >
                          {isDetectingProfile ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Analyzing Profile...
                            </>
                          ) : (
                            <>
                              <User className="mr-2 h-5 w-5" />
                              Analyze Profile
                            </>
                          )}
                        </Button>

                        {/* Profile Preview */}
                        {profileDetected && profileData && (
                          <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                                    >
                                      {getSourceLabel(profileData.source)}
                                    </Badge>
                                  </div>
                                  {profileData.name ? (
                                    <h4 className="font-medium text-[#1E293B] dark:text-white text-sm mb-1">
                                      {profileData.name}
                                    </h4>
                                  ) : (
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1"></div>
                                  )}
                                  {profileData.headline ? (
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                      {profileData.headline}
                                    </p>
                                  ) : (
                                    <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2"></div>
                                  )}

                                  {profileFallback && (
                                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                      <div className="flex items-center gap-2">
                                        <Info className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                          {profileAnalysisMessage}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Tone Selection */}
                        {profileDetected && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-5 w-5 text-[#3B82F6]" />
                                  <h4 className="text-sm font-semibold text-[#1E293B] dark:text-white">Message Tone</h4>
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

                              {!useSmartConnectionTone && (
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
                                    Manually select the tone for your connection message
                                  </p>
                                </div>
                              )}

                              {useSmartConnectionTone && (
                                <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                                  AI will determine the optimal tone based on the profile
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Generate Message Button */}
                        {profileDetected && (
                          <Button
                            className="w-full h-12 text-base font-semibold bg-[#3B82F6] hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg rounded-lg"
                            onClick={() => generateConnectionMessage(false)}
                            disabled={isGeneratingMessage || isRateLimited}
                          >
                            {isGeneratingMessage ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Generating...
                              </>
                            ) : isRateLimited ? (
                              <>
                                <Clock className="mr-2 h-5 w-5" />
                                Wait {rateLimitTimeRemaining}s...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="mr-2 h-5 w-5" />
                                Generate Connection Message
                              </>
                            )}
                          </Button>
                        )}

                        {/* Rate Limit Warning */}
                        {messageRateLimitInfo && messageRateLimitInfo.retryAfter && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                <span className="font-medium">Rate limit active:</span> Please wait{" "}
                                {messageRateLimitInfo.retryAfter} second
                                {messageRateLimitInfo.retryAfter !== 1 ? "s" : ""} before trying again.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {messageGenerationError && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                            {messageGenerationError}
                          </div>
                        )}

                        {/* Generated Messages */}
                        {connectionMessages.length > 0 && (
                          <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">
                                Generated Messages
                              </h3>
                              <Badge
                                variant="secondary"
                                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                              >
                                {connectionMessages.length} message{connectionMessages.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>

                            <div className="space-y-4">
                              {connectionMessages.map((message, index) => (
                                <div
                                  key={index}
                                  className="relative p-5 rounded-xl border-2 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 hover:shadow-md"
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                                    >
                                      {message.suggestedTone}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                                    >
                                      {message.characterCount} characters
                                    </Badge>
                                  </div>
                                  <p className="text-[#1E293B] dark:text-slate-100 leading-relaxed pr-12">
                                    {message.text}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
                                    onClick={() => copyConnectionMessage(index)}
                                  >
                                    {messageCopiedStates[index] ? (
                                      <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                                    ) : (
                                      <Copy className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                    )}
                                    <span className="sr-only">Copy message</span>
                                  </Button>
                                  {messageCopiedStates[index] && (
                                    <div className="absolute top-4 right-16 bg-green-600 text-white text-xs px-2 py-1 rounded-md animate-in fade-in duration-200">
                                      Copied!
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Generate Another Button */}
                            <Button
                              variant="outline"
                              className="w-full border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => generateConnectionMessage(true)}
                              disabled={isGeneratingAnotherMessage || isRateLimited}
                            >
                              {isGeneratingAnotherMessage ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Generating...
                                </>
                              ) : isRateLimited ? (
                                <>
                                  <Clock className="mr-2 h-4 w-4" />
                                  Wait {rateLimitTimeRemaining}s...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Generate Another Message
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </AnimatedContent>

            {/* Twitter Content */}
            <AnimatedContent isVisible={selectedPlatform === "twitter"}>
              <TwitterInput currentView={currentView} setCurrentView={setCurrentView} />
            </AnimatedContent>

            {/* Instagram Content */}
            <AnimatedContent isVisible={selectedPlatform === "instagram"}>
              <InstagramComingSoon />
            </AnimatedContent>

            {/* Facebook Content */}
            <AnimatedContent isVisible={selectedPlatform === "facebook"}>
              <FacebookComingSoon />
            </AnimatedContent>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-md flex items-center justify-center">
                <Zap className="h-3 w-3 text-white" />
              </div>
              <p className="text-sm font-medium text-[#1E293B] dark:text-white">Altreach</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} Altreach. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
