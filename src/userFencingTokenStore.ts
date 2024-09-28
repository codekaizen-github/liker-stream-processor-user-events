import { sql, Transaction } from 'kysely';
import {
    UserFencingTokenUpdate,
    UserFencingToken,
    NewUserFencingToken,
    Database,
} from './types';

export async function findUserFencingTokenById(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('userFencingToken')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findUserFencingTokens(
    trx: Transaction<Database>,
    criteria: Partial<UserFencingToken>
) {
    let query = trx.selectFrom('userFencingToken');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }

    if (criteria.userId) {
        query = query.where('userId', '=', criteria.userId); // Kysely is immutable, you must re-assign!
    }

    if (criteria.totalOrderId) {
        query = query.where('totalOrderId', '=', criteria.totalOrderId); // Kysely is immutable, you must re-assign!
    }

    if (criteria.fencingToken) {
        query = query.where('fencingToken', '=', criteria.fencingToken); // Kysely is immutable, you must re-assign
    }

    return await query.selectAll().execute();
}

export async function getMostRecentUserFencingToken(
    trx: Transaction<Database>
) {
    console.log('getMostRecentUserFencingToken');
    return await trx
        .selectFrom('userFencingToken')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function getUserFencingTokenForUpdate(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('userFencingToken')
        .where('id', '=', id)
        .forUpdate()
        .selectAll()
        .executeTakeFirst();
}

export async function getUserFencingTokenForUpdateByUserId(
    trx: Transaction<Database>,
    userId: number
) {
    return await trx
        .selectFrom('userFencingToken')
        .where('userId', '=', userId)
        .forUpdate()
        .selectAll()
        .executeTakeFirst();
}

export async function updateUserFencingToken(
    trx: Transaction<Database>,
    id: number,
    updateWith: UserFencingTokenUpdate
) {
    await trx
        .updateTable('userFencingToken')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createUserFencingToken(
    trx: Transaction<Database>,
    userFencingToken: NewUserFencingToken
) {
    const { insertId } = await trx
        .insertInto('userFencingToken')
        .values(userFencingToken)
        .executeTakeFirstOrThrow();

    return await findUserFencingTokenById(trx, Number(insertId!));
}

export async function insertIntoIgnoreUserFencingToken(
    trx: Transaction<Database>,
    userFencingToken: NewUserFencingToken
) {
    await trx
        .insertInto('userFencingToken')
        .values(userFencingToken)
        .ignore()
        .execute();
}

export async function deleteUserFencingToken(
    trx: Transaction<Database>,
    id: number
) {
    const userFencingToken = await findUserFencingTokenById(trx, id);

    if (userFencingToken) {
        await trx.deleteFrom('userFencingToken').where('id', '=', id).execute();
    }

    return userFencingToken;
}
