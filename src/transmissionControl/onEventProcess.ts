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
import { UpstreamControlUpdate } from '../types';

export async function onEventProcess(
    events: TotallyOrderedStreamEvent[],
    totalOrderId: number
): Promise<number[]> {
    const results = await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const results: number[] = [];
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
            if (upstreamControl === undefined) {
                throw new Error('Failed to get upstream control lock');
            }
            const upstreamControlToUpdate = {
                id: 0,
                streamId: upstreamControl.streamId,
                totalOrderId: totalOrderId,
            };
            for (const event of events) {
                try {
                    if (upstreamControlToUpdate.streamId >= event.streamId) {
                        throw new StreamEventIdDuplicateException();
                    }
                    // todo: streamId used for the new event should be based upon a counter, not autoincrement. We will need to create a counter for this as well. Maybe in a different table from upstreamControl?
                    if (
                        upstreamControlToUpdate.streamId + 1 ===
                        event.streamId
                    ) {
                        results.push(...(await processStreamEvent(trx, event)));
                        upstreamControlToUpdate.streamId = event.streamId;
                        continue;
                    }
                    throw new StreamEventOutOfSequenceException();
                } catch (e) {
                    if (e instanceof StreamEventIdDuplicateException) {
                        continue;
                    }
                    throw e;
                }
            }
            console.log({ upstreamControlToUpdate });
            await updateUpstreamControl(trx, 0, upstreamControlToUpdate);
            return results;
        });
    return results;
}
