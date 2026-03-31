import { db } from './connection.js'
import { sql } from 'kysely'

async function seed() {
  // Seed users (idempotent: ON CONFLICT DO NOTHING on email unique constraint)
  const passwordHash = '$2b$10$TIMlZeMFkb9hYdp8EtHPTutZ/vXQEHG.CyAoJ/GF/W7LXS103hltS'

  await db
    .insertInto('users')
    .values([
      { name: 'Test User 1', email: 'test1@example.com', password_hash: passwordHash, active: true },
      { name: 'Test User 2', email: 'test2@example.com', password_hash: passwordHash, active: true }
    ])
    .onConflict((oc) => oc.column('email').doNothing())
    .execute()

  console.log('Seeded users')

  // Seed items (idempotent: skip if items already exist)
  const { count } = await db
    .selectFrom('items')
    .select(sql<number>`count(*)`.as('count'))
    .executeTakeFirstOrThrow()

  if (Number(count) === 0) {
    await db
      .insertInto('items')
      .values([
        { name: 'MacBook Pro' },
        { name: 'iPhone 15' },
        { name: 'iPad Air' },
        { name: 'AirPods Pro' },
        { name: 'Magic Mouse' },
        { name: 'Studio Display' }
      ])
      .execute()
    console.log('Seeded items')
  } else {
    console.log('Items already exist, skipping')
  }

  console.log('Seed completed')
  await db.destroy()
}

seed().catch(async (error) => {
  console.error('Seed failed:', error)
  await db.destroy()
  process.exit(1)
})
