import { Transaction } from 'kysely';
import { StreamOutUpdate, StreamOut, NewStreamOut, Database } from './types';
import { NewTotallyOrderedStreamEvent } from './transmissionControl/types';

export async function findStreamOutById(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('streamOut')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findStreamOuts(
    trx: Transaction<Database>,
    criteria: Partial<StreamOut>
) {
    let query = trx.selectFrom('streamOut');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }
    return await query.selectAll().execute();
}

export async function getAllStreamOutsDescending(trx: Transaction<Database>) {
    return await trx
        .selectFrom('streamOut')
        .orderBy('id', 'desc')
        .selectAll()
        .execute();
}

export async function getAllStreamOutsAscending(trx: Transaction<Database>) {
    const results = await trx
        .selectFrom('streamOut')
        .orderBy('id', 'asc')
        .selectAll()
        .execute();
    return results;
}

export async function findStreamOutsGreaterThanStreamOutId(
    trx: Transaction<Database>,
    id: number
) {
    let query = trx.selectFrom('streamOut').where('id', '>', id);
    return await query.selectAll().execute();
}

export async function getMostRecentStreamOut(trx: Transaction<Database>) {
    return await trx
        .selectFrom('streamOut')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateStreamOut(
    trx: Transaction<Database>,
    id: number,
    updateWith: StreamOutUpdate
) {
    await trx
        .updateTable('streamOut')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createStreamOutFromStreamEvent(
    trx: Transaction<Database>,
    streamEvent: NewTotallyOrderedStreamEvent
) {
    const streamOut = await createStreamOut(trx, {
        id: undefined,
        totalOrderId: streamEvent.totalOrderId,
        data: streamEvent.data
    });
    if (streamOut === undefined) {
        return undefined;
    }
    return streamOut;
}

export async function createStreamOut(
    trx: Transaction<Database>,
    streamOut: NewStreamOut
) {
    const { insertId } = await trx
        .insertInto('streamOut')
        .values({
            ...streamOut,
            data: JSON.stringify(streamOut.data),
        })
        .executeTakeFirstOrThrow();
    const streamOutResult = await findStreamOutById(trx, Number(insertId));
    if (streamOutResult === undefined) {
        throw new Error('Failed to create stream out');
    }
    return streamOutResult;
}

export async function deleteStreamOut(trx: Transaction<Database>, id: number) {
    const streamOut = await findStreamOutById(trx, id);

    if (streamOut) {
        await trx.deleteFrom('streamOut').where('id', '=', id).execute();
    }

    return streamOut;
}
