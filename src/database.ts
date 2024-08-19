import { Database } from './types'; // this is the Database interface we defined earlier
import { createPool } from 'mysql2'; // do not use 'mysql2/promises'!
import { Kysely, MysqlDialect } from 'kysely';
import { env } from 'process';

const poolConfig = {
    database: env.LIKER_STREAM_PROCESSOR_USER_EVENTS_DB_NAME,
    host: env.LIKER_STREAM_PROCESSOR_USER_EVENTS_DB_HOSTNAME,
    user: env.LIKER_STREAM_PROCESSOR_USER_EVENTS_DB_USER,
    password: env.LIKER_STREAM_PROCESSOR_USER_EVENTS_DB_PASSWORD,
    port: 3306,
    connectionLimit: 10,
};
const dialect = new MysqlDialect({
    pool: createPool(poolConfig),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<Database>({
    dialect,
});
