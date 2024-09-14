import { Transaction } from 'kysely';
import { Database, UserEvent } from './types';
import {
    NewTotallyOrderedStreamEvent,
    TotallyOrderedStreamEvent,
} from './transmissionControl/types';
import { createUser, findUserByEmail, findUsers } from './userStore';
import {
    createStreamOutFromStreamEvent,
    findTotallyOrderedStreamEvents,
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
    console.log('createTotallyOrderedStreamEvents', { streamEvent });
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
            const priorStreamEvents = await findTotallyOrderedStreamEvents(trx);
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
                            console.log('notifying user after creating', {
                                newUser,
                            });
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
    console.log('before createStreamOutFromStreamEvent');
    const streamOut = await createStreamOutFromStreamEvent(trx, streamEvent);

    console.log('after createStreamOutFromStreamEvent');

    if (streamOut === undefined) {
        throw new Error('Failed to create stream in');
    }
    results.push(streamOut);
    if (userEmail !== undefined) {
        console.log('notifying user because event is specific to them', {
            userEmail,
        });
        // Notify user
        try {
            const userEvent = await writeToUserStreamEventsByEmail(
                trx,
                userEmail,
                streamOut
            );
        } catch (e) {
            if (e instanceof UserNotFoundException) {
                console.error('User not found: ', { userEmail });
                return results;
            }
            throw e;
        }
        return results;
    }
    // Else notify all user streams
    const users = await findUsers(trx, {});
    for (const user of users) {
        console.log('notifying user because all users', { user });
        try {
        } catch (e) {
            if (e instanceof UserNotFoundException) {
                console.error('User not found: ', { userEmail });
                continue;
            }
            throw e;
        }
        const userEvent = await writeToUserStreamEventsByEmail(
            trx,
            user.email,
            streamOut
        );
    }
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
        totalOrderId: totallyOrderedStreamEvent.totalOrderId,
        userId: existingUser.id,
        userEventId: mostRecentUserEventUserEventId + 1,
        data: totallyOrderedStreamEvent.data,
    });
    if (newUserEvent === undefined) {
        throw new Error('Failed to create user event');
    }
    return newUserEvent;
}
