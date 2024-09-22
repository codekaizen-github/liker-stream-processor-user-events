import { Transaction } from 'kysely';
import { db } from './database';
import { findUpstreamControlById } from './upstreamControlStore';
import { Database } from './types';

interface UpstreamControl {
    id: number;
    streamId: number;
    totalOrderId: number;
}
export async function getUpstreamControl(): Promise<
    UpstreamControl | undefined
> {
    const upstreamControl = await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const upstreamControl = await findUpstreamControlById(trx, 0);
            return upstreamControl;
        });
    return upstreamControl;
}

export async function getUpstreamControlForTransaction(
    trx: Transaction<Database>
) {
    const upstreamControl = await findUpstreamControlById(trx, 0);
    return upstreamControl;
}
