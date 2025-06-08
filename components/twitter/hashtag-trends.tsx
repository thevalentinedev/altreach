"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Loader2,
  Hash,
  TrendingUp,
  Clock,
  Globe,
  RefreshCw,
  AlertCircle,
  Copy,
  CheckCircle,
  Sparkles,
  ArrowLeft,
  BarChart3,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "@/hooks/use-toast"
import { TrendSkeleton } from "@/components/ui/skeleton-loader"
import HashtagAIModal from "./hashtag-ai-modal"
import { trendCache } from "@/lib/browser-cache"

interface Country {
  label: string
  slug: string
  url: string
}

interface TrendingItem {
  rank: number
  hashtag: string
  tweetCount: string
  time: string
  twitterSearchURL: string
}

interface TopItem {
  rank: number
  hashtag: string
  tweetCount: string
  recordedAt: string
  twitterSearchURL: string
}

interface LongestItem {
  rank: number
  hashtag: string
  duration: string
  lastSeen: string
  twitterSearchURL: string
}

interface TrendsResponse {
  country: string
  timeFilter: string
  date: string
  trending?: TrendingItem[]
  top?: TopItem[]
  longest?: LongestItem[]
  countries?: Country[]
}

interface HashtagTrendsProps {
  onBack?: () => void
}

