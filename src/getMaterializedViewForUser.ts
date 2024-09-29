import { Transaction } from 'kysely';
import { Database } from './types';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/mysql';
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
        .leftJoin('gameUser', (eb) => {
            return eb
                .onRef('game.id', '=', 'gameUser.gameId')
                .on('gameUser.userId', '=', userId);
        })
        // .leftJoin('gameUser', 'game.id', 'gameUser.gameId')
        .select([
            'game.gameId as id',
            'game.likeCount',
            'game.status',
            // 'gameUser.userId',
            'gameUser.successfulLikes',
            'gameUser.failedLikes',
        ])
        .where(({ and, or, eb, not, exists, selectFrom }) =>
            or([
                eb('gameUser.userId', '=', userId),
                eb('gameUser.userId', 'is', null),
            ])
        )
        // .select((eb) => [
        //     // gameUser
        //     // jsonArrayFrom(
        //     //     eb
        //     //         .selectFrom('gameUser')
        //     //         .select([
        //     //             'gameUser.successfulLikes',
        //     //             'gameUser.failedLikes',
        //     //         ])
        //     //         .whereRef('gameUser.gameId', '=', 'game.id')
        //     //         .where('gameUser.userId', '=', userId)
        //     //         .orderBy('gameUser.id', 'desc')
        //     // ).as('gameUser'),
        //     // jsonObjectFrom(
        //     eb
        //         .selectFrom('gameUser')
        //         .select(['gameUser.successfulLikes', 'gameUser.failedLikes'])
        //         .whereRef('gameUser.gameId', '=', 'game.id')
        //         .where('gameUser.userId', '=', userId)
        //         .orderBy('gameUser.id', 'desc')
        //         .limit(1),
        //     // ).as('gameUser'),
        // ])
        // .select(['game.gameId as id', 'game.likeCount', 'game.status'])
        .stream();
    const gamesArray: {
        likeCount: number;
        status: number;
        successfulLikes: number | null;
        failedLikes: number | null;
        id: number;
    }[] = [];
    for await (const game of games) {
        gamesArray.push({
            ...game,
            successfulLikes: game.successfulLikes ?? 0,
            failedLikes: game.failedLikes ?? 0,
        });
    }
    return {
        totalOrderId: upstreamControl?.totalOrderId ?? 0,
        userId,
        games: gamesArray,
    };
}
