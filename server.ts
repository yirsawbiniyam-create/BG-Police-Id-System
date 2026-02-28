import express from "express";
import { createServer as createViteServer } from "vite";
// import Database from "better-sqlite3"; // Moved to dynamic import
console.log("Server script starting...");
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
let dbError: any = null;
let initPromise: Promise<any> | null = null;

async function initDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("Initializing database at:", DB_PATH);
      
      // Check if directory is writable
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Test write access
      const testFile = path.join(dbDir, ".test-write-" + Date.now());
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      console.log("Write access to database directory verified.");

      // Dynamic import to catch native module errors
      const { default: Database } = await import("better-sqlite3");
      const newDb = new Database(DB_PATH);
      
      // Initialize tables
      newDb.exec(`
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
          blood_type TEXT,
          badge_number TEXT,
          gender TEXT,
          complexion TEXT,
          height TEXT,
          emergency_contact_name TEXT,
          emergency_contact_phone TEXT,
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

      // Ensure default admin user
      const adminUser = newDb.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get("POLICE");
      const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
      if (!adminUser) {
        console.log("Creating default admin user: POLICE");
        newDb.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("POLICE", hashedPassword, "Administrator");
      } else {
        console.log("Default admin user exists. Updating password to POLICE1234");
        newDb.prepare("UPDATE users SET password = ?, role = 'Administrator' WHERE username = ? COLLATE NOCASE").run(hashedPassword, "POLICE");
      }

      // Migration: Add new columns if they don't exist
      const columns = newDb.prepare("PRAGMA table_info(ids)").all();
      const columnNames = columns.map((c: any) => c.name);
      const newCols = [
        'blood_type', 'badge_number', 'gender', 'complexion', 
        'height', 'emergency_contact_name', 'emergency_contact_phone'
      ];
      newCols.forEach(col => {
        if (!columnNames.includes(col)) {
          try {
            newDb.exec(`ALTER TABLE ids ADD COLUMN ${col} TEXT`);
            console.log(`Added column ${col} to ids table`);
          } catch (e) {
            console.error(`Error adding column ${col}:`, e);
          }
        }
      });
      
      db = newDb;
      dbError = null;

      // Test bcrypt
      const testPass = "test1234";
      const testHash = bcrypt.hashSync(testPass, 10);
      const testMatch = bcrypt.compareSync(testPass, testHash);
      console.log("Bcrypt test:", testMatch ? "PASSED" : "FAILED");
      if (!testMatch) throw new Error("Bcrypt library is not working correctly in this environment");

      return db;
    } catch (err: any) {
      console.error("Database initialization failed:", err);
      dbError = err;
      initPromise = null; // Allow retry
      return null;
    }
  })();

  return initPromise;
}

// Initial call
initDb().catch(err => console.error("Initial DB init failed:", err));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors()); // Simple CORS as suggested by user
app.options("*", cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Path: ${req.path}`);
  next();
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global Error Handler:", err);
  res.status(500).json({
    error: "Internal Server Error",
    details: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
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
app.get("/api/health", async (req, res) => {
  console.log("Health check hit");
  const currentDb = await initDb();
  res.json({ 
    ok: true, 
    status: "ok", 
    vercel: isVercel, 
    path: req.path,
    dbInitialized: !!currentDb,
    dbError: dbError ? { message: dbError.message } : null,
    dbPath: DB_PATH
  });
});

app.get("/api/debug/users", async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "DB not init" });
  try {
    const users = currentDb.prepare("SELECT id, username, role FROM users").all();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

app.options("/api/auth/login", cors());
app.options("/api/auth/login/", cors());
app.post("/api/auth/reset-admin", async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "DB not init" });
  try {
    const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
    currentDb.prepare("INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)").run("POLICE", hashedPassword, "Administrator");
    res.json({ success: true, message: "Admin user reset to POLICE / POLICE1234" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  console.log(`[LOGIN_DEBUG] POST /api/auth/login hit. Body:`, JSON.stringify(req.body));
  
  const currentDb = await initDb();
  if (!currentDb) {
    console.error("[LOGIN_DEBUG] DB not initialized");
    return res.status(500).json({ 
      error: "Database not available", 
      details: dbError?.message || "Unknown database error" 
    });
  }

  const { username, password } = req.body;
  console.log(`[LOGIN_DEBUG] Attempting login for username: "${username}"`);
  
  if (!username || !password) {
    console.log("[LOGIN_DEBUG] Missing credentials");
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = currentDb.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
    
    if (!user) {
      console.log(`[LOGIN_DEBUG] User not found: "${username}"`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log(`[LOGIN_DEBUG] User found: "${user.username}". Comparing passwords...`);
    const isMatch = bcrypt.compareSync(password, user.password);
    console.log(`[LOGIN_DEBUG] Password match: ${isMatch}`);

    if (!isMatch) {
      console.log(`[LOGIN_DEBUG] Password mismatch for user: "${username}"`);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log("[LOGIN_DEBUG] Login successful for:", username);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error: any) {
    console.error("[LOGIN_DEBUG] Database error:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error.message,
      dbPath: DB_PATH,
      isVercel: isVercel
    });
  }
});

app.get("/api/auth/login", (req, res) => {
  res.json({ message: "Please use POST to login" });
});

app.get("/api/auth/login-status", (req, res) => {
  res.json({ status: "active", methods: ["POST"] });
});

// User Management (Admin only)
app.get("/api/users", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const users = currentDb.prepare("SELECT id, username, role, created_at FROM users").all();
  res.json(users);
});

app.post("/api/users", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  try {
    currentDb.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, hashedPassword, role);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.put("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const { role } = req.body;
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  currentDb.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
  res.json({ success: true });
});

app.delete("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  // Prevent deleting the last admin
  const adminCount = currentDb.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Administrator'").get().count;
  const userToDelete = currentDb.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id);
  
  if (userToDelete?.role === 'Administrator' && adminCount <= 1) {
    return res.status(400).json({ error: "Cannot delete the last administrator" });
  }

  currentDb.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/ids", authenticateToken, async (req, res) => {
  console.log("GET /api/ids hit");
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const { search } = req.query;
  let query = "SELECT * FROM ids";
  const params = [];
  if (search) {
    query += " WHERE full_name_am LIKE ? OR full_name_en LIKE ? OR phone LIKE ? OR id_number LIKE ?";
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += " ORDER BY full_name_am ASC";
  const rows = currentDb.prepare(query).all(...params);
  res.json(rows);
});

app.post("/api/ids", authenticateToken, authorizeRole(['Administrator', 'Data Entry']), async (req, res) => {
  const { 
    full_name_am, full_name_en, 
    rank_am, rank_en, 
    responsibility_am, responsibility_en, 
    phone, photo_url, commissioner_signature,
    blood_type, badge_number, gender, complexion,
    height, emergency_contact_name, emergency_contact_phone
  } = req.body;

  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });

  // Generate ID Number: BGR-POL-XXXXX
  const lastId = currentDb.prepare("SELECT id FROM ids ORDER BY id DESC LIMIT 1").get();
  const nextId = (lastId?.id || 0) + 1;
  const id_number = `BGR-POL-${String(nextId).padStart(5, '0')}`;

  const stmt = currentDb.prepare(`
    INSERT INTO ids (
      id_number, full_name_am, full_name_en, rank_am, rank_en, 
      responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
      blood_type, badge_number, gender, complexion, height, 
      emergency_contact_name, emergency_contact_phone
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    stmt.run(
      id_number, full_name_am, full_name_en, rank_am, rank_en, 
      responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
      blood_type, badge_number, gender, complexion, height, 
      emergency_contact_name, emergency_contact_phone
    );
    res.json({ success: true, id_number });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/ids/:id_number", async (req, res) => {
  // Publicly accessible for scanning, but maybe we want to restrict it?
  // For now, keep it public as it's for verification.
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const row = currentDb.prepare("SELECT * FROM ids WHERE id_number = ?").get(req.params.id_number);
  if (row) {
    // Log scan
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    currentDb.prepare("INSERT INTO scans (id_number, ip_address, user_agent) VALUES (?, ?, ?)").run(req.params.id_number, ip, ua);
    res.json(row);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

app.get("/api/scans/:id_number", authenticateToken, async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const rows = currentDb.prepare("SELECT * FROM scans WHERE id_number = ? ORDER BY scanned_at DESC").all(req.params.id_number);
  res.json(rows);
});

// Assets (Flags/Logo)
app.get("/api/assets", async (req, res) => {
  console.log("GET /api/assets hit (public)");
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const rows = currentDb.prepare("SELECT * FROM assets").all();
  const assets = rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
  res.json(assets);
});

app.post("/api/assets", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("POST /api/assets hit", req.body?.key);
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: "Missing key or value" });
  }
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  currentDb.prepare("INSERT OR REPLACE INTO assets (key, value) VALUES (?, ?)").run(key, value);
  res.json({ success: true });
});

// --- Backup & Restore ---
app.get("/api/backups", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("GET /api/backups hit");
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/backups", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("POST /api/backups hit");
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`);
  try {
    await currentDb.backup(backupPath);
    res.json({ success: true, filename: `backup-${timestamp}.sqlite` });
  } catch (e: any) {
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

  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });

  try {
    // Close current connection
    currentDb.close();
    db = null; // Force re-init

    // Copy backup to main db path
    fs.copyFileSync(backupPath, DB_PATH);

    // Re-open database
    await initDb();

    res.json({ success: true });
  } catch (e: any) {
    // Attempt to re-open if it failed
    await initDb();
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
            const currentDb = await initDb();
            if (currentDb) await currentDb.backup(backupPath);
          } catch (e) {
            console.error("Daily backup failed:", e);
          }
        }
      }
  }, 60000); // Check every minute
}

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack 
  });
});

async function startServer() {
  console.log("Entering startServer...");
  const PORT = Number(process.env.PORT) || 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is healthy", timestamp: new Date().toISOString() });
  });

  // Test route
  app.get("/api/test-api", (req, res) => {
    res.json({ message: "API is reachable" });
  });

  // Catch-all for missing API routes
  app.all("/api/*", (req, res) => {
    console.log(`[404_API_DEBUG] ${req.method} ${req.url} - Not Found`);
    res.status(404).json({ 
      error: "API Route Not Found", 
      method: req.method, 
      path: req.url 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Starting Vite in middleware mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached successfully.");
    } catch (viteError) {
      console.error("Failed to start Vite server:", viteError);
    }
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
    console.log("DB Path:", DB_PATH);
    console.log("Is Vercel:", isVercel);
  });
}

console.log("Environment check:", {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  PORT: process.env.PORT,
  isVercel
});

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
