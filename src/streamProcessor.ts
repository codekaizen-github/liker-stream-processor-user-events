import { Response } from 'express';
import { createStreamOut } from './streamOutStore';
import { notifySubscribers } from './subscriptions';
import { Database, NewStreamOut } from './types';
import { Kysely, Transaction } from 'kysely';
import { createGame, findGameById, updateGame } from './gameStore';

export async function processStreamEvent(
    newStreamEvent: NewStreamOut,
    res: Response,
    db: Kysely<Database>,
    trx: Transaction<Database>
) {
    const newStreamEventData = JSON.parse(newStreamEvent.data);
    switch (newStreamEventData.type) {
        case 'like-intended': {
            // Get the game id
            const gameId = newStreamEventData.payload.gameId;
            // Get the game state
            const game = await findGameById(trx, gameId);
            if (game !== undefined && game.likeCount < 50) {
                await updateGame(trx, gameId, {
                    likeCount: game.likeCount + 1,
                });
                const newStreamOut = {
                    data: JSON.stringify({
                        ...newStreamEventData,
                        type: 'like-succeeded',
                    }),
                };
                const streamOut = await createStreamOut(trx, newStreamOut);
                if (streamOut === undefined) {
                    res.status(500).send();
                    break;
                }
                notifySubscribers(db, streamOut);
                break;
            }
            const newStreamOut = {
                data: JSON.stringify({
                    ...newStreamEventData,
                    type: 'like-failed',
                }),
            };
            const streamOut = await createStreamOut(trx, newStreamOut);
            if (streamOut === undefined) {
                res.status(500).send();
                break;
            }
            notifySubscribers(db, streamOut);
            break;
        }
        case 'new-game-intended': {
            const newGame = await createGame(trx, {
                likeCount: 0,
            });
            if (newGame === undefined) {
                res.status(500).send();
                break;
            }
            const newStreamOut = {
                data: JSON.stringify({
                    ...newStreamEventData,
                    type: 'new-game-succeeded',
                    payload: {
                        ...newStreamEventData.payload,
                        gameId: newGame.id,
                    },
                }),
            };
            const streamOut = await createStreamOut(trx, newStreamOut);
            if (streamOut === undefined) {
                res.status(500).send();
                break;
            }
            notifySubscribers(db, streamOut);
            break;
        }
        default: {
            return res.status(400).send();
        }
    }
}
