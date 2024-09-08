import { db } from '../database';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';
import {
    getUpstreamControlForUpdate,
    insertIntoIgnoreUpstreamControl,
    updateUpstreamControl,
} from '../upstreamControlStore';
import { processStreamEvent } from './processStreamEvent';
import { TotallyOrderedStreamEvent } from './types';

export async function onEventProcessSingle(event: TotallyOrderedStreamEvent) {
    const results = await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const upstreamForUpdateLock = await getUpstreamControlForUpdate(
                trx,
                0
            ); // Prevents duplicate entry keys and insertions in other tables
            const upstreamControlIgnore = await insertIntoIgnoreUpstreamControl(
                trx,
                {
                    id: 0,
                    streamId: 0,
                    totalOrderId: 0,
                }
            );
            const upstreamControl = await getUpstreamControlForUpdate(trx, 0);
            console.log({
                event: event,
                upstreamControl,
            });
            if (upstreamControl === undefined) {
                throw new Error('Failed to get upstream control lock');
            }
            if (upstreamControl.streamId >= event.id) {
                throw new StreamEventIdDuplicateException();
            }
            if (upstreamControl.streamId + 1 === event.id) {
                console.log('we have a winner!');
                const results = await processStreamEvent(trx, event);
                const upstreamControlToUpdate = {
                    id: 0,
                    streamId: event.id,
                    totalOrderId: event.totalOrderId,
                };
                console.log({ upstreamControlToUpdate });
                await updateUpstreamControl(trx, 0, upstreamControlToUpdate);
                return results;
            }
            throw new StreamEventOutOfSequenceException();
        });
    return results;
}
