import { Transaction } from 'kysely';
import { Database, UserEvent } from './types';
import {
    NewTotallyOrderedStreamEvent,
    TotallyOrderedStreamEvent,
} from './transmissionControl/types';
import { createUser, findUserByEmail, findUsers } from './userStore';
import {
    createStreamOutFromStreamEvent,
    getAllStreamOutsAscending,
} from './streamOutStore';
import { UserNotFoundException } from './exceptions';
import {
    createUserEvent,
    getMostRecentUserEventByUserId,
} from './userEventStore';

export async function createTotallyOrderedStreamEvents(
    trx: Transaction<Database>,
    streamEvent: NewTotallyOrderedStreamEvent
): Promise<TotallyOrderedStreamEvent[]> {
    const results: TotallyOrderedStreamEvent[] = [];
    const userEmail = streamEvent.data?.payload?.user?.email;
    if (streamEvent.data.type === 'create-new-user-succeeded') {
        const existingUser = await findUserByEmail(trx, userEmail);
        if (existingUser === undefined) {
            const newUser = await createUser(trx, {
                email: userEmail,
            });
            if (newUser === undefined) {
                throw new Error('Failed to create user');
            }
            // Get all prior events that were chucked into streamOut and reprocess for this user
            const priorStreamEvents = await getAllStreamOutsAscending(trx);
            for (const priorStreamEvent of priorStreamEvents) {
                switch (priorStreamEvent.data.type) {
                    default: {
                        const userEmail =
                            priorStreamEvent.data?.payload?.user?.email;
                        // By default, if a user was passed, only notify that user
                        if (
                            userEmail === undefined ||
                            userEmail === newUser.email
                        ) {
                            // Notify user
                            const userStreamEvent =
                                await writeToUserStreamEventsByEmail(
                                    trx,
                                    newUser.email,
                                    priorStreamEvent
                                );
                        }
                    }
                }
            }
        }
    }
    // This is the only one we will return
    const streamOut = await createStreamOutFromStreamEvent(trx, streamEvent);
    if (streamOut === undefined) {
        throw new Error('Failed to create stream in');
    }
    if (userEmail !== undefined) {
        // Notify user
        const userEvent = await writeToUserStreamEventsByEmail(
            trx,
            userEmail,
            streamOut
        );
        return results;
    }
    // Else notify all user streams
    const users = await findUsers(trx, {});
    for (const user of users) {
        const userEvent = await writeToUserStreamEventsByEmail(
            trx,
            user.email,
            streamOut
        );
    }
    results.push(streamOut);
    return results;
}

export async function writeToUserStreamEventsByEmail(
    trx: Transaction<Database>,
    userEmail: string,
    totallyOrderedStreamEvent: TotallyOrderedStreamEvent
): Promise<UserEvent> {
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
        ...totallyOrderedStreamEvent,
        userId: existingUser.id,
        userEventId: mostRecentUserEventUserEventId + 1,
    });
    if (newUserEvent === undefined) {
        throw new Error('Failed to create user event');
    }
    return newUserEvent;
}
