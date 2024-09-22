import { db } from './database';
import { clientsByEmail } from './server';
import ws from 'ws';
import { findUserByEmail } from './userStore';
import { getMaterializedViewForUser } from './getMaterializedViewForUser';

export async function handleNotifyingSubscribers(
    userIds?: number[]
): Promise<void> {
    // TODO If userIds is undefined, push all materialized views to all clients. Else, only push those that are relevant to the userIds
    // Loop through each connected client
    db.transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            if (userIds !== undefined) {
            }
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
                    if (userIds !== undefined && !userIds.includes(user.id)) {
                        continue;
                    }
                    const materializedView = await getMaterializedViewForUser(
                        trx,
                        user.id
                    );
                    client.send(JSON.stringify(materializedView));
                    // // Get userEvents where totalOrderId = streamOut.totalOrderId
                    // const userEvents = await findTotallyOrderedUserStreamEvents(
                    //     trx,
                    //     {
                    //         totalOrderId: streamOut.totalOrderId,
                    //         userId: user.id,
                    //     }
                    // );
                    // if (userEvents === undefined) {
                    //     continue;
                    // }
                    // for (const userEvent of userEvents) {
                    //     // Instead of sending the userEvent.id as the id property, send the userEvent.userEventId
                    //     // This is because to each client, the ids should appear as if they are unique to that client
                    //     client.send(
                    //         JSON.stringify({
                    //             id: userEvent.userEventId,
                    //             totalOrderId: userEvent.totalOrderId,
                    //             data: userEvent.data,
                    //         })
                    //     );
                    // }
                }
            }
        });
}
