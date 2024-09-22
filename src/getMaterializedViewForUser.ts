import { Transaction } from 'kysely';
import { Database } from './types';
import { jsonArrayFrom } from 'kysely/helpers/mysql';
import { getUpstreamControlForTransaction } from './getUpstreamControl';

export async function getMaterializedViewForUser(
    trx: Transaction<Database>,
    userId: number
) {
    // Get totalOrderId
    const upstreamControl = await getUpstreamControlForTransaction(trx);
    // Get all games
    const games = await trx
        .selectFrom('game')
        .selectAll()
        .select((eb) => [
            // gameUser
            jsonArrayFrom(
                eb
                    .selectFrom('gameUser')
                    .select([
                        'gameUser.successfulLikes',
                        'gameUser.failedLikes',
                    ])
                    .whereRef('gameUser.gameId', '=', 'game.id')
                    .where('gameUser.userId', '=', userId)
                    .orderBy('gameUser.id', 'desc')
            ).as('gameUser'),
        ])
        .execute();
    return { userId, totalOrderId: upstreamControl?.totalOrderId, games };
}
