import { sql, Transaction } from 'kysely';
import {
    UpstreamControlUpdate,
    UpstreamControl,
    NewUpstreamControl,
    Database,
} from './types';

export async function findUpstreamControlById(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('upstreamControl')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findUpstreamControls(
    trx: Transaction<Database>,
    criteria: Partial<UpstreamControl>
) {
    let query = trx.selectFrom('upstreamControl');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }

    return await query.selectAll().execute();
}

export async function getMostRecentUpstreamControl(trx: Transaction<Database>) {
    console.log('getMostRecentUpstreamControl');
    return await trx
        .selectFrom('upstreamControl')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function getUpstreamControlForUpdate(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('upstreamControl')
        .where('id', '=', id)
        .forUpdate()
        .selectAll()
        .executeTakeFirst();
}

export async function updateUpstreamControl(
    trx: Transaction<Database>,
    id: number,
    updateWith: UpstreamControlUpdate
) {
    await trx
        .updateTable('upstreamControl')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createUpstreamControl(
    trx: Transaction<Database>,
    upstreamControl: NewUpstreamControl
) {
    const { insertId } = await trx
        .insertInto('upstreamControl')
        .values(upstreamControl)
        .executeTakeFirstOrThrow();

    return await findUpstreamControlById(trx, Number(insertId!));
}

export async function insertIntoIgnoreUpstreamControl(
    trx: Transaction<Database>,
    upstreamControl: NewUpstreamControl
) {
    await trx
        .insertInto('upstreamControl')
        .values(upstreamControl)
        .ignore()
        .execute();
}

export async function deleteUpstreamControl(
    trx: Transaction<Database>,
    id: number
) {
    const upstreamControl = await findUpstreamControlById(trx, id);

    if (upstreamControl) {
        await trx.deleteFrom('upstreamControl').where('id', '=', id).execute();
    }

    return upstreamControl;
}
