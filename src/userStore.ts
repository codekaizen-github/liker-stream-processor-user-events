import { Transaction } from 'kysely';
import { UserUpdate, User, NewUser, Database } from './types';

export async function findUserById(trx: Transaction<Database>, id: number) {
    return await trx
        .selectFrom('user')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();
}

export async function findUsers(
    trx: Transaction<Database>,
    criteria: Partial<User>
) {
    let query = trx.selectFrom('user');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id); // Kysely is immutable, you must re-assign!
    }
    return await query.selectAll().execute();
}

export async function findUsersGreaterThanUserId(
    trx: Transaction<Database>,
    id: number
) {
    let query = trx.selectFrom('user').where('id', '>', id);
    return await query.selectAll().execute();
}

export async function getMostRecentUser(trx: Transaction<Database>) {
    return await trx
        .selectFrom('user')
        .orderBy('id', 'desc')
        .limit(1)
        .selectAll()
        .executeTakeFirst();
}

export async function updateUser(
    trx: Transaction<Database>,
    id: number,
    updateWith: UserUpdate
) {
    await trx
        .updateTable('user')
        .set(updateWith)
        .where('id', '=', id)
        .execute();
}

export async function createUser(trx: Transaction<Database>, user: NewUser) {
    const { insertId } = await trx
        .insertInto('user')
        .values(user)
        .executeTakeFirstOrThrow();

    return await findUserById(trx, Number(insertId!));
}

export async function deleteUser(trx: Transaction<Database>, id: number) {
    const user = await findUserById(trx, id);

    if (user) {
        await trx.deleteFrom('user').where('id', '=', id).execute();
    }

    return user;
}
