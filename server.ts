import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = "database.sqlite";
const BACKUP_DIR = path.join(__dirname, "backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

let db = new Database(DB_PATH);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_number TEXT UNIQUE,
    full_name_am TEXT,
    full_name_en TEXT,
    rank_am TEXT,
    rank_en TEXT,
    responsibility_am TEXT,
    responsibility_en TEXT,
    phone TEXT,
    photo_url TEXT,
    commissioner_signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_number TEXT,
    ip_address TEXT,
    user_agent TEXT,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/ids", (req, res) => {
    const { search } = req.query;
    let query = "SELECT * FROM ids";
    const params = [];
    if (search) {
      query += " WHERE full_name_am LIKE ? OR full_name_en LIKE ? OR phone LIKE ? OR id_number LIKE ?";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    query += " ORDER BY full_name_am ASC";
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  app.post("/api/ids", (req, res) => {
    const { 
      full_name_am, full_name_en, 
      rank_am, rank_en, 
      responsibility_am, responsibility_en, 
      phone, photo_url, commissioner_signature
    } = req.body;

    // Generate ID Number: BGR-POL-XXXXX
    const lastId = db.prepare("SELECT id FROM ids ORDER BY id DESC LIMIT 1").get();
    const nextId = (lastId?.id || 0) + 1;
    const id_number = `BGR-POL-${String(nextId).padStart(5, '0')}`;

    const stmt = db.prepare(`
      INSERT INTO ids (id_number, full_name_am, full_name_en, rank_am, rank_en, responsibility_am, responsibility_en, phone, photo_url, commissioner_signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(id_number, full_name_am, full_name_en, rank_am, rank_en, responsibility_am, responsibility_en, phone, photo_url, commissioner_signature);
      res.json({ success: true, id_number });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/ids/:id_number", (req, res) => {
    const row = db.prepare("SELECT * FROM ids WHERE id_number = ?").get(req.params.id_number);
    if (row) {
      // Log scan
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      db.prepare("INSERT INTO scans (id_number, ip_address, user_agent) VALUES (?, ?, ?)").run(req.params.id_number, ip, ua);
      res.json(row);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.get("/api/scans/:id_number", (req, res) => {
    const rows = db.prepare("SELECT * FROM scans WHERE id_number = ? ORDER BY scanned_at DESC").all(req.params.id_number);
    res.json(rows);
  });

  // Assets (Flags/Logo)
  app.get("/api/assets", (req, res) => {
    const rows = db.prepare("SELECT * FROM assets").all();
    const assets = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json(assets);
  });

  app.post("/api/assets", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO assets (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  // --- Backup & Restore ---
  app.get("/api/backups", (req, res) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".sqlite"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.mtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      res.json(files);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/backups", async (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);
    try {
      await db.backup(backupPath);
      res.json({ success: true, filename: `backup-${timestamp}.sqlite` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/backups/restore", async (req, res) => {
    const { filename } = req.body;
    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup file not found" });
    }

    try {
      // Close current connection
      db.close();

      // Copy backup to main db path
      fs.copyFileSync(backupPath, DB_PATH);

      // Re-open database
      db = new Database(DB_PATH);

      res.json({ success: true });
    } catch (e) {
      // Attempt to re-open if it failed
      db = new Database(DB_PATH);
      res.status(500).json({ error: e.message });
    }
  });

  // Daily Backup Scheduler (Simple implementation)
  setInterval(async () => {
    const now = new Date();
    // Run at 2 AM
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      const timestamp = now.toISOString().split('T')[0];
      const backupPath = path.join(BACKUP_DIR, `daily-backup-${timestamp}.sqlite`);
      if (!fs.existsSync(backupPath)) {
        console.log(`Running daily backup: ${backupPath}`);
        try {
          await db.backup(backupPath);
        } catch (e) {
          console.error("Daily backup failed:", e);
        }
      }
    }
  }, 60000); // Check every minute

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
