import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('upstreamControl')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey())
        .addColumn('streamId', 'integer', (col) => col.notNull())
        .addColumn('totalOrderId', 'integer', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('user')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
        .execute();
    await db.schema
        .createTable('userFencingToken')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('totalOrderId', 'integer', (col) => col.notNull())
        .addColumn('userId', 'integer', (col) => col.notNull())
        .addColumn('fencingToken', 'integer', (col) => col.notNull())
        .addForeignKeyConstraint(
            'fk_userFencingToken_userId',
            ['userId'],
            'user',
            ['id']
        )
        .execute();
    // Add a foreign key constraint
    // await sql`ALTER TABLE userFencingToken ADD CONSTRAINT fk_userFencingToken_userId FOREIGN KEY (userId) REFERENCES user(id)`.execute(
    //     db
    // );
    await db.schema
        .createTable('game')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('gameId', 'integer', (col) => col.notNull().unique())
        .addColumn('likeCount', 'integer', (col) => col.notNull())
        .addColumn('status', 'integer', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('gameUser')
        .ifNotExists()
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('gameId', 'integer', (col) => col.notNull())
        .addColumn('userId', 'integer', (col) => col.notNull())
        .addColumn('successfulLikes', 'integer', (col) => col.notNull())
        .addColumn('failedLikes', 'integer', (col) => col.notNull())
        .addUniqueConstraint('unique_user_game', ['gameId', 'userId'])
        .addForeignKeyConstraint('fk_gameUser_gameId', ['gameId'], 'game', [
            'id',
        ])
        .addForeignKeyConstraint('fk_gameUser_userId', ['userId'], 'user', [
            'id',
        ])
        .execute();
    // await sql`ALTER TABLE gameUser ADD CONSTRAINT fk_gameUser_gameId FOREIGN KEY (gameId) REFERENCES game(id)`.execute(
    //     db
    // );
    // await sql`ALTER TABLE gameUser ADD CONSTRAINT fk_gameUser_userId FOREIGN KEY (userId) REFERENCES user(id)`.execute(
    //     db
    // );
    // gameId/userId should be unique
    // await sql``
}

export async function down(db: Kysely<any>): Promise<void> {
    // await sql`ALTER TABLE gameUser DROP FOREIGN KEY fk_gameUser_gameId`.execute(
    //     db
    // );
    // await sql`ALTER TABLE gameUser DROP FOREIGN KEY fk_gameUser_userId`.execute(
    //     db
    // );
    await db.schema.dropTable('gameUser').ifExists().execute();
    await db.schema.dropTable('game').ifExists().execute();
    // await sql`ALTER TABLE userFencingToken DROP FOREIGN KEY fk_userFencingToken_userId`.execute(
    //     db
    // );
    await db.schema.dropTable('userFencingToken').ifExists().execute();
    await db.schema.dropTable('user').ifExists().execute();
    await db.schema.dropTable('upstreamControl').ifExists().execute();
}
