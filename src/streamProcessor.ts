import { Database, NewStreamOut } from './types';
import { Kysely, Transaction } from 'kysely';
import { createUser, findUsers } from './userStore';

export async function processStreamEvent(
    newStreamEvent: NewStreamOut,
    db: Kysely<Database>,
    trx: Transaction<Database>
) {
    const newStreamEventData = JSON.parse(newStreamEvent.data);
    switch (newStreamEventData.type) {
        case 'create-new-user-succeeded': {
            const userEmail = newStreamEventData.payload.user.email;
            const existingUser = await findUsers(trx, { email: userEmail });
            if (existingUser.length === 0) {
                const newUser = await createUser(trx, {
                    email: userEmail,
                });
                if (newUser === undefined) {
                    throw new Error('Failed to create user');
                }
            }
            // no break - will continue to the next case
        }
    }
}
