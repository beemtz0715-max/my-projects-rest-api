import { Hono } from 'hono'
import { getDb } from '../data/db.js'

import {
  createSession,
  deleteSessionByTokenHash,
  findSessionByTokenHash,
} from '../data/sessions.repository.js'
import { createUser, findUserByEmail } from '../data/users.repository.js'
import { signAccessToken, refreshTokenExpiresAt } from '../utils/auth.js'
import { parseJsonBody } from '../utils/body.js'
import {
  generateRefreshToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../utils/crypto.js'
import { ApiError } from '../utils/errors.js'
import { sendResource } from '../utils/response.js'
import {
  validateLogin,
  validateLogout,
  validateRefresh,
  validateRegister,
} from '../utils/validation.js'

const auth = new Hono()

auth.post('/register', async (c) => {
  const payload = await parseJsonBody(c)
  const details = validateRegister(payload)

  if (details.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Some fields are invalid.',
      details,
    )
  }

  const db = getDb(c.env.DB)
  const existing = await findUserByEmail(db, payload.email)

  if (existing) {
    throw new ApiError(
      409,
      'CONFLICT',
      'A user with that email already exists.',
    )
  }
  const passwordHash = await hashPassword(payload.password)
  const user = await createUser(db, { email: payload.email, passwordHash })

  c.header('Location', `/api/auth/users/${user.id}`)
  return sendResource(
    c,
    { id: user.id, email: user.email, createdAt: user.createdAt },
    201,
  )
})

auth.post('/login', async (c) => {
  const payload = await parseJsonBody(c)
  const details = validateLogin(payload)

  if (details.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Some fields are invalid.',
      details,
    )
  }

  const db = getDb(c.env.DB)
  const user = await findUserByEmail(db, payload.email)
  const credentialsError = new ApiError(
    401,
    'UNAUTHORIZED',
    'Invalid email or password.',
  )

  if (!user) {
    throw credentialsError
  }

  const passwordMatch = await verifyPassword(
    payload.password,
    user.passwordHash,
  )

  if (!passwordMatch) {
    throw credentialsError
  }

  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
  )

  const refreshToken = generateRefreshToken()
  const tokenHash = await hashToken(refreshToken)
  const expiresAt = refreshTokenExpiresAt()

  await createSession(db, { userId: user.id, tokenHash, expiresAt })

  return sendResource(c, {
    accessToken: accessToken,
    refreshToken: refreshToken,
    tokenType: 'Bearer',
  })
})

auth.post('/refresh', async (c) => {
  const payload = await parseJsonBody(c)
  const details = validateRefresh(payload)

  if (details.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Some fields are invalid.',
      details,
    )
  }

  const db = getDb(c.env.DB)
  const tokenHash = await hashToken(payload.refresh_token)
  const session = await findSessionByTokenHash(db, tokenHash)

  if (!session) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token.')
  }

  if (new Date(session.expiresAt) < new Date()) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token.')
  }

  const accessToken = await signAccessToken(
    { sub: session.userId },
    c.env.JWT_SECRET,
  )

  return sendResource(c, {
    access_token: accessToken,
    token_type: 'Bearer',
  })
})

auth.post('/logout', async (c) => {
  const payload = await parseJsonBody(c)
  const details = validateLogout(payload)

  if (details.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Some fields are invalid.',
      details,
    )
  }

  const db = getDb(c.env.DB)
  const tokenHash = await hashToken(payload.refresh_token)

  await deleteSessionByTokenHash(db, tokenHash)

  return c.body(null, 204)
})

export default auth