import { Redis } from "@upstash/redis"

// Initialize Redis client
const redis = Redis.fromEnv()

export default redis
