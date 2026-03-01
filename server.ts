import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import mongoose from "mongoose";
import { createClient } from '@supabase/supabase-js';
import IdCard from "./src/models/IdCard";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = process.cwd();
const JWT_SECRET = process.env.JWT_SECRET || "police-id-secret-key-2026";
const MONGODB_URI = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// --- Mongoose Schemas ---

// --- Mongoose Schemas ---
const idSchema = new mongoose.Schema({
  id_number: { type: String, unique: true },
  full_name_am: String,
  full_name_en: String,
  rank_am: String,
  rank_en: String,
  responsibility_am: String,
  responsibility_en: String,
  phone: String,
  photo_url: String,
  blood_type: String,
  badge_number: String,
  gender: String,
  complexion: String,
  height: String,
  emergency_contact_name: String,
  emergency_contact_phone: String,
  commissioner_signature: String,
  created_at: { type: Date, default: Date.now }
});

const scanSchema = new mongoose.Schema({
  id_number: String,
  ip_address: String,
  user_agent: String,
  scanned_at: { type: Date, default: Date.now }
});

const assetSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: String
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String },
  role: String,
  created_at: { type: Date, default: Date.now }
});

const ID = mongoose.model('ID', idSchema);
const Scan = mongoose.model('Scan', scanSchema);
const Asset = mongoose.model('Asset', assetSchema);
const User = mongoose.model('User', userSchema);

console.log("Starting server script...");
const isVercel = process.env.VERCEL === '1';
const isRender = !!process.env.RENDER;

const DB_PATH = isVercel ? "/tmp/database.sqlite" : "database.sqlite";
const BACKUP_DIR = isVercel ? "/tmp/backups" : path.join(__dirname, "backups");

let db: any;
let dbError: any = null;
let initPromise: Promise<any> | null = null;
let useMongoDB = false;
let useSupabase = false;

async function initDb() {
  if (useMongoDB || useSupabase) return true;
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (SUPABASE_URL && SUPABASE_KEY) {
        console.log("Connecting to Supabase...");
        useSupabase = true;
        
        // Ensure default admin user in Supabase
        const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
        const { data: adminUser, error: findError } = await supabase
          .from('users')
          .select('*')
          .ilike('username', 'POLICE')
          .single();
          
        if (!adminUser) {
          console.log("Creating default admin user in Supabase: POLICE");
          await supabase.from('users').insert([{ username: "POLICE", password: hashedPassword, role: "Administrator" }]);
        } else {
          console.log("Default admin user exists in Supabase. Updating password.");
          await supabase.from('users').update({ password: hashedPassword, role: "Administrator" }).eq('id', adminUser.id);
        }
        return true;
      }

      if (MONGODB_URI) {
        console.log("Connecting to MongoDB...");
        try {
          await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
          });
          console.log("Connected to MongoDB successfully.");
          useMongoDB = true;
          
          // Ensure default admin user in MongoDB
          const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
          const adminUser = await User.findOne({ username: /^POLICE$/i });
          if (!adminUser) {
            console.log("Creating default admin user in MongoDB: POLICE");
            await User.create({ username: "POLICE", password: hashedPassword, role: "Administrator" });
          } else {
            console.log("Default admin user exists in MongoDB. Updating password.");
            adminUser.password = hashedPassword;
            adminUser.role = "Administrator";
            await adminUser.save();
          }
          return true;
        } catch (mongoErr: any) {
          console.error("!!! MONGODB AUTHENTICATION ERROR !!!");
          console.error("Connection String used (masked):", MONGODB_URI.replace(/:([^@]+)@/, ":****@"));
          if (mongoErr.message.includes("Authentication failed") || mongoErr.message.includes("bad auth")) {
            console.error("ERROR: The username or password in your MONGODB_URI is incorrect.");
            console.error("ACTION REQUIRED: Please check your MONGODB_URI in Render environment variables.");
            console.error("Common issues: Special characters in password not URL-encoded, or wrong user/pass.");
          } else if (mongoErr.message.includes("ENOTFOUND")) {
            console.error("ERROR: Could not find the MongoDB server. Check your cluster address.");
          } else {
            console.error("MongoDB Error:", mongoErr.message);
          }
          console.log("Falling back to SQLite for this session...");
          useMongoDB = false;
        }
      }

      console.log("Initializing SQLite database at:", DB_PATH);
      if (isRender && !MONGODB_URI) {
        console.warn("WARNING: Running SQLite on Render without a persistent disk. Data will be lost on restart.");
      }
      
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

