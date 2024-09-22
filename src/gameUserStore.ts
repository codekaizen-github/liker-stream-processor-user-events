import { Transaction } from 'kysely';
import { GameUserUpdate, GameUser, NewGameUser, Database } from './types';

export async function insertIntoIgnoreGameUser(
    trx: Transaction<Database>,
    gameUser: NewGameUser
) {
    await trx.insertInto('gameUser').values(gameUser).ignore().execute();
}

export async function getGameUserForUpdate(
    trx: Transaction<Database>,
    criteria: Partial<GameUser>
) {
    let query = trx.selectFrom('gameUser');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }

    if (criteria.userId) {
        query = query.where('userId', '=', criteria.userId);
    }

    if (criteria.gameId) {
        query = query.where('gameId', '=', criteria.gameId);
    }
    return await query.forUpdate().selectAll().executeTakeFirst();
}

export async function findGameUserById(trx: Transaction<Database>, id: number) {
    return await trx
        .selectFrom('gameUser')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findGameUsers(
    trx: Transaction<Database>,
    criteria: Partial<GameUser>
) {
    let query = trx.selectFrom('gameUser');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }

    if (criteria.userId) {
        query = query.where('userId', '=', criteria.userId);
    }

    if (criteria.gameId) {
        query = query.where('gameId', '=', criteria.gameId);
    }
    return await query.selectAll().execute();
}

export async function findGameUsersGreaterThanGameUserId(
    trx: Transaction<Database>,
    id: number
) {
    let query = trx.selectFrom('gameUser').where('id', '>', id);
    return await query.selectAll().execute();
}

export async function getMostRecentGameUser(trx: Transaction<Database>) {
    return await trx
        .selectFrom('gameUser')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateGameUser(
    trx: Transaction<Database>,
    id: number,
    updateWith: GameUserUpdate
) {
    await trx
        .updateTable('gameUser')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createGameUser(
    trx: Transaction<Database>,
    gameUser: NewGameUser
) {
    console.log('Trying to create gameUser', { gameUser });
    const { insertId } = await trx
        .insertInto('gameUser')

        .values(gameUser)
        .executeTakeFirstOrThrow();

    return await findGameUserById(trx, Number(insertId!));
}

export async function deleteGameUser(trx: Transaction<Database>, id: number) {
    const gameUser = await findGameUserById(trx, id);

    if (gameUser) {
        await trx.deleteFrom('gameUser').where('id', '=', id).execute();
    }

    return gameUser;
}
