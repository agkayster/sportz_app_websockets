import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// use dotenv/config to process our database_url
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// this hooks up our drizzle pool to our database
export const db = drizzle(pool);
