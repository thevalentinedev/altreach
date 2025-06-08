// Browser-based caching utility for Altreach
// Provides persistent storage with TTL support using localStorage

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

interface CacheOptions {
  ttl?: number // Default TTL in milliseconds
  prefix?: string // Cache key prefix
}

class BrowserCache {
  private prefix: string
  private defaultTTL: number

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || "altreach_cache"
    this.defaultTTL = options.ttl || 24 * 60 * 60 * 1000 // 24 hours default
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl
  }

  set<T>(key: string, data: T, ttl?: number): boolean {
    try {
      const cacheKey = this.getKey(key)
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
      }

      localStorage.setItem(cacheKey, JSON.stringify(item))
      return true
    } catch (error) {
      console.warn("Failed to cache data:", error)
      return false
    }
  }

  get<T>(key: string): T | null {
    try {
      const cacheKey = this.getKey(key)
      const cached = localStorage.getItem(cacheKey)

      if (!cached) {
        return null
      }

      const item: CacheItem<T> = JSON.parse(cached)

      if (this.isExpired(item)) {
        this.delete(key)
        return null
      }

      return item.data
    } catch (error) {
      console.warn("Failed to retrieve cached data:", error)
      this.delete(key) // Clean up corrupted cache
      return null
    }
  }

  delete(key: string): boolean {
    try {
      const cacheKey = this.getKey(key)
      localStorage.removeItem(cacheKey)
      return true
    } catch (error) {
      console.warn("Failed to delete cached data:", error)
      return false
    }
  }

  clear(): boolean {
    try {
      const keys = Object.keys(localStorage)
      const prefixedKeys = keys.filter((key) => key.startsWith(this.prefix))

      prefixedKeys.forEach((key) => {
        localStorage.removeItem(key)
      })

      return true
    } catch (error) {
      console.warn("Failed to clear cache:", error)
      return false
    }
  }

  // Clean up expired items
  cleanup(): number {
    let cleanedCount = 0

    try {
      const keys = Object.keys(localStorage)
      const prefixedKeys = keys.filter((key) => key.startsWith(this.prefix))

      prefixedKeys.forEach((key) => {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const item: CacheItem<any> = JSON.parse(cached)
            if (this.isExpired(item)) {
              localStorage.removeItem(key)
              cleanedCount++
            }
          }
        } catch (error) {
          // Remove corrupted cache items
          localStorage.removeItem(key)
          cleanedCount++
        }
      })
    } catch (error) {
      console.warn("Failed to cleanup cache:", error)
    }

    return cleanedCount
  }

  // Get cache statistics
  getStats(): { totalItems: number; totalSize: number; expiredItems: number } {
    let totalItems = 0
    let totalSize = 0
    let expiredItems = 0

    try {
      const keys = Object.keys(localStorage)
      const prefixedKeys = keys.filter((key) => key.startsWith(this.prefix))

      prefixedKeys.forEach((key) => {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            totalItems++
            totalSize += cached.length

            const item: CacheItem<any> = JSON.parse(cached)
            if (this.isExpired(item)) {
              expiredItems++
            }
          }
        } catch (error) {
          // Count corrupted items as expired
          expiredItems++
        }
      })
    } catch (error) {
      console.warn("Failed to get cache stats:", error)
    }

    return { totalItems, totalSize, expiredItems }
  }
}

// Create cache instances for different data types
export const trendCache = new BrowserCache({
  prefix: "altreach_trends",
  ttl: 30 * 60 * 1000, // 30 minutes for trends
})

export const commentCache = new BrowserCache({
  prefix: "altreach_comments",
  ttl: 24 * 60 * 60 * 1000, // 24 hours for comments
})

export const profileCache = new BrowserCache({
  prefix: "altreach_profiles",
  ttl: 60 * 60 * 1000, // 1 hour for profiles
})

export const authCache = new BrowserCache({
  prefix: "altreach_auth",
  ttl: 24 * 60 * 60 * 1000, // 24 hours for auth
})

// Utility function to clean up all caches periodically
export const cleanupAllCaches = (): void => {
  const caches = [trendCache, commentCache, profileCache, authCache]
  let totalCleaned = 0

  caches.forEach((cache) => {
    totalCleaned += cache.cleanup()
  })

  if (totalCleaned > 0) {
    console.log(`Cleaned up ${totalCleaned} expired cache items`)
  }
}

// Auto-cleanup on page load
if (typeof window !== "undefined") {
  // Clean up expired items when the page loads
  setTimeout(cleanupAllCaches, 1000)

  // Set up periodic cleanup every 10 minutes
  setInterval(cleanupAllCaches, 10 * 60 * 1000)
}

export default BrowserCache
