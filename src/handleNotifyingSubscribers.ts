import {
    TotallyOrderedStreamEvent,
    TotallyOrderedUserStreamEvent,
} from './transmissionControl/types';
import { db } from './database';
import { clientsByEmail } from './server';
import ws from 'ws';
import { findUserByEmail, findUsers } from './userStore';
import { findUserEvents } from './userEventStore';

export async function handleNotifyingSubscribers(
    streamOut: TotallyOrderedStreamEvent
): Promise<void> {
    // Loop through each connected client
    db.transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            for (const [email, clients] of clientsByEmail) {
                for (const client of clients) {
                    if (client.readyState !== ws.WebSocket.OPEN) {
                        continue;
                    }
                    // Get the user by email
                    const user = await findUserByEmail(trx, email);
                    if (user === undefined) {
                        continue;
                    }
                    // Get userEvents where totalOrderId = streamOut.totalOrderId
                    const userEvents = await findUserEvents(trx, {
                        totalOrderId: streamOut.totalOrderId,
                    });
                    if (userEvents === undefined) {
                        continue;
                    }
                    for (const userEvent of userEvents) {
                        client.send(JSON.stringify(userEvent));
                    }
                }
            }
        });
}
