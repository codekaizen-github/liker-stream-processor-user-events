import { db } from './database';
import {
    getUpstreamControlForUpdate,
    insertIntoIgnoreUpstreamControl,
} from './upstreamControlStore';

interface UpstreamControl {
    id: number;
    streamId: number;
    totalOrderId: number;
}
export async function getUpstreamControl(): Promise<UpstreamControl> {
    const upstreamControl = await db
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
            return upstreamControl;
        });
    if (upstreamControl === undefined) {
        throw new Error('Failed to get upstream control lock');
    }
    return upstreamControl;
}
