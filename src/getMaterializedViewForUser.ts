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
        .leftJoin('gameUser', 'game.id', 'gameUser.gameId')
        .select([
            'game.gameId as id',
            'game.likeCount',
            'game.status',
            // 'gameUser.userId',
            'gameUser.successfulLikes',
            'gameUser.failedLikes',
        ])
        // .where('gameUser.userId', '=', userId)
        // .selectAll()
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
        //     jsonObjectFrom(
        //         eb
        //             .selectFrom('gameUser')
        //             .select([
        //                 'gameUser.successfulLikes',
        //                 'gameUser.failedLikes',
        //             ])
        //             .whereRef('gameUser.gameId', '=', 'game.id')
        //             .where('gameUser.userId', '=', userId)
        //             .orderBy('gameUser.id', 'desc')
        //             .limit(1)
        //     ).as('gameUser'),
        // ])
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
        userId,
        totalOrderId: upstreamControl?.totalOrderId,
        games: gamesArray,
    };
}
