import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

async function check() {
  try {
    const res = db.prepare('SELECT sqlite_version() AS version').get();
    console.log('Connection OK. SQLite Version:', res.version);
    
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in DB:', tables.map(t => t.name).join(', '));

    const users = db.prepare('SELECT email FROM users').all();
    console.log('Users in DB:', users.map(r => r.email));
  } catch (err) {
    console.error('Connection FAILED:', err.message);
  } finally {
    db.close();
  }
}
check();
