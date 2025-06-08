import puppeteer, { type Browser, type Page } from "puppeteer"

interface BrowserPoolOptions {
  maxConcurrency: number
  maxIdleTime: number // in milliseconds
  puppeteerOptions?: any
}

interface PooledBrowser {
  browser: Browser
  lastUsed: number
  inUse: boolean
}

class BrowserPool {
  private browsers: PooledBrowser[] = []
  private maxConcurrency: number
  private maxIdleTime: number
  private puppeteerOptions: any
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(options: BrowserPoolOptions) {
    this.maxConcurrency = options.maxConcurrency
    this.maxIdleTime = options.maxIdleTime
    this.puppeteerOptions = options.puppeteerOptions || {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--memory-pressure-off",
        "--max_old_space_size=4096",
      ],
      ignoreHTTPSErrors: true,
    }

    // Start cleanup interval to close idle browsers
    this.startCleanupInterval()
  }

  async acquire(): Promise<Browser> {
    // Try to find an available browser
    const availableBrowser = this.browsers.find((b) => !b.inUse && this.isBrowserAlive(b.browser))

    if (availableBrowser) {
      availableBrowser.inUse = true
      availableBrowser.lastUsed = Date.now()
      console.log(`♻️ Reusing existing browser (${this.browsers.length} total)`)
      return availableBrowser.browser
    }

    // Create new browser if under limit
    if (this.browsers.length < this.maxConcurrency) {
      const browser = await puppeteer.launch(this.puppeteerOptions)
      const pooledBrowser: PooledBrowser = {
        browser,
        lastUsed: Date.now(),
        inUse: true,
      }

      this.browsers.push(pooledBrowser)
      console.log(`🚀 Created new browser (${this.browsers.length}/${this.maxConcurrency})`)
      return browser
    }

    // Wait for an available browser
    console.log(`⏳ Waiting for available browser...`)
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const availableBrowser = this.browsers.find((b) => !b.inUse && this.isBrowserAlive(b.browser))

        if (availableBrowser) {
          clearInterval(checkInterval)
          availableBrowser.inUse = true
          availableBrowser.lastUsed = Date.now()
          resolve(availableBrowser.browser)
        }
      }, 100)

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error("Browser pool timeout: No browser available"))
      }, 30000)
    })
  }

  async release(browser: Browser): Promise<void> {
    const pooledBrowser = this.browsers.find((b) => b.browser === browser)

    if (pooledBrowser) {
      pooledBrowser.inUse = false
      pooledBrowser.lastUsed = Date.now()
      console.log(`✅ Released browser back to pool`)
    }
  }

  async createPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage()

    // Set realistic browser headers and viewport
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )
    await page.setViewport({ width: 1280, height: 800 })

    // Optimize page performance
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      // Block unnecessary resources to speed up loading
      const resourceType = req.resourceType()
      if (["stylesheet", "font", "image"].includes(resourceType)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    return page
  }

  private isBrowserAlive(browser: Browser): boolean {
    try {
      return browser.isConnected()
    } catch {
      return false
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = Date.now()
      const browsersToClose = this.browsers.filter((b) => !b.inUse && now - b.lastUsed > this.maxIdleTime)

      for (const pooledBrowser of browsersToClose) {
        try {
          await pooledBrowser.browser.close()
          console.log(`🗑️ Closed idle browser`)
        } catch (error) {
          console.error("Error closing idle browser:", error)
        }
      }

      // Remove closed browsers from pool
      this.browsers = this.browsers.filter((b) => !browsersToClose.includes(b) && this.isBrowserAlive(b.browser))
    }, 60000) // Check every minute
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Close all browsers
    await Promise.all(
      this.browsers.map(async (pooledBrowser) => {
        try {
          await pooledBrowser.browser.close()
        } catch (error) {
          console.error("Error closing browser during destroy:", error)
        }
      }),
    )

    this.browsers = []
    console.log(`🔒 Browser pool destroyed`)
  }
}

// Create singleton browser pool
const browserPool = new BrowserPool({
  maxConcurrency: 3, // Maximum 3 concurrent browsers
  maxIdleTime: 5 * 60 * 1000, // Close browsers idle for 5 minutes
})

export default browserPool
