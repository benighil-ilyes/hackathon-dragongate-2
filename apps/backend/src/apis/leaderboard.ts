import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/connection.js'

export const storeLeaderboardApi = (app: OpenAPIHono) => {
  app.use('/api/leaderboard', authMiddleware)

  const route = createRoute({
    method: 'get',
    path: '/api/leaderboard',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.object({
                rank: z.number(),
                user_id: z.number(),
                name: z.string(),
                total_points: z.number(),
                bosses_defeated: z.number(),
                adventurer_rank: z.string(),
              }))
            })
          }
        },
        description: 'Classement'
      },
    },
  })

  app.openapi(route, async (c) => {
    const rows = await db
      .selectFrom('user_profiles')
      .innerJoin('users', 'users.id', 'user_profiles.user_id')
      .select(['user_profiles.user_id', 'users.name', 'user_profiles.total_points', 'user_profiles.bosses_defeated', 'user_profiles.rank'])
      .orderBy('user_profiles.total_points', 'desc')
      .limit(50)
      .execute()

    return c.json({
      success: true,
      data: rows.map((r, i) => ({
        rank: i + 1,
        user_id: r.user_id,
        name: r.name,
        total_points: Number(r.total_points),
        bosses_defeated: Number(r.bosses_defeated),
        adventurer_rank: r.rank,
      }))
    })
  })
}
