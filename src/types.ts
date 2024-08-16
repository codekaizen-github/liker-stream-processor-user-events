import { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
	logRecord: LogRecordTable;
}

// This interface describes the `person` table to Kysely. Table
// interfaces should only be used in the `Database` type above
// and never as a result type of a query!. See the `Person`,
// `NewPerson` and `PersonUpdate` types below.
export interface LogRecordTable {
	// Columns that are generated by the database should be marked
	// using the `Generated` type. This way they are automatically
	// made optional in inserts and updates.
    id: Generated<number>;
    data: string;
}

// You should not use the table schema interfaces directly. Instead, you should
// use the `Selectable`, `Insertable` and `Updateable` wrappers. These wrappers
// make sure that the correct types are used in each operation.
//
// Most of the time you should trust the type inference and not use explicit
// types at all. These types can be useful when typing function arguments.
export type LogRecord = Selectable<LogRecordTable>;
export type NewLogRecord = Insertable<LogRecordTable>;
export type LogRecordUpdate = Updateable<LogRecordTable>;
