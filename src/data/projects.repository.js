import { asc, eq, and } from 'drizzle-orm'
import { nowIso } from './db'
import { projects } from './schema'

function normalizeProjectInput(input) {
  return {
    name: input.name?.trim(),
    description: input.description?.trim() || '',
  }
}

export async function listProjects(db, userId) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(asc(projects.id))
}

export async function getProjectById(db, id, userId) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
  return project || null
}

export async function createProject(db, userId, input) {
  const timestamp = nowIso()

  const values = {
    ...normalizeProjectInput(input),
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const [created] = await db.insert(projects).values(values).returning()
  return created
}

export async function updateProject(db, id, userId, input) {
  const values = {
    updatedAt: nowIso(),
    ...('name' in input ? { name: input.name.trim() } : {}),
    ...('description' in input
      ? { description: input.description.trim() }
      : {}),
  }

  const [updated] = await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning()

  return updated || null
}

export async function deleteProject(db, id, userId) {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning({ id: projects.id })

  return deleted.length > 0
}