import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'

export const storeProfileApi = (app: OpenAPIHono) => {
  app.use('/api/profile', authMiddleware)

  const route = createRoute({
    method: 'get',
    path: '/api/profile',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                name: z.string(),
                total_points: z.number(),
                bosses_defeated: z.number(),
                rank: z.string(),
              })
            })
          }
        },
        description: 'Profil utilisateur'
      }
    }
  })

  app.openapi(route, async (c) => {
    const user = (c as any).get('user') as { id: number; name: string }

    let profile = await db
      .selectFrom('user_profiles')
      .selectAll()
      .where('user_id', '=', user.id)
      .executeTakeFirst()

    if (!profile) {
      await db.insertInto('user_profiles').values({ user_id: user.id }).execute()
      profile = await db.selectFrom('user_profiles').selectAll().where('user_id', '=', user.id).executeTakeFirstOrThrow()
    }

    return c.json({
      success: true,
      data: {
        name: user.name,
        total_points: Number(profile.total_points),
        bosses_defeated: Number(profile.bosses_defeated),
        rank: profile.rank,
      }
    })
  })
}
