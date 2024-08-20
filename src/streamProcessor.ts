import { Database, NewStreamIn, NewStreamOut } from './types';
import { Kysely, Transaction } from 'kysely';
import { createUser, findUserByEmail, findUsers } from './userStore';
import { notifyUserSockets } from './subscriptions';
import { UserNotFoundException } from './exceptions';
import {
    createUserEvent,
    getMostRecentUserEventByUserId,
} from './userEventStore';
import { createStreamIn, getAllStreamInsAscending } from './streamInStore';

export async function processStreamEvent(
    newStreamEvent: NewStreamIn,
    db: Kysely<Database>,
    trx: Transaction<Database>
) {
    // This is correct - data is formattted correctly
    const newStreamEventData = JSON.parse(newStreamEvent.data);
    const userEmail = newStreamEventData?.payload?.user?.email;
    if (newStreamEventData.type === 'create-new-user-succeeded') {
        const existingUser = await findUserByEmail(trx, userEmail);
        if (existingUser === undefined) {
            const newUser = await createUser(trx, {
                email: userEmail,
            });
            console.log({ newUser });
            if (newUser === undefined) {
                throw new Error('Failed to create user');
            }
            // Get all prior events that were chucked into streamIn and reprocess for this user
            const priorStreamEvents = await getAllStreamInsAscending(trx);
            for (const priorStreamEvent of priorStreamEvents) {
                const priorStreamEventData = JSON.parse(
                    JSON.stringify(priorStreamEvent.data)
                );
                switch (priorStreamEventData.type) {
                    default: {
                        const userEmail =
                            priorStreamEventData?.payload?.user?.email;
                        // By default, if a user was passed, only notify that user
                        if (
                            userEmail === undefined ||
                            userEmail === newUser.email
                        ) {
                            // Notify user
                            await writeToUserStream(
                                trx,
                                newUser.email,
                                JSON.stringify(priorStreamEventData)
                            );
                        }
                    }
                }
            }
            return;
        }
        return;
    }
    await createStreamIn(trx, { data: newStreamEvent.data });
    if (userEmail !== undefined) {
        // Notify user
        await writeToUserStream(trx, userEmail, newStreamEvent.data);
        return;
    }
    // Else notify all user streams
    const users = await findUsers(trx, {});
    console.log({ users });
    for (const user of users) {
        console.log('iterating', { user });
        await writeToUserStream(trx, user.email, newStreamEvent.data);
    }
    return;
}

export async function writeToUserStream(
    trx: Transaction<Database>,
    userEmail: string,
    streamOutData: string
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
        data: streamOutData,
    });
    if (newUserEvent === undefined) {
        throw new Error('Failed to create user event');
    }
    // non-blocking
    notifyUserSockets(newUserEvent);
}
