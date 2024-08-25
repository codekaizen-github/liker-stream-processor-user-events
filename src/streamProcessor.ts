import { Database, NewStreamEvent, NewStreamIn, NewStreamOut, UserEvent } from './types';
import { Kysely, Transaction } from 'kysely';
import { createUser, findUserByEmail, findUsers } from './userStore';
import { UserNotFoundException } from './exceptions';
import {
    createUserEventFromStreamEvent,
    getMostRecentUserEventByUserId,
} from './userEventStore';
import {
    createStreamInFromStreamEvent,
    getAllStreamInsAscending,
} from './streamInStore';

export async function processStreamEvent(
    trx: Transaction<Database>,
    newStreamEvent: NewStreamEvent
) {
    // This is correct - data is formattted correctly
    const newStreamEventData = newStreamEvent.data;
    console.log({ newStreamEvent: JSON.stringify(newStreamEvent) });
    const userEmail = newStreamEventData?.payload?.user?.email;
    if (newStreamEventData.type === 'create-new-user-succeeded') {
        const existingUser = await findUserByEmail(trx, userEmail);
        console.log({ existingUser });
        if (existingUser === undefined) {
            const newUser = await createUser(trx, {
                email: userEmail,
            });
            if (newUser === undefined) {
                throw new Error('Failed to create user');
            }
            // Get all prior events that were chucked into streamIn and reprocess for this user
            const priorStreamEvents = await getAllStreamInsAscending(trx);
            for (const priorStreamEvent of priorStreamEvents) {
                const priorStreamEventData = priorStreamEvent.data;
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
                                priorStreamEventData
                            );
                        }
                    }
                }
            }
            return;
        }
        return;
    }
    await createStreamInFromStreamEvent(trx, { data: newStreamEvent.data });
    if (userEmail !== undefined) {
        // Notify user
        await writeToUserStream(trx, userEmail, newStreamEvent.data);
        return;
    }
    // Else notify all user streams
    const users = await findUsers(trx, {});
    for (const user of users) {
        await writeToUserStream(trx, user.email, newStreamEvent.data);
    }
    return;
}

export async function writeToUserStream(
    trx: Transaction<Database>,
    userEmail: string,
    streamOutData: any
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
    const newUserEvent = await createUserEventFromStreamEvent(trx, {
        userId: existingUser.id,
        userEventId: mostRecentUserEventUserEventId + 1,
        data: streamOutData,
    });
    if (newUserEvent === undefined) {
        throw new Error('Failed to create user event');
    }
    // non-blocking
    notifyUserSockets(userEmail, newUserEvent);
}

export async function notifyUserSockets(
    userEmail: string,
    userEvent: UserEvent
): Promise<void> {
    // Notify user sockets
    // const clients = clientsByEmail.get(userEmail)?.write(JSON.stringify(userEvent));
}
