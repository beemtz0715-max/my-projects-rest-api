import { asc, eq, and } from 'drizzle-orm'
import { nowIso } from './db.js'
import { tasks, projects } from './schema.js'

function normalizeTaskCreateInput(projectId, input) {
  const timestamp = nowIso()

  return {
    projectId: projectId,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    status: input.status || 'todo',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export async function listTasksByProject(db, projectId) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.id))
}

export async function getTaskById(db, id) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
  return task || null
}

export async function createTask(db, projectId, input) {
  const [created] = await db
    .insert(tasks)
    .values(normalizeTaskCreateInput(projectId, input))
    .returning()

  return created
}

export async function updateTask(db, id, input) {
  const values = {
    updatedAt: nowIso(),
    ...('title' in input ? { title: input.title.trim() } : {}),
    ...('description' in input
      ? { description: input.description.trim() }
      : {}),
    ...('status' in input ? { status: input.status } : {}),
  }

  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(eq(tasks.id, id))
    .returning()

  return updated || null
}

export async function deleteTask(db, id) {
  const deleted = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning({ id: tasks.id })

  return deleted.length > 0
}

export async function getTaskByIdForUser(db, id, userId) {
  const result = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, id), eq(projects.userId, userId)))
  return result[0]?.task || null
}