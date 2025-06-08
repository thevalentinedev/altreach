"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Play, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface CronStatus {
  service: string
  status: string
  timestamp: string
  nextRun: string
  environment: string
  version: string
}

interface CronResult {
  message: string
  results: {
    success: number
    failed: number
    errors: string[]
    timestamp: string
  }
}

export default function CronDashboard() {
  const [status, setStatus] = useState<CronStatus | null>(null)
  const [lastResult, setLastResult] = useState<CronResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isManualRunning, setIsManualRunning] = useState(false)

  const fetchStatus = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/cron/status")
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error("Failed to fetch cron status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const runManualCron = async () => {
    try {
      setIsManualRunning(true)
      const response = await fetch("/api/cron/fetch-trends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorization: process.env.NEXT_PUBLIC_CRON_SECRET || "test-secret",
        }),
      })

      const data = await response.json()
      setLastResult(data)
    } catch (error) {
      console.error("Failed to run manual cron:", error)
    } finally {
      setIsManualRunning(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-yellow-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />
      case "error":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cron Job Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={fetchStatus} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={runManualCron} disabled={isManualRunning} size="sm">
            <Play className={`h-4 w-4 mr-2 ${isManualRunning ? "animate-spin" : ""}`} />
            Run Now
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cron Job Status
          </CardTitle>
          <CardDescription>Automated trending data fetching every hour</CardDescription>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(status.status)}>
                  {getStatusIcon(status.status)}
                  <span className="ml-1 capitalize">{status.status}</span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {status.service} v{status.version}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Last Check:</span>
                  <p className="text-muted-foreground">{new Date(status.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium">Next Run:</span>
                  <p className="text-muted-foreground">{new Date(status.nextRun).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading status...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Run Results */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Manual Run Results</CardTitle>
            <CardDescription>{new Date(lastResult.results.timestamp).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="outline" className="bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {lastResult.results.success} Success
                </Badge>
                <Badge variant="outline" className="bg-red-50">
                  <XCircle className="h-3 w-3 mr-1" />
                  {lastResult.results.failed} Failed
                </Badge>
              </div>

              {lastResult.results.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Errors:</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {lastResult.results.errors.map((error, index) => (
                      <li key={index} className="font-mono">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Cron job settings and schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Schedule:</span>
              <span className="font-mono">0 * * * * (Every hour)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Categories:</span>
              <span>Trending, Top, Longest</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Countries:</span>
              <span>10 major countries + Worldwide</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Environment:</span>
              <span className="capitalize">{status?.environment || "Unknown"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
