import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "police-id-secret-key-2026";
console.log("Starting server script...");
const isVercel = process.env.VERCEL === '1';
console.log("isVercel:", isVercel);

const DB_PATH = isVercel ? "/tmp/database.sqlite" : "database.sqlite";
const BACKUP_DIR = isVercel ? "/tmp/backups" : path.join(__dirname, "backups");

console.log("DB_PATH:", DB_PATH);
console.log("BACKUP_DIR:", BACKUP_DIR);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let db: any;
try {
  console.log("Initializing database...");
  db = new Database(DB_PATH);
  console.log("Database initialized successfully.");
} catch (err) {
  console.error("Failed to initialize database:", err);
  process.exit(1);
}

// Initialize database
try {
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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'Administrator', 'Data Entry', 'Viewer'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
  console.log("Database tables verified/created.");

  // Ensure default admin user exists and has the correct password
  const adminUser = db.prepare("SELECT * FROM users WHERE username = ?").get("police");
  const hashedPassword = bcrypt.hashSync("police1234", 10);
  if (!adminUser) {
    db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("police", hashedPassword, "Administrator");
    console.log("Default admin user created: police / police1234");
  } else {
    // Force update password to match request
    db.prepare("UPDATE users SET password = ?, role = 'Administrator' WHERE username = ?").run(hashedPassword, "police");
    console.log("Police user password updated to: police1234");
  }
  
  // Log all users for debugging
  const allUsers = db.prepare("SELECT username, role FROM users").all();
  console.log("Current users in DB:", allUsers);
} catch (err) {
  console.error("Failed to execute database initialization:", err);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));
app.options("*", cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

const authorizeRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};

// API Routes
app.get("/api/health", (req, res) => {
  console.log("Health check hit");
  res.json({ status: "ok", vercel: isVercel });
});

app.all(["/api/auth/login", "/api/auth/login/"], (req, res) => {
  console.log(`[LOGIN_DEBUG] Method: ${req.method}, URL: ${req.url}, Body:`, req.body);
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.log(`[LOGIN_DEBUG] Rejecting non-POST method: ${req.method}`);
    return res.status(405).json({ error: `Method ${req.method} not allowed. Please use POST.` });
  }

  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log("[LOGIN_DEBUG] Missing credentials");
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      console.log("[LOGIN_DEBUG] Invalid credentials for:", username);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log("[LOGIN_DEBUG] Login successful for:", username);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error("[LOGIN_DEBUG] Database error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/login-status", (req, res) => {
  res.json({ status: "active", methods: ["POST"] });
});

// User Management (Admin only)
app.get("/api/users", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  const users = db.prepare("SELECT id, username, role, created_at FROM users").all();
  res.json(users);
});

app.post("/api/users", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, hashedPassword, role);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.put("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  const { role } = req.body;
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
  res.json({ success: true });
});

app.delete("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  // Prevent deleting the last admin
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Administrator'").get().count;
  const userToDelete = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id);
  
  if (userToDelete?.role === 'Administrator' && adminCount <= 1) {
    return res.status(400).json({ error: "Cannot delete the last administrator" });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/ids", authenticateToken, (req, res) => {
  console.log("GET /api/ids hit");
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

app.post("/api/ids", authenticateToken, authorizeRole(['Administrator', 'Data Entry']), (req, res) => {
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
  // Publicly accessible for scanning, but maybe we want to restrict it?
  // For now, keep it public as it's for verification.
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

app.get("/api/scans/:id_number", authenticateToken, (req, res) => {
  const rows = db.prepare("SELECT * FROM scans WHERE id_number = ? ORDER BY scanned_at DESC").all(req.params.id_number);
  res.json(rows);
});

// Assets (Flags/Logo)
app.get("/api/assets", authenticateToken, (req, res) => {
  console.log("GET /api/assets hit");
  const rows = db.prepare("SELECT * FROM assets").all();
  const assets = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
  res.json(assets);
});

app.post("/api/assets", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  console.log("POST /api/assets hit", req.body?.key);
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: "Missing key or value" });
  }
  db.prepare("INSERT OR REPLACE INTO assets (key, value) VALUES (?, ?)").run(key, value);
  res.json({ success: true });
});

// --- Backup & Restore ---
app.get("/api/backups", authenticateToken, authorizeRole(['Administrator']), (req, res) => {
  console.log("GET /api/backups hit");
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

app.post("/api/backups", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("POST /api/backups hit");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);
  try {
    await db.backup(backupPath);
    res.json({ success: true, filename: `backup-${timestamp}.sqlite` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/backups/restore", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("POST /api/backups/restore hit");
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

// API 404 Handler - prevent falling through to SPA fallback
app.use("/api/*", (req, res) => {
  console.log(`API 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Daily Backup Scheduler (Simple implementation)
if (!isVercel) {
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
}

async function startServer() {
  console.log("Entering startServer...");
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    if (!fs.existsSync(distPath)) {
      console.error("ERROR: dist directory not found. Please run 'npm run build' first.");
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Environment:", process.env.NODE_ENV || "development");
  });
}

if (!isVercel) {
  startServer();
}

export default app;
