"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Sparkles, ImageIcon, Copy, CheckCircle, RefreshCw, Wand2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface HashtagAIModalProps {
  isOpen: boolean
  onClose: () => void
  hashtag: string
  category: "trending" | "top" | "longest"
}

interface GeneratedContent {
  content: string
  tone: string
  style: string
  length: string
  hashtags: string[]
}

export default function HashtagAIModal({ isOpen, onClose, hashtag, category }: HashtagAIModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [copiedContent, setCopiedContent] = useState(false)

  // Auto-determine optimal settings based on hashtag and category
  const getOptimalSettings = (hashtag: string, category: string) => {
    const hashtagLower = hashtag.toLowerCase()

    // Determine tone based on hashtag content
    let tone = "engaging"
    if (hashtagLower.includes("breaking") || hashtagLower.includes("news")) {
      tone = "informative"
    } else if (hashtagLower.includes("funny") || hashtagLower.includes("meme")) {
      tone = "humorous"
    } else if (hashtagLower.includes("motivat") || hashtagLower.includes("inspir")) {
      tone = "inspirational"
    } else if (category === "trending") {
      tone = "exciting"
    }

    // Determine style based on category
    let style = "social-media"
    if (category === "top") {
      style = "viral"
    } else if (category === "longest") {
      style = "conversational"
    }

    // Determine length based on hashtag type
    let length = "medium"
    if (hashtagLower.includes("thread") || hashtagLower.includes("story")) {
      length = "longer"
    } else if (hashtagLower.includes("quick") || hashtagLower.includes("tip")) {
      length = "shorter"
    }

    return { tone, style, length }
  }

  const generateContent = async () => {
    setIsGenerating(true)
    try {
      const settings = getOptimalSettings(hashtag, category)

      const response = await fetch("/api/twitter/generate-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: `Create engaging content about ${hashtag}`,
          tone: settings.tone,
          length: settings.length === "shorter" ? "shorter" : "longer",
          useEmoji: true,
          variations: 1,
          instructions: `Create content optimized for ${category} trending topics. Make it ${settings.style} and ${settings.tone}. Include the hashtag ${hashtag} naturally in the content.`,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const data = await response.json()

      if (data.posts && data.posts.length > 0) {
        const post = data.posts[0]
        setGeneratedContent({
          content: post.content,
          tone: settings.tone,
          style: settings.style,
          length: settings.length,
          hashtags: post.hashtags || [hashtag],
        })
      } else {
        throw new Error("No content generated")
      }
    } catch (error) {
      console.error("Error generating content:", error)
      toast({
        title: "Generation failed",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateImage = async () => {
    if (!generatedContent) return

    setIsGeneratingImage(true)
    try {
      const response = await fetch("/api/twitter/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `${hashtag} ${generatedContent.content}`,
          style: "social-media",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate image")
      }

      const data = await response.json()
      setGeneratedImage(data.imageUrl)

      toast({
        title: "Image generated",
        description: "Your image has been generated successfully!",
      })
    } catch (error) {
      console.error("Error generating image:", error)
      toast({
        title: "Image generation failed",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const copyContent = async () => {
    if (!generatedContent) return

    const fullContent = `${generatedContent.content}\n\n${generatedContent.hashtags.join(" ")}`

    try {
      await navigator.clipboard.writeText(fullContent)
      setCopiedContent(true)

      toast({
        title: "Copied to clipboard",
        description: "Content has been copied to your clipboard",
      })

      setTimeout(() => setCopiedContent(false), 2000)
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy content to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleClose = () => {
    setGeneratedContent(null)
    setGeneratedImage(null)
    setCopiedContent(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-auto">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 text-lg sm:text-xl">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-[#1DA1F2]" />
              AI Content Generator
            </div>
            <Badge variant="outline" className="text-[#1DA1F2] border-[#1DA1F2] self-start sm:self-auto">
              {hashtag}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Generate Content Section */}
          {!generatedContent ? (
            <div className="text-center space-y-4">
              <div className="p-6 sm:p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 text-[#1DA1F2] mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-[#1E293B] dark:text-white mb-2">
                  Generate AI Content for {hashtag}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 sm:mb-6">
                  Our AI will automatically optimize the tone, style, and length based on the trending hashtag
                </p>
                <Button
                  onClick={generateContent}
                  disabled={isGenerating}
                  className="bg-[#1DA1F2] hover:bg-[#1a91da] text-white h-10 sm:h-12 px-4 sm:px-6 touch-manipulation"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="hidden sm:inline">Generating Content...</span>
                      <span className="sm:hidden">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Generate Content</span>
                      <span className="sm:hidden">Generate</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Generated Content Display */}
              <Card className="border-[#1DA1F2]/20">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <h3 className="font-semibold text-[#1E293B] dark:text-white text-sm sm:text-base">
                      Generated Content
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {generatedContent.tone}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {generatedContent.style}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {generatedContent.length}
                      </Badge>
                    </div>
                  </div>

                  <Textarea
                    value={generatedContent.content}
                    onChange={(e) => setGeneratedContent({ ...generatedContent, content: e.target.value })}
                    className="min-h-[100px] sm:min-h-[120px] mb-3 resize-none text-sm"
                    placeholder="Generated content will appear here..."
                  />

                  <div className="flex flex-wrap gap-1 mb-3">
                    {generatedContent.hashtags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-[#1DA1F2] border-[#1DA1F2] text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                      onClick={copyContent}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 h-9 touch-manipulation"
                    >
                      {copiedContent ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Content
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={generateContent}
                      variant="outline"
                      size="sm"
                      disabled={isGenerating}
                      className="flex items-center gap-2 h-9 touch-manipulation"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Image Generation Section */}
              <Card className="border-slate-200 dark:border-slate-700">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <h3 className="font-semibold text-[#1E293B] dark:text-white text-sm sm:text-base">
                      Visual Content
                    </h3>
                    <Button
                      onClick={generateImage}
                      disabled={isGeneratingImage}
                      variant="outline"
                      size="sm"
                      className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 h-9 touch-manipulation self-start sm:self-auto"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="hidden sm:inline">Generating...</span>
                          <span className="sm:hidden">Gen...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Generate Image</span>
                          <span className="sm:hidden">Image</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {generatedImage ? (
                    <div className="space-y-3">
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={generatedImage || "/placeholder.svg"}
                          alt={`Generated image for ${hashtag}`}
                          className="w-full h-40 sm:h-48 object-cover"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">AI-generated image for {hashtag}</p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 sm:p-8 text-center">
                      <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Click "Generate Image" to create a visual for your post
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
