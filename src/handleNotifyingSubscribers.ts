import { TotallyOrderedStreamEvent } from './transmissionControl/types';
import { db } from './database';
import { clientsByEmail } from './server';
import ws from 'ws';
import { findUserByEmail, findUsers } from './userStore';
import { findTotallyOrderedUserStreamEvents } from './userEventStore';

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
                    const userEvents = await findTotallyOrderedUserStreamEvents(
                        trx,
                        {
                            totalOrderId: streamOut.totalOrderId,
                            userId: user.id,
                        }
                    );
                    if (userEvents === undefined) {
                        continue;
                    }
                    for (const userEvent of userEvents) {
                        // Instead of sending the userEvent.id as the id property, send the userEvent.userEventId
                        // This is because to each client, the ids should appear as if they are unique to that client
                        client.send(
                            JSON.stringify({
                                id: userEvent.userEventId,
                                totalOrderId: userEvent.totalOrderId,
                                data: userEvent.data,
                            })
                        );
                    }
                }
            }
        });
}
