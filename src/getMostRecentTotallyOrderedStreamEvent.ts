import { db } from './database';
import { getMostRecentStreamOut } from './streamOutStore';
import { TotallyOrderedStreamEvent } from './transmissionControl/types';

export async function getMostRecentTotallyOrderedStreamEvent(): Promise<
    TotallyOrderedStreamEvent | undefined
> {
    return db.transaction().execute(async (trx) => {
        const streamOut = await getMostRecentStreamOut(trx);
        if (streamOut === undefined) {
            return undefined;
        }
        return streamOut;
    });
}