// New API: Create ID with the user's requested schema
app.post("/api/id/create", async (req, res) => {
  const cardCode = `BG-${Date.now()}`;
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });

  try {
    if (useSupabase) {
      await supabase.from('ids').insert([{
        id_number: cardCode,
        full_name_am: req.body.fullNameAm,
        full_name_en: req.body.fullNameEn,
        rank_am: req.body.rankAm,
        rank_en: req.body.rankEn,
        responsibility_am: req.body.responsibilityAm,
        responsibility_en: req.body.responsibilityEn,
        badge_number: req.body.badgeNumber,
        blood_type: req.body.bloodType,
        gender: req.body.gender,
        height: req.body.height,
        phone: req.body.phone,
        emergency_contact_name: req.body.emergencyContact?.name,
        emergency_contact_phone: req.body.emergencyContact?.phone
      }]);
    } else if (useMongoDB) {
      await ID.create({
        id_number: cardCode,
        full_name_am: req.body.fullNameAm,
        full_name_en: req.body.fullNameEn,
        rank_am: req.body.rankAm,
        rank_en: req.body.rankEn,
        responsibility_am: req.body.responsibilityAm,
        responsibility_en: req.body.responsibilityEn,
        badge_number: req.body.badgeNumber,
        blood_type: req.body.bloodType,
        gender: req.body.gender,
        height: req.body.height,
        phone: req.body.phone,
        emergency_contact_name: req.body.emergencyContact?.name,
        emergency_contact_phone: req.body.emergencyContact?.phone
      });
    } else {
      const stmt = currentDb.prepare(`
        INSERT INTO ids (id_number, full_name_am, full_name_en, rank_am, rank_en, responsibility_am, responsibility_en, badge_number, blood_type, gender, height, phone, emergency_contact_name, emergency_contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        cardCode, req.body.fullNameAm, req.body.fullNameEn, req.body.rankAm, req.body.rankEn, req.body.responsibilityAm, req.body.responsibilityEn, req.body.badgeNumber, req.body.bloodType, req.body.gender, req.body.height, req.body.phone, req.body.emergencyContact?.name, req.body.emergencyContact?.phone
      );
    }
    res.json({
      cardCode,
      verifyUrl: `/verify/${cardCode}`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// New API: Verify ID with the user's requested schema (returns HTML)
app.get("/verify/:cardCode", async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).send("❌ DATABASE ERROR");

  try {
    let card: any;
    if (useSupabase) {
      const { data, error } = await supabase.from('ids').select('*').eq('id_number', req.params.cardCode).single();
      if (data) {
        card = {
          fullNameEn: data.full_name_en,
          rankEn: data.rank_en,
          badgeNumber: data.badge_number,
          status: "Verified",
          createdAt: data.created_at
        };
      }
    } else if (useMongoDB) {
      const data = await ID.findOne({ id_number: req.params.cardCode });
      if (data) {
        card = {
          fullNameEn: data.full_name_en,
          rankEn: data.rank_en,
          badgeNumber: data.badge_number,
          status: "Verified",
          createdAt: data.created_at
        };
      }
    } else {
      // SQLite fallback: search in 'ids' table where id_number matches cardCode
      const data = currentDb.prepare("SELECT * FROM ids WHERE id_number = ?").get(req.params.cardCode);
      if (data) {
        card = {
          fullNameEn: data.full_name_en,
          rankEn: data.rank_en,
          badgeNumber: data.badge_number,
          status: "Verified",
          createdAt: data.created_at
        };
      }
    }

    if (!card) {
      return res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center; border: 2px solid #ff0000; border-radius: 10px; max-width: 400px; margin: 20px auto;">
          <h1 style="color: #ff0000;">❌ INVALID CARD</h1>
          <p>This ID card could not be found in our records.</p>
        </div>
      `);
    }

    res.send(`
      <div style="font-family: sans-serif; padding: 20px; text-align: center; border: 2px solid #000; border-radius: 10px; max-width: 400px; margin: 20px auto;">
        <h1 style="color: #008000;">✅ VALID POLICE ID</h1>
        <hr/>
        <p><strong>Name:</strong> ${card.fullNameEn || "N/A"}</p>
        <p><strong>Rank:</strong> ${card.rankEn || "N/A"}</p>
        <p><strong>Badge:</strong> ${card.badgeNumber || "N/A"}</p>
        <p><strong>Status:</strong> <span style="color: #008000; font-weight: bold;">${card.status || "active"}</span></p>
        <p><strong>Verification Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `);
  } catch (e: any) {
    console.error("Verification error:", e);
    res.status(500).send("❌ ERROR VERIFYING CARD: " + e.message);
  }
});
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
    let user;
    if (useSupabase) {
      const { data, error } = await supabase.from('users').select('*').ilike('username', username).single();
      user = data;
    } else if (useMongoDB) {
      user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
    } else {
      user = currentDb.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
    }
    
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
    const token = jwt.sign({ id: user.id || user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: user.id || user._id, username: user.username, role: user.role } });
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
  
  if (useSupabase) {
    const { data, error } = await supabase.from('users').select('id, username, role, created_at');
    return res.json(data);
  } else if (useMongoDB) {
    const users = await User.find({}, 'username role created_at');
    return res.json(users.map(u => ({ id: u._id, username: u.username, role: u.role, created_at: u.created_at })));
  } else {
    const users = currentDb.prepare("SELECT id, username, role, created_at FROM users").all();
    res.json(users);
  }
});

