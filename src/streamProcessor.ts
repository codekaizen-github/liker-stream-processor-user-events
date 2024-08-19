import { Database, NewStreamIn, NewStreamOut } from './types';
import { Kysely, Transaction } from 'kysely';
import { createUser, findUserByEmail, findUsers } from './userStore';
import { notifyUserSockets } from './subscriptions';
import { UserNotFoundException } from './exceptions';
import {
    createUserEvent,
    getMostRecentUserEventByUserId,
} from './userEventStore';
import {
    createStreamIn,
    findStreamIns,
    getAllStreamInsDescending,
} from './streamInStore';

export async function processStreamEvent(
    newStreamEvent: NewStreamIn,
    db: Kysely<Database>,
    trx: Transaction<Database>
) {
    await createStreamIn(trx, { data: newStreamEvent.data });
    const newStreamEventData = JSON.parse(newStreamEvent.data);
    switch (newStreamEventData.type) {
        case 'create-new-user-succeeded': {
            const userEmail = newStreamEventData.payload.user.email;
            const existingUser = await findUserByEmail(trx, userEmail);
            if (existingUser === undefined) {
                const newUser = await createUser(trx, {
                    email: userEmail,
                });
                if (newUser === undefined) {
                    throw new Error('Failed to create user');
                }
                // Get all prior events that were chucked into streamIn and reprocess for this user
                const priorStreamEvents = await getAllStreamInsDescending(trx);
                for (const priorStreamEvent of priorStreamEvents) {
                    console.log('Reprocessing stream event', priorStreamEvent);
                    const newStreamEventData = JSON.parse(newStreamEvent.data);
                    switch (newStreamEventData.type) {
                        default: {
                            const userEmail =
                                newStreamEventData?.payload?.user?.email;
                            // By default, if a user was passed, only notify that user
                            if (
                                userEmail == undefined ||
                                userEmail === newUser.email
                            ) {
                                // Notify user
                                await writeToUserStream(
                                    db,
                                    trx,
                                    userEmail,
                                    newStreamEvent
                                );
                            }
                        }
                    }
                }
            }
        }
        default: {
            const newStreamEventData = JSON.parse(newStreamEvent.data);
            switch (newStreamEventData.type) {
                default: {
                    const userEmail = newStreamEventData?.payload?.user?.email;
                    // By default, if a user was passed, only notify that user
                    if (userEmail) {
                        // Notify user
                        await writeToUserStream(
                            db,
                            trx,
                            userEmail,
                            newStreamEvent
                        );
                        break;
                    }
                    // Else notify all user streams
                    const users = await findUsers(trx, {});
                    for (const user of users) {
                        await writeToUserStream(
                            db,
                            trx,
                            user.email,
                            newStreamEvent
                        );
                    }
                    break;
                }
            }
        }
    }
}

export async function processStreamEventInUserSpecificManner(
    newStreamEvent: NewStreamOut,
    db: Kysely<Database>,
    trx: Transaction<Database>
) {
    const newStreamEventData = JSON.parse(newStreamEvent.data);
    switch (newStreamEventData.type) {
        default: {
            const userEmail = newStreamEventData?.payload?.user?.email;
            // By default, if a user was passed, only notify that user
            if (userEmail) {
                // Notify user
                await writeToUserStream(db, trx, userEmail, newStreamEvent);
                break;
            }
            // Else notify all user streams
            const users = await findUsers(trx, {});
            for (const user of users) {
                await writeToUserStream(db, trx, user.email, newStreamEvent);
            }
            break;
        }
    }
}
export async function writeToUserStream(
    db: Kysely<Database>,
    trx: Transaction<Database>,
    userEmail: string,
    streamOut: NewStreamOut
): Promise<void> {
    const existingUser = await findUserByEmail(trx, userEmail);
    if (undefined === existingUser) {
        // If user doesn't exist, ignore it
        throw new UserNotFoundException();
    }
    const mostRecentUserEventByUserId = await getMostRecentUserEventByUserId(
        trx,
        existingUser.id
    );
    const mostRecentUserEventUserEventId = mostRecentUserEventByUserId
        ? mostRecentUserEventByUserId.userEventId
        : 0;
    const newUserEvent = await createUserEvent(trx, {
        userId: existingUser.id,
        userEventId: mostRecentUserEventUserEventId + 1,
        data: JSON.stringify(streamOut),
    });
    if (newUserEvent === undefined) {
        throw new Error('Failed to create user event');
    }
    // non-blocking
    notifyUserSockets(newUserEvent);
}
