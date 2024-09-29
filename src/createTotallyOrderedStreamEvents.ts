import { Transaction } from 'kysely';
import { Database, User } from './types';
import {
    NewTotallyOrderedStreamEvent,
    TotallyOrderedStreamEvent,
} from './transmissionControl/types';
import { createUser, findUserByEmail, findUsers } from './userStore';
import {
    createGame,
    findGameById,
    findGameForUpdateByGameId,
    updateGame,
    findGameByGameId,
    findGames,
    updateGamesStatuses,
} from './gameStore';
import {
    getGameUserForUpdate,
    insertIntoIgnoreGameUser,
    updateGameUser,
} from './gameUserStore';
import {
    createUserFencingToken,
    findUserFencingTokens,
    insertIntoIgnoreUserFencingToken,
} from './userFencingTokenStore';

export async function createTotallyOrderedStreamEvents(
    trx: Transaction<Database>,
    streamEvent: NewTotallyOrderedStreamEvent
): Promise<number[]> {
    const results: number[] = [];
    const userEmail = streamEvent.data?.payload?.user?.email;
    let user = await findUserByEmail(trx, userEmail);
    const fencingTokenInput = streamEvent.data?.payload?.fencingToken;
    // Do NOT have a check on fencingToken uniqueness here because we have upstreams that will create multiple events from a single fencingToken and pass them all down
    // if (fencingTokenInput !== undefined && fencingTokens.length !== 0) {
    //     // Fencing token already used, do nothing
    //     return results;
    // }
    if (streamEvent.data.type === 'create-new-user-succeeded') {
        if (user === undefined) {
            user = await createUser(trx, {
                email: userEmail,
            });
            if (user === undefined) {
                throw new Error('Failed to create user');
            }
            results.push(user.id);
        }
    }
    switch (streamEvent.data.type) {
        case 'game-started-succeeded': {
            const eventGame = streamEvent.data?.payload?.game;
            await updateGamesStatuses(trx, 0, 1);
            await createGame(trx, {
                gameId: eventGame.id,
                likeCount: eventGame.likeCount,
                status: 0,
            });
            const users = await findUsers(trx, {});
            results.push(...users.map((user) => user.id));
            break;
        }
        case 'game-updated': {
            const eventGame = streamEvent.data?.payload?.game;
            // Find the game by the game ID
            const game = await findGameForUpdateByGameId(trx, eventGame.id);
            if (game === undefined) {
                throw new Error('Game not found');
            }
            await updateGame(trx, game.id, {
                likeCount: eventGame.likeCount,
            });
            const users = await findUsers(trx, {});
            results.push(...users.map((user) => user.id));
            break;
        }
        case 'game-completed': {
            const eventGame = streamEvent.data?.payload?.game;
            // Find the game by the game ID
            const game = await findGameForUpdateByGameId(trx, eventGame.id);
            if (game === undefined) {
                throw new Error('Game not found');
            }
            await updateGame(trx, game.id, {
                likeCount: game.likeCount,
                status: 1,
            });
            const users = await findUsers(trx, {});
            results.push(...users.map((user) => user.id));
            break;
        }
        case 'like-succeeded': {
            // Find the user by Email to ensure they exist
            if (user === undefined) {
                throw new Error('User not found');
            }
            const eventGame = streamEvent.data?.payload?.game;
            // Find the game by ID to ensure it exists
            const game = await findGameByGameId(trx, eventGame.id);
            if (game === undefined) {
                throw new Error('Game not found');
            }
            await getGameUserForUpdate(trx, {
                gameId: game.id,
                userId: user.id,
            });
            // Insert ignore
            await insertIntoIgnoreGameUser(trx, {
                gameId: game.id,
                userId: user.id,
                successfulLikes: 0,
                failedLikes: 0,
            });
            const gameUser = await getGameUserForUpdate(trx, {
                gameId: game.id,
                userId: user.id,
            });
            if (gameUser === undefined) {
                throw new Error('GameUser not found');
            }
            // Update the game user with the new like count
            await updateGameUser(trx, gameUser.id, {
                successfulLikes: gameUser.successfulLikes + 1,
            });
            results.push(user.id);
            break;
        }
        case 'like-failed': {
            const eventGame = streamEvent.data?.payload?.game;
            // Find the game by the game ID
            const eventUser = streamEvent.data?.payload?.user;
            // Find the game by ID to ensure it exists
            const game = await findGameByGameId(trx, eventGame.id);
            if (game === undefined) {
                throw new Error('Game not found');
            }
            // Find the user by Email to ensure they exist
            user = await findUserByEmail(trx, eventUser.email);
            if (user === undefined) {
                throw new Error('User not found');
            }
            await getGameUserForUpdate(trx, {
                gameId: game.id,
                userId: user.id,
            });
            // Insert ignore
            await insertIntoIgnoreGameUser(trx, {
                gameId: game.id,
                userId: user.id,
                successfulLikes: 0,
                failedLikes: 0,
            });
            const gameUser = await getGameUserForUpdate(trx, {
                gameId: game.id,
                userId: user.id,
            });
            if (gameUser === undefined) {
                throw new Error('GameUser not found');
            }
            // Update the game user with the new like count
            await updateGameUser(trx, gameUser.id, {
                failedLikes: gameUser.failedLikes + 1,
            });
            results.push(user.id);
            break;
        }
        default: {
            break;
        }
    }
    if (fencingTokenInput !== undefined && user !== undefined) {
        await insertIntoIgnoreUserFencingToken(trx, {
            userId: user.id,
            fencingToken: fencingTokenInput,
            totalOrderId: streamEvent.totalOrderId,
        });
    }

    return results;
}
