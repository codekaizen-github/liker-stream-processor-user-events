import { Transaction } from 'kysely';
import { GameUpdate, Game, NewGame, Database } from './types';

export async function findGameById(trx: Transaction<Database>, id: number) {
    return await trx
        .selectFrom('game')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findGameByGameId(trx: Transaction<Database>, gameId: number) {
    return await trx
        .selectFrom('game')
        .where('gameId', '=', gameId)
        .selectAll()
        .executeTakeFirst();
}

export async function findGameForUpdateByGameId(
    trx: Transaction<Database>,
    gameId: number
) {
    return await trx
        .selectFrom('game')
        .forUpdate()
        .where('gameId', '=', gameId)
        .selectAll()
        .executeTakeFirst();
}

export async function findGames(
    trx: Transaction<Database>,
    criteria: Partial<Game>
) {
    let query = trx.selectFrom('game');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }

    return await query.selectAll().execute();
}

export async function findGamesGreaterThanGameId(
    trx: Transaction<Database>,
    id: number
) {
    let query = trx.selectFrom('game').where('id', '>', id);
    return await query.selectAll().execute();
}

export async function getMostRecentGame(trx: Transaction<Database>) {
    return await trx
        .selectFrom('game')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateGame(
    trx: Transaction<Database>,
    id: number,
    updateWith: GameUpdate
) {
    await trx
        .updateTable('game')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function updateGamesStatuses(trx: Transaction<Database>, currentStatus: number, newStatus: number) {
    await trx
        .updateTable('game')
        .set({status: newStatus})
        .where('status', '=', currentStatus)
        .execute();
}

export async function createGame(trx: Transaction<Database>, game: NewGame) {
    console.log('Trying to create game', { game });
    const { insertId } = await trx
        .insertInto('game')

        .values(game)
        .executeTakeFirstOrThrow();

    return await findGameById(trx, Number(insertId!));
}

export async function deleteGame(trx: Transaction<Database>, id: number) {
    const game = await findGameById(trx, id);

    if (game) {
        await trx.deleteFrom('game').where('id', '=', id).execute();
    }

    return game;
}
