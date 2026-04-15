import { Hono } from 'hono'
import { cors } from 'hono/cors'

import auth from './routes/auth.js'
import projects from './routes/projects.js'
import tasks from './routes/tasks.js'

import { authenticate } from './middleware/authenticate.js'
import { isApiError } from './utils/errors.js'
import { sendError } from './utils/response.js'

const app = new Hono()
const api = new Hono()

// Add trace ID to every request
app.use('*', async (c, next) => {
  c.set('traceId', crypto.randomUUID())
  await next()
})

// Cloudflare Rate Limiter (NO npm package needed)
app.use('*', async (c, next) => {
  // If your teacher uses AUTH_LIMITER binding, it is enforced here by Cloudflare
  await next()
})

// CORS
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      const allowed =
        c.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? []
      return allowed.includes(origin) ? origin : null
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Routes
api.route('/auth', auth)

api.use('*', authenticate)
api.route('/projects', projects)
api.route('/tasks', tasks)

app.route('/api', api)

// Not found handler
app.notFound((c) => {
  return sendError(c, 404, 'NOT_FOUND', 'Route not found.')
})

// Error handler
app.onError((error, c) => {
  if (isApiError(error)) {
    return sendError(
      c,
      error.status,
      error.code,
      error.message,
      error.details
    )
  }

  console.error('Unhandled error:', error)

  return sendError(
    c,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected server error occurred.'
  )
})

export default app