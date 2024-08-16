import { db } from './database'
import { FencingTokenUpdate, FencingToken, NewFencingToken } from './types'

export async function findFencingTokenById(id: number) {
  return await db.selectFrom('fencingToken')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function findFencingTokens(criteria: Partial<FencingToken>) {
  let query = db.selectFrom('fencingToken')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id) // Kysely is immutable, you must re-assign!
  }
  return await query.selectAll().execute()
}

export async function updateFencingToken(id: number, updateWith: FencingTokenUpdate) {
  await db.updateTable('fencingToken').set(updateWith).where('id', '=', id).execute()
}

export async function createFencingToken(fencingToken: NewFencingToken) {
  const { insertId } = await db.insertInto('fencingToken')
    .values(fencingToken)
    .executeTakeFirstOrThrow()

  return await findFencingTokenById(Number(insertId!))
}

export async function deleteFencingToken(id: number) {
  const fencingToken = await findFencingTokenById(id)

  if (fencingToken) {
    await db.deleteFrom('fencingToken').where('id', '=', id).execute()
  }

  return fencingToken
}