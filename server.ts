import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import mongoose from "mongoose";
import IdCard from "./src/models/IdCard.js";
import supabase from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "police-id-secret-key-2026";
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();
app.use(cors());
app.options("*", cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
const assetSchema = new mongoose.Schema({ key: { type: String, unique: true }, value: String });
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

const isVercel = process.env.VERCEL === '1';
const isRender = !!process.env.RENDER;
const DB_PATH = isVercel ? "/tmp/database.sqlite" : path.join(__dirname, "database.sqlite");
const BACKUP_DIR = isVercel ? "/tmp/backups" : path.join(__dirname, "backups");

let db: any;
let dbError: any = null;
let initPromise: Promise<any> | null = null;
let useMongoDB = false;

async function initDb() {
  if (useMongoDB) return true;
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (MONGODB_URI) {
        try {
          await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000 });
          useMongoDB = true;
          const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
          const adminUser = await User.findOne({ username: /^POLICE$/i });
          if (!adminUser) await User.create({ username: "POLICE", password: hashedPassword, role: "Administrator" });
          else { adminUser.password = hashedPassword; adminUser.role = "Administrator"; await adminUser.save(); }
          return true;
        } catch (mongoErr: any) {
          console.error("MongoDB Error:", mongoErr.message, "Falling back to SQLite...");
          useMongoDB = false;
        }
      }

      if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const { default: Database } = await import("better-sqlite3");
      const newDb = new Database(DB_PATH);
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
          role TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const hashedPassword = bcrypt.hashSync("POLICE1234", 10);
      const adminUser = newDb.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get("POLICE");
      if (!adminUser) newDb.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("POLICE", hashedPassword, "Administrator");
      else newDb.prepare("UPDATE users SET password = ?, role = 'Administrator' WHERE username = ? COLLATE NOCASE").run(hashedPassword, "POLICE");

      db = newDb;
      return db;
    } catch (err: any) {
      dbError = err;
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

// --- Supabase Test Route ---
app.get('/test-supabase', async (req, res) => {
  const { data, error } = await supabase.from('assets').select('*').limit(1);
  if (error) return res.status(500).json({ ok: false, message: error.message });
  res.json({ ok: true, message: 'Supabase connected successfully 🎉', data });
});

// --- Start Server ---
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } catch (viteError) { console.error("Failed to start Vite server:", viteError); }
  } else {
    const distPath = path.join(__dirname, "dist");
    if (!fs.existsSync(distPath)) console.error("dist directory not found. Run 'npm run build'");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("DB Path:", DB_PATH, "Use MongoDB:", useMongoDB);
  });
}

startServer().catch(err => console.error("Failed to start server:", err));
export default app;
