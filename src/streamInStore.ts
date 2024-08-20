import { Transaction } from 'kysely';
import { StreamInUpdate, StreamIn, NewStreamIn, Database } from './types';

export async function findStreamInById(trx: Transaction<Database>, id: number) {
    return await trx
        .selectFrom('streamIn')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findStreamIns(
    trx: Transaction<Database>,
    criteria: Partial<StreamIn>
) {
    let query = trx.selectFrom('streamIn');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }
    return await query.selectAll().execute();
}

export async function getAllStreamInsDescending(trx: Transaction<Database>) {
    return await trx
        .selectFrom('streamIn')
        .orderBy('id', 'desc')
        .selectAll()
        .execute();
}

export async function getAllStreamInsAscending(trx: Transaction<Database>) {
    return await trx
        .selectFrom('streamIn')
        .orderBy('id', 'asc')
        .selectAll()
        .execute();
}

export async function findStreamInsGreaterThanStreamInId(
    trx: Transaction<Database>,
    id: number
) {
    let query = trx.selectFrom('streamIn').where('id', '>', id);
    return await query.selectAll().execute();
}

export async function getMostRecentStreamIn(trx: Transaction<Database>) {
    return await trx
        .selectFrom('streamIn')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateStreamIn(
    trx: Transaction<Database>,
    id: number,
    updateWith: StreamInUpdate
) {
    await trx
        .updateTable('streamIn')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createStreamIn(
    trx: Transaction<Database>,
    streamIn: NewStreamIn
) {
    const { insertId } = await trx
        .insertInto('streamIn')
        .values(streamIn)
        .executeTakeFirstOrThrow();

    return await findStreamInById(trx, Number(insertId!));
}

export async function deleteStreamIn(trx: Transaction<Database>, id: number) {
    const streamIn = await findStreamInById(trx, id);

    if (streamIn) {
        await trx.deleteFrom('streamIn').where('id', '=', id).execute();
    }

    return streamIn;
}
