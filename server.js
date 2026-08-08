import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import pinoHttp from 'pino-http'

import connectDB from './config/db.js'
import Poll from './models/Poll.js'
import Vote from './models/Vote.js'
import pollRoutes from './routes/pollRoutes.js'
import adminRoutes from './routes/adminRoutes.js'

dotenv.config()

const app = express()

// Database
await connectDB()

async function backfillPollIdentifiers() {
  try {
    const pollsWithoutId = await Poll.find({
      $or: [{ pollId: { $exists: false } }, { pollId: null }, { pollId: '' }],
    })

    for (const poll of pollsWithoutId) {
      poll.pollId = poll.pollId || poll._id.toString()
      await poll.save({ validateBeforeSave: false })
    }

    const votesWithoutPollId = await Vote.find({
      $or: [{ pollId: { $exists: false } }, { pollId: null }, { pollId: '' }],
    })

    for (const vote of votesWithoutPollId) {
      const poll = await Poll.findById(vote.pollRef || vote.pollId)
      if (poll) {
        vote.pollId = poll.pollId || poll._id.toString()
        vote.pollRef = poll._id
        await vote.save({ validateBeforeSave: false })
      }
    }
  } catch (error) {
    console.warn('Unable to backfill poll identifiers:', error)
  }
}

await backfillPollIdentifiers()

// Security headers
app.use(helmet())

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)

// Request body limit
app.use(
  express.json({
    limit: '50kb',
  })
)

app.use(cookieParser())

app.use(compression())

// Logging
app.use(pinoHttp())

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', generalLimiter)

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GhanaSpeaks API',
  })
})

// Routes
app.use('/api/polls', pollRoutes)
app.use('/api/admin', adminRoutes)

// 404
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found.',
  })
})

// Error handler
app.use((error, req, res, next) => {
  console.error(error)

  res.status(500).json({
    message: 'Internal server error.',
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`GhanaSpeaks API running on port ${PORT}`)
})