app.post("/api/users", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  try {
    if (useSupabase) {
      await supabase.from('users').insert([{ username, password: hashedPassword, role }]);
    } else if (useMongoDB) {
      await User.create({ username, password: hashedPassword, role });
    } else {
      currentDb.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, hashedPassword, role);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.put("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const { role } = req.body;
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  if (useSupabase) {
    await supabase.from('users').update({ role }).eq('id', req.params.id);
  } else if (useMongoDB) {
    await User.findByIdAndUpdate(req.params.id, { role });
  } else {
    currentDb.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
  }
  res.json({ success: true });
});

app.delete("/api/users/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  try {
    let adminCount, userToDelete;
    if (useSupabase) {
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'Administrator');
      adminCount = count;
      const { data } = await supabase.from('users').select('role').eq('id', req.params.id).single();
      userToDelete = data;
    } else if (useMongoDB) {
      adminCount = await User.countDocuments({ role: 'Administrator' });
      userToDelete = await User.findById(req.params.id);
    } else {
      adminCount = currentDb.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Administrator'").get().count;
      userToDelete = currentDb.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id);
    }
    
    if (userToDelete?.role === 'Administrator' && adminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the last administrator" });
    }

    if (useSupabase) {
      await supabase.from('users').delete().eq('id', req.params.id);
    } else if (useMongoDB) {
      await User.findByIdAndDelete(req.params.id);
    } else {
      currentDb.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/ids", authenticateToken, async (req, res) => {
  console.log("GET /api/ids hit");
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  const { search } = req.query;
  
  if (useSupabase) {
    let query = supabase.from('ids').select('*');
    if (search) {
      query = query.or(`full_name_am.ilike.%${search}%,full_name_en.ilike.%${search}%,phone.ilike.%${search}%,id_number.ilike.%${search}%`);
    }
    const { data, error } = await query.order('full_name_am', { ascending: true });
    return res.json(data);
  } else if (useMongoDB) {
    let query = {};
    if (search) {
      const s = new RegExp(search as string, 'i');
      query = {
        $or: [
          { full_name_am: s },
          { full_name_en: s },
          { phone: s },
          { id_number: s }
        ]
      };
    }
    const rows = await ID.find(query).sort({ full_name_am: 1 });
    return res.json(rows.map(r => ({ ...r.toObject(), id: r._id })));
  } else {
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
  }
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

  console.log(`[ID_CREATE] Attempting to create ID for: ${full_name_am} / ${full_name_en}`);

  const currentDb = await initDb();
  if (!currentDb) {
    console.error("[ID_CREATE] Database not available");
    return res.status(500).json({ error: "Database not available" });
  }

  let id_number;
  try {
    if (useSupabase) {
      console.log("[ID_CREATE] Using Supabase");
      const { count } = await supabase.from('ids').select('*', { count: 'exact', head: true });
      id_number = `BGR-POL-${String((count || 0) + 1).padStart(5, '0')}`;
      console.log(`[ID_CREATE] Generated ID Number: ${id_number}`);
      
      const { data, error } = await supabase.from('ids').insert([{
        id_number, full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone
      }]).select().single();
      
      if (error) {
        console.error("[ID_CREATE] Supabase Insert Error:", error);
        return res.status(500).json({ error: error.message });
      }
      console.log("[ID_CREATE] Supabase Insert Success");
      res.json({ success: true, id_number, id: data.id });
    } else if (useMongoDB) {
      const count = await ID.countDocuments();
      id_number = `BGR-POL-${String(count + 1).padStart(5, '0')}`;
      const newId = await ID.create({
        id_number, full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone
      });
      res.json({ success: true, id_number, id: newId._id });
    } else {
      // Generate ID Number: BGR-POL-XXXXX
      const lastId = currentDb.prepare("SELECT id FROM ids ORDER BY id DESC LIMIT 1").get();
      const nextId = (lastId?.id || 0) + 1;
      id_number = `BGR-POL-${String(nextId).padStart(5, '0')}`;

      const stmt = currentDb.prepare(`
        INSERT INTO ids (
          id_number, full_name_am, full_name_en, rank_am, rank_en, 
          responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
          blood_type, badge_number, gender, complexion, height, 
          emergency_contact_name, emergency_contact_phone
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id_number, full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone
      );
      res.json({ success: true, id_number });
    }
  } catch (e: any) {
    console.error("[ID_CREATE] Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/ids/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
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

  try {
    if (useSupabase) {
      await supabase.from('ids').update({
        full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone
      }).eq('id', req.params.id);
    } else if (useMongoDB) {
      await ID.findByIdAndUpdate(req.params.id, {
        full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone
      });
    } else {
      const stmt = currentDb.prepare(`
        UPDATE ids SET 
          full_name_am = ?, full_name_en = ?, 
          rank_am = ?, rank_en = ?, 
          responsibility_am = ?, responsibility_en = ?, 
          phone = ?, photo_url = ?, commissioner_signature = ?,
          blood_type = ?, badge_number = ?, gender = ?, complexion = ?, 
          height = ?, emergency_contact_name = ?, emergency_contact_phone = ?
        WHERE id = ?
      `);
      stmt.run(
        full_name_am, full_name_en, rank_am, rank_en, 
        responsibility_am, responsibility_en, phone, photo_url, commissioner_signature,
        blood_type, badge_number, gender, complexion, height, 
        emergency_contact_name, emergency_contact_phone,
        req.params.id
      );
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/ids/:id", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  try {
    if (useSupabase) {
      await supabase.from('ids').delete().eq('id', req.params.id);
    } else if (useMongoDB) {
      await ID.findByIdAndDelete(req.params.id);
    } else {
      currentDb.prepare("DELETE FROM ids WHERE id = ?").run(req.params.id);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/ids/:id_number", async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  try {
    let row;
    if (useSupabase) {
      const { data, error } = await supabase.from('ids').select('*').eq('id_number', req.params.id_number).single();
      row = data;
    } else if (useMongoDB) {
      row = await ID.findOne({ id_number: req.params.id_number });
    } else {
      row = currentDb.prepare("SELECT * FROM ids WHERE id_number = ?").get(req.params.id_number);
    }

    if (row) {
      // Log scan
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      if (useSupabase) {
        await supabase.from('scans').insert([{ id_number: req.params.id_number, ip_address: ip, user_agent: ua }]);
      } else if (useMongoDB) {
        await Scan.create({ id_number: req.params.id_number, ip_address: ip, user_agent: ua });
      } else {
        currentDb.prepare("INSERT INTO scans (id_number, ip_address, user_agent) VALUES (?, ?, ?)").run(req.params.id_number, ip, ua);
      }
      res.json(useMongoDB ? { ...row.toObject(), id: row._id } : row);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/scans/:id_number", authenticateToken, async (req, res) => {
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  if (useSupabase) {
    const { data, error } = await supabase.from('scans').select('*').eq('id_number', req.params.id_number).order('scanned_at', { ascending: false });
    res.json(data);
  } else if (useMongoDB) {
    const rows = await Scan.find({ id_number: req.params.id_number }).sort({ scanned_at: -1 });
    res.json(rows);
  } else {
    const rows = currentDb.prepare("SELECT * FROM scans WHERE id_number = ? ORDER BY scanned_at DESC").all(req.params.id_number);
    res.json(rows);
  }
});

// Assets (Flags/Logo)
app.get("/api/assets", async (req, res) => {
  console.log("GET /api/assets hit (public)");
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  if (useSupabase) {
    const { data, error } = await supabase.from('assets').select('*');
    const assets = (data || []).reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
    res.json(assets);
  } else if (useMongoDB) {
    const rows = await Asset.find({});
    const assets = rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
    res.json(assets);
  } else {
    const rows = currentDb.prepare("SELECT * FROM assets").all();
    const assets = rows.reduce((acc: any, row: any) => ({ ...acc, [row.key]: row.value }), {});
    res.json(assets);
  }
});

app.post("/api/assets", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("POST /api/assets hit", req.body?.key);
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: "Missing key or value" });
  }
  const currentDb = await initDb();
  if (!currentDb) return res.status(500).json({ error: "Database not available" });
  
  if (useSupabase) {
    await supabase.from('assets').upsert({ key, value });
  } else if (useMongoDB) {
    await Asset.findOneAndUpdate({ key }, { value }, { upsert: true });
  } else {
    currentDb.prepare("INSERT OR REPLACE INTO assets (key, value) VALUES (?, ?)").run(key, value);
  }
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

app.delete("/api/backups/:filename", authenticateToken, authorizeRole(['Administrator']), async (req, res) => {
  console.log("DELETE /api/backups hit");
  const { filename } = req.params;
  const backupPath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  try {
    fs.unlinkSync(backupPath);
    res.json({ success: true });
  } catch (e: any) {
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
    // In production, try multiple possible dist locations
    const possibleDistPaths = [
      path.join(ROOT_DIR, "dist"),
      path.join(__dirname, "dist"),
      path.join(process.cwd(), "dist")
    ];
    
    let distPath = possibleDistPaths[0];
    let foundDist = false;
    
    for (const p of possibleDistPaths) {
      if (fs.existsSync(p)) {
        distPath = p;
        foundDist = true;
        break;
      }
    }

    if (!foundDist) {
      console.error("ERROR: dist directory not found in any of these locations:");
      possibleDistPaths.forEach(p => console.error(` - ${p}`));
      console.error("Please ensure 'npm run build' was executed successfully.");
    } else {
      console.log(`Serving static files from: ${distPath}`);
    }

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`
          <h1>404 - Frontend Not Found</h1>
          <p>The server is running, but the frontend files are missing.</p>
          <p>Current Directory: ${process.cwd()}</p>
          <p>Looked in: ${distPath}</p>
          <hr/>
          <p><b>Action Required:</b> Ensure your build command is <code>npm install && npm run build</code> and your start command is <code>npm start</code>.</p>
        `);
      }
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
