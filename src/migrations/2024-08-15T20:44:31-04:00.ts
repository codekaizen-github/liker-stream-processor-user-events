import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('streamIn')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('data', 'json', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('streamOut')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        // Add an arbitrary JSON column
        .addColumn('data', 'json', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('httpSubscriber')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('url', 'text', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('upstreamControl')
        .addColumn('id', 'integer', (col) => col.primaryKey())
        .addColumn('streamInId', 'integer', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('game')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('likeCount', 'integer', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('user')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
        .execute();
    await db.schema
        .createTable('userEvent')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('userId', 'integer', (col) => col.notNull())
        .addColumn('userEventId', 'integer', (col) => col.notNull())
        .addColumn('data', 'json', (col) => col.notNull())
        .execute();
    // Add a foreign key constraint
    await sql`ALTER TABLE userEvent ADD CONSTRAINT fk_userEvent_userId FOREIGN KEY (userId) REFERENCES user(id)`.execute(
        db
    );
    await sql`CREATE UNIQUE INDEX userEvent_userId_userEventId ON userEvent (userId, userEventId)`.execute(
        db
    );
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`ALTER TABLE userEvent DROP FOREIGN KEY fk_userEvent_userId`.execute(
        db
    );
    await sql`DROP INDEX userEvent_userId_userEventId ON userEvent`.execute(db);
    await db.schema.dropTable('userEvent').execute();
    await db.schema.dropTable('user').execute();
    await db.schema.dropTable('game').execute();
    await db.schema.dropTable('upstreamControl').execute();
    await db.schema.dropTable('httpSubscriber').execute();
    await db.schema.dropTable('streamOut').execute();
    await db.schema.dropTable('streamIn').execute();
}
