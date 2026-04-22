import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

async function fixPasswords() {
  const correctHash = '$2b$10$YSRzMb2LJIdwBp8ddcw3l.fxkBjTvGaHLRu032CRV5k71CdRdNTUi'; // 'packetworx'
  const emails = [
    'admin@packetworx.com', 
    'admin@packetwokx.com', 
    'co-admin@packetworx.com', 
    'user@packetworx.com'
  ];

  try {
    console.log("Connecting to database to fix passwords and ensure admin accounts exist...");
    
    const stmtUpdate = db.prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    const stmtInsert = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)");
    const stmtCheck = db.prepare("SELECT email FROM users WHERE email = ?");

    const tx = db.transaction((users) => {
      for (const email of users) {
        const info = stmtUpdate.run(correctHash, email);
        
        if (info.changes === 0) {
          // If update failed, check if user exists
          const exists = stmtCheck.get(email);
          if (!exists) {
            console.log(`User not found: ${email}. Attempting to create...`);
            const role = email.includes('admin') ? (email.includes('co-admin') ? 'co-admin' : 'admin') : 'user';
            stmtInsert.run(email, correctHash, role);
            console.log(`Ensured user exists: ${email}`);
          }
        } else {
          console.log(`Successfully updated password for: ${email}`);
        }
      }
    });

    tx(emails);
    
    console.log("Database accounts and passwords synced!");
  } catch (err) {
    console.error("Failed to fix passwords:", err.message);
  } finally {
    db.close();
  }
}

fixPasswords();
