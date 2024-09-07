import { sql } from 'kysely';
import { db } from './database';

async function reset() {
    console.log('Resetting database');
    console.log('Setting FOREIGN_KEY_CHECKS=0');
    await sql`Set FOREIGN_KEY_CHECKS=0`.execute(db);
    await sql`TRUNCATE TABLE streamOut`.execute(db);
    console.log('Truncated streamOut');
    await sql`TRUNCATE TABLE streamOut`.execute(db);
    console.log('Truncated streamOut');
    await sql`TRUNCATE TABLE upstreamControl`.execute(db);
    console.log('Truncated upstreamControl');
    await sql`TRUNCATE TABLE userEvent`.execute(db);
    console.log('Truncated userEvent');
    await sql`TRUNCATE TABLE user`.execute(db);
    console.log('Truncated user');
    console.log('Setting FOREIGN_KEY_CHECKS=1');
    await sql`SET FOREIGN_KEY_CHECKS=1`.execute(db);

    await db.destroy();
}

reset();
