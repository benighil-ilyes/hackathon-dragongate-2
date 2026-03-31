import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'

export const storeDebugApi = (app: OpenAPIHono) => {
  app.use('/api/debug/*', authMiddleware)

  // GET /api/debug/date
  const getRoute = createRoute({
    method: 'get',
    path: '/api/debug/date',
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ current_date: z.string() }) }) } },
        description: 'Date courante'
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const debug = await db.selectFrom('debug_dates').select('current_date').where('user_id', '=', user.id).executeTakeFirst()
    const date = debug ? new Date(debug.current_date) : new Date()
    return c.json({ success: true, data: { current_date: date.toISOString() } })
  })

  // POST /api/debug/date
  const setRoute = createRoute({
    method: 'post',
    path: '/api/debug/date',
    request: { body: { content: { 'application/json': { schema: z.object({ date: z.string() }) } } } },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.object({ current_date: z.string() }) }) } },
        description: 'Date mise à jour'
      },
    },
  })

  app.openapi(setRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    const { date } = c.req.valid('json')
    const parsed = new Date(date)

    const existing = await db.selectFrom('debug_dates').where('user_id', '=', user.id).executeTakeFirst()
    if (existing) {
      await db.updateTable('debug_dates').set({ current_date: parsed }).where('user_id', '=', user.id).execute()
    } else {
      await db.insertInto('debug_dates').values({ user_id: user.id, current_date: parsed }).execute()
    }

    return c.json({ success: true, data: { current_date: parsed.toISOString() } })
  })

  // DELETE /api/debug/date — reset to real date
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/api/debug/date',
    responses: {
      200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Date réinitialisée' },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const user = (c as any).get('user') as { id: number }
    await db.deleteFrom('debug_dates').where('user_id', '=', user.id).execute()
    return c.json({ success: true })
  })
}
