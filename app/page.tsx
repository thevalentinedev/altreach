"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Check, Copy, Loader2, Star, ExternalLink, Clock, Plus, Zap, AlertCircle, Linkedin } from "lucide-react"
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

      <main className="py-8 px-4 sm:py-12">
        <div className="container max-w-3xl mx-auto">
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
                    <label htmlFor="manual-content" className="text-sm font-medium text-[#1E293B] dark:text-slate-300">
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
        </div>
      </main>
    </div>
  )
}
