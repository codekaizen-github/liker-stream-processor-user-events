import { Transaction } from 'kysely';
import { Database } from './types';
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
} from './gameStore';
import {
    getGameUserForUpdate,
    insertIntoIgnoreGameUser,
    updateGameUser,
} from './gameUserStore';

export async function createTotallyOrderedStreamEvents(
    trx: Transaction<Database>,
    streamEvent: NewTotallyOrderedStreamEvent
): Promise<number[]> {
    console.log({
        streamEvent,
        payload: JSON.stringify(streamEvent.data.payload),
    });
    const results: number[] = [];
    try {
        switch (streamEvent.data.type) {
            case 'create-new-user-succeeded': {
                const userEmail = streamEvent.data?.payload?.user?.email;
                const existingUser = await findUserByEmail(trx, userEmail);
                if (existingUser === undefined) {
                    const newUser = await createUser(trx, {
                        email: userEmail,
                    });
                    if (newUser === undefined) {
                        throw new Error('Failed to create user');
                    }
                    results.push(newUser.id);
                } else {
                    results.push(existingUser.id);
                }
                break;
            }
            case 'game-started-succeeded': {
                const eventGame = streamEvent.data?.payload?.game;
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
                    likeCount: game.likeCount,
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
                const eventGame = streamEvent.data?.payload?.game;
                // Find the game by the game ID
                const eventUser = streamEvent.data?.payload?.user;
                // Find the game by ID to ensure it exists
                const game = await findGameByGameId(trx, eventGame.id);
                if (game === undefined) {
                    throw new Error('Game not found');
                }
                // Find the user by Email to ensure they exist
                const user = await findUserByEmail(trx, eventUser.email);
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
                const user = await findUserByEmail(trx, eventUser.email);
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
    } catch (e) {
        console.error({ e });
    }
    return results;
}
