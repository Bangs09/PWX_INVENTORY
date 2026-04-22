import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

async function migrate() {
  try {
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8');
    console.log("Applying schema migration from database/schema.sql to SQLite...");
    
    // SQLite can execute multiple statements separated by semicolons using exec
    db.exec(schemaSql);
    
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