export default function HashtagTrends({ onBack }: HashtagTrendsProps) {
  // State variables
  const [category, setCategory] = useState<"trending" | "top" | "longest">("trending")
  const [country, setCountry] = useState<string>("worldwide")
  const [timeFilter, setTimeFilter] = useState<string>("now")
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [trendsData, setTrendsData] = useState<TrendsResponse | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [isLoadingCountries, setIsLoadingCountries] = useState<boolean>(false)
  const [copiedHashtag, setCopiedHashtag] = useState<string | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false)
  const [selectedHashtag, setSelectedHashtag] = useState<string>("")

  // Progressive loading states
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true)
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true)

  // Time filter options
  const timeFilters = {
    trending: [
      { value: "now", label: "Now" },
      { value: "1h", label: "1 Hour" },
      { value: "6h", label: "6 Hours" },
      { value: "12h", label: "12 Hours" },
      { value: "24h", label: "24 Hours" },
    ],
    top: [
      { value: "24h", label: "24 Hours" },
      { value: "7d", label: "7 Days" },
      { value: "30d", label: "30 Days" },
      { value: "year", label: "Year" },
    ],
    longest: [
      { value: "24h", label: "24 Hours" },
      { value: "7d", label: "7 Days" },
      { value: "30d", label: "30 Days" },
      { value: "year", label: "Year" },
    ],
  }

  // Fetch countries on initial load
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true)
      try {
        console.log("Fetching countries...")

        // Try to get from cache first
        const cachedCountries = trendCache.get<Country[]>("countries")
        if (cachedCountries && cachedCountries.length > 0) {
          setCountries(cachedCountries)
          setIsLoadingCountries(false)
          return
        }

        const response = await fetch("/api/twitter/get-trends?includeCountries=true")
        if (!response.ok) {
          throw new Error(`Failed to fetch countries: ${response.status}`)
        }
        const data = await response.json()
        console.log("Countries response:", data)

        if (data.countries && Array.isArray(data.countries) && data.countries.length > 0) {
          setCountries(data.countries)
          // Cache countries for 24 hours
          trendCache.set("countries", data.countries, 24 * 60 * 60 * 1000)
          console.log(`Loaded ${data.countries.length} countries`)
        } else {
          console.log("No countries in response, using defaults")
          const defaultCountries = getDefaultCountries()
          setCountries(defaultCountries)
          trendCache.set("countries", defaultCountries, 24 * 60 * 60 * 1000)
        }
      } catch (err) {
        console.error("Error fetching countries:", err)
        const defaultCountries = getDefaultCountries()
        setCountries(defaultCountries)
        trendCache.set("countries", defaultCountries, 24 * 60 * 60 * 1000)
      } finally {
        setIsLoadingCountries(false)
      }
    }

    fetchCountries()
  }, [])

  // Get default countries
  const getDefaultCountries = (): Country[] => [
    { label: "Worldwide", slug: "worldwide", url: "https://getdaytrends.com/" },
    { label: "United States", slug: "united-states", url: "https://getdaytrends.com/united-states/" },
    { label: "United Kingdom", slug: "united-kingdom", url: "https://getdaytrends.com/united-kingdom/" },
    { label: "Canada", slug: "canada", url: "https://getdaytrends.com/canada/" },
    { label: "Australia", slug: "australia", url: "https://getdaytrends.com/australia/" },
    { label: "India", slug: "india", url: "https://getdaytrends.com/india/" },
    { label: "Japan", slug: "japan", url: "https://getdaytrends.com/japan/" },
    { label: "Brazil", slug: "brazil", url: "https://getdaytrends.com/brazil/" },
    { label: "Germany", slug: "germany", url: "https://getdaytrends.com/germany/" },
    { label: "France", slug: "france", url: "https://getdaytrends.com/france/" },
    { label: "Spain", slug: "spain", url: "https://getdaytrends.com/spain/" },
  ]

  // Fetch trends data
  const fetchTrends = async (useCache = true) => {
    setLoading(true)
    setError(null)

    // Show skeleton for better UX during loading
    if (!isInitialLoad) {
      setShowSkeleton(true)
    }

    try {
      console.log(`Fetching trends: country=${country}, category=${category}, timeFilter=${timeFilter}`)

      // Try to get from cache first
      if (useCache) {
        const cacheKey = `trends:${country}:${category}:${timeFilter}:${date}`
        const cachedData = trendCache.get<TrendsResponse>(cacheKey)
        if (cachedData) {
          setTrendsData(cachedData)
          setLoading(false)
          setShowSkeleton(false)
          setIsInitialLoad(false)
          return
        }
      }

      const url = `/api/twitter/get-trends?country=${country}&category=${category}&timeFilter=${timeFilter}&date=${date}`
      const response = await fetch(url)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch trends: ${response.status}`)
      }

      const data = await response.json()
      console.log("Trends response:", data)

      // Simulate minimum loading time for better UX
      if (!isInitialLoad) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      setTrendsData(data)

      // Cache the data for 30 minutes
      const cacheKey = `trends:${country}:${category}:${timeFilter}:${date}`
      trendCache.set(cacheKey, data, 30 * 60 * 1000)
    } catch (err) {
      console.error("Error fetching trends:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch trends data")
    } finally {
      setLoading(false)
      setShowSkeleton(false)
      setIsInitialLoad(false)
    }
  }

  // Fetch trends when parameters change
  useEffect(() => {
    if (countries.length > 0) {
      fetchTrends()
    }
  }, [category, country, timeFilter, countries.length])

  // Handle category change
  const handleCategoryChange = (value: string) => {
    const newCategory = value as "trending" | "top" | "longest"
    setCategory(newCategory)
    // Reset time filter to default for the new category
    setTimeFilter(timeFilters[newCategory][0].value)
  }

  // Filter countries by search term
  const filteredCountries = countries.filter((c) => c.label.toLowerCase().includes(searchTerm.toLowerCase()))

  // Handle hashtag click
  const handleHashtagClick = async (hashtag: string) => {
    try {
      await navigator.clipboard.writeText(hashtag)
      setCopiedHashtag(hashtag)

      toast({
        title: "Copied to clipboard",
        description: `${hashtag} has been copied to your clipboard`,
        duration: 2000,
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedHashtag(null), 2000)
    } catch (err) {
      console.error("Failed to copy hashtag:", err)
      toast({
        title: "Copy failed",
        description: "Failed to copy hashtag to clipboard",
        variant: "destructive",
        duration: 2000,
      })
    }
  }

  const handleAIClick = (hashtag: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering the copy functionality
    setSelectedHashtag(hashtag)
    setAiModalOpen(true)
  }

  const handleTwitterClick = (url: string, event: React.MouseEvent) => {
    event.stopPropagation()
    window.open(url, "_blank", "noopener,noreferrer")
  }

  // Get current data based on category
  const getCurrentData = () => {
    if (!trendsData) return []

    switch (category) {
      case "trending":
        return trendsData.trending || []
      case "top":
        return trendsData.top || []
      case "longest":
        return trendsData.longest || []
      default:
        return []
    }
  }

  const currentData = getCurrentData()

  return (
    <Card className="w-full max-w-6xl mx-auto shadow-lg border-0 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
      <CardHeader className="pb-4 sm:pb-6 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="w-10 h-10 bg-gradient-to-br from-[#1DA1F2] to-[#1a91da] rounded-xl flex items-center justify-center shadow-lg">
                <Hash className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-white leading-tight">
                  Twitter Hashtag Trends
                </CardTitle>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
                  Real-time trending hashtags from getdaytrends.com
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTrends(false)}
            className="text-[#1DA1F2] border-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 self-start sm:self-auto min-h-[36px]"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 px-4 sm:px-6">
        {/* Controls Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Country Selector */}
          <div className="space-y-2">
            <label
              htmlFor="country-select"
              className="text-sm font-medium text-[#1E293B] dark:text-slate-300 flex items-center gap-2"
            >
              <Globe className="h-4 w-4 text-[#1DA1F2]" />
              Location
            </label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country-select" className="h-10 sm:h-11">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <div className="py-2 px-3 sticky top-0 bg-white dark:bg-slate-950 z-10 border-b border-slate-200 dark:border-slate-800">
                  <Input
                    placeholder="Search countries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8"
                  />
                </div>
                {isLoadingCountries ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-[#1DA1F2] mr-2" />
                    <span className="text-sm text-slate-500">Loading countries...</span>
                  </div>
                ) : filteredCountries.length > 0 ? (
                  filteredCountries.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.label}
                    </SelectItem>
                  ))
                ) : (
                  <div className="py-2 px-3 text-sm text-slate-500">No countries found</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Time Filter */}
          <div className="space-y-2">
            <label
              htmlFor="time-filter"
              className="text-sm font-medium text-[#1E293B] dark:text-slate-300 flex items-center gap-2"
            >
              <Clock className="h-4 w-4 text-[#1DA1F2]" />
              Time Filter
            </label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger id="time-filter" className="h-10 sm:h-11">
                <SelectValue placeholder="Select time filter" />
              </SelectTrigger>
              <SelectContent>
                {timeFilters[category].map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={category} onValueChange={handleCategoryChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trending</span>
              <span className="sm:hidden">Now</span>
            </TabsTrigger>
            <TabsTrigger value="top" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Most Tweeted</span>
              <span className="sm:hidden">Top</span>
            </TabsTrigger>
            <TabsTrigger value="longest" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Longest Trending</span>
              <span className="sm:hidden">Longest</span>
            </TabsTrigger>
          </TabsList>

          {/* Error Message */}
          {error && (
            <Alert
              variant="destructive"
              className="mt-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-600 dark:text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          {/* Content for all tabs */}
          <TabsContent value={category} className="mt-4">
            {/* Show skeleton during loading */}
            {(loading || showSkeleton) && <TrendSkeleton />}

            {/* Show actual content when loaded */}
            {!loading && !showSkeleton && currentData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white">
                    {category === "trending" && `Trending Now in ${trendsData?.country}`}
                    {category === "top" && `Most Tweeted in ${trendsData?.country} (${trendsData?.timeFilter})`}
                    {category === "longest" && `Longest Trending in ${trendsData?.country} (${trendsData?.timeFilter})`}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={`${
                      category === "trending"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : category === "top"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    }`}
                  >
                    {currentData.length} trends
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {currentData.map((item: any) => (
                    <div
                      key={`${item.rank}-${item.hashtag}`}
                      className={`flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-all duration-200 cursor-pointer hover:shadow-md touch-manipulation ${
                        category === "trending"
                          ? "hover:border-[#1DA1F2] dark:hover:border-[#1DA1F2]"
                          : category === "top"
                            ? "hover:border-purple-400 dark:hover:border-purple-500"
                            : "hover:border-green-400 dark:hover:border-green-500"
                      }`}
                      onClick={() => handleHashtagClick(item.hashtag)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm flex-shrink-0 ${
                            category === "trending"
                              ? "bg-[#1DA1F2]/10 text-[#1DA1F2]"
                              : category === "top"
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          }`}
                        >
                          {item.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#1E293B] dark:text-white text-sm sm:text-base truncate">
                            {item.hashtag}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {category === "trending" && `${item.tweetCount} tweets`}
                            {category === "top" && `${item.tweetCount} tweets`}
                            {category === "longest" && `Trending for ${item.duration}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          onClick={(e) => handleAIClick(item.hashtag, e)}
                          size="sm"
                          className="bg-gradient-to-r from-[#1DA1F2] to-[#1a91da] hover:from-[#1a91da] hover:to-[#1580c7] text-white border-0 h-8 px-3 text-xs font-medium touch-manipulation"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">AI</span>
                        </Button>
                        {copiedHashtag === item.hashtag ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              !loading &&
              !showSkeleton && (
                <div className="text-center py-12">
                  {category === "trending" && (
                    <Hash className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  )}
                  {category === "top" && (
                    <BarChart3 className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  )}
                  {category === "longest" && (
                    <Clock className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  )}
                  <h3 className="text-lg font-semibold text-[#1E293B] dark:text-white mb-2">
                    No {category} hashtags found
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">Try changing the location or time filter</p>
                </div>
              )
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <HashtagAIModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        hashtag={selectedHashtag}
        category={category}
      />
    </Card>
  )
}
