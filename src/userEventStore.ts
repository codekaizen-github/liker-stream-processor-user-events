import { Transaction } from 'kysely';
import { UserEventUpdate, UserEvent, NewUserEvent, Database } from './types';

export async function findUserEventById(
    trx: Transaction<Database>,
    id: number
) {
    return await trx
        .selectFrom('userEvent')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findUserEvents(
    trx: Transaction<Database>,
    criteria: Partial<UserEvent>
) {
    let query = trx.selectFrom('userEvent');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }
    if (criteria.totalOrderId) {
        query = query.where('totalOrderId', '=', criteria.totalOrderId);
    }
    if (criteria.userId) {
        query = query.where('userId', '=', criteria.userId);
    }
    if (criteria.userEventId) {
        query = query.where('userEventId', '=', criteria.userEventId);
    }
    return await query.selectAll().execute();
}

export async function findUserEventsGreaterThanUserEventId(
    trx: Transaction<Database>,
    userId: number,
    userEventId: number
) {
    let query = trx
        .selectFrom('userEvent')
        .where('userId', '=', userId)
        .where('userEventId', '>', userEventId);
    return await query.selectAll().execute();
}

export async function getMostRecentUserEventByUserId(
    trx: Transaction<Database>,
    userId: number
) {
    return await trx
        .selectFrom('userEvent')
        .where('userId', '=', userId)
        .orderBy('userEventId', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateUserEvent(
    trx: Transaction<Database>,
    id: number,
    updateWith: UserEventUpdate
) {
    await trx
        .updateTable('userEvent')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createUserEvent(
    trx: Transaction<Database>,
    userEvent: NewUserEvent
) {
    const { insertId } = await trx
        .insertInto('userEvent')
        .values(userEvent)
        .executeTakeFirstOrThrow();

    return await findUserEventById(trx, Number(insertId!));
}

export async function deleteUserEvent(trx: Transaction<Database>, id: number) {
    const userEvent = await findUserEventById(trx, id);

    if (userEvent) {
        await trx.deleteFrom('userEvent').where('id', '=', id).execute();
    }

    return userEvent;
}
