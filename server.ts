import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("database.sqlite");

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
