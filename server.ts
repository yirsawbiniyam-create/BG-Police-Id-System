import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

/* ================= APP ================= */
const app = express();

/* ================= CONFIG ================= */
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "police-id-secret-key-2026";
const DB_PATH = process.env.RENDER ? "/tmp/database.sqlite" : "database.sqlite";

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ================= DATABASE ================= */
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

/* ================= ROOT (FIX Cannot GET /) ================= */
app.get("/", (req, res) => {
  res.json({
    name: "BG Police ID System API",
    status: "running",
    health: "/api/health"
  });
});

/* ================= DEFAULT ADMIN ================= */
const adminExists = db
  .prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE")
  .get("POLICE");

if (!adminExists) {
  const hashed = bcrypt.hashSync("POLICE1234", 10);
  db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
  ).run("POLICE", hashed, "Administrator");

  console.log("✅ Default admin created: POLICE / POLICE1234");
}

/* ================= AUTH HELPERS ================= */
const authenticateToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const token = auth.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

const authorizeRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
};

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ================= AUTH ================= */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

/* ================= IDS ================= */
app.get("/api/ids", authenticateToken, (req, res) => {
  const rows = db.prepare("SELECT * FROM ids ORDER BY created_at DESC").all();
  res.json(rows);
});

app.post(
  "/api/ids",
  authenticateToken,
  authorizeRole(["Administrator", "Data Entry"]),
  (req, res) => {
    const last = db.prepare("SELECT id FROM ids ORDER BY id DESC LIMIT 1").get();
    const nextId = (last?.id || 0) + 1;
    const id_number = `BGR-POL-${String(nextId).padStart(5, "0")}`;

    db.prepare(`
      INSERT INTO ids (
        id_number, full_name_am, full_name_en,
        rank_am, rank_en,
        responsibility_am, responsibility_en,
        phone, photo_url, commissioner_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_number,
      req.body.full_name_am,
      req.body.full_name_en,
      req.body.rank_am,
      req.body.rank_en,
      req.body.responsibility_am,
      req.body.responsibility_en,
      req.body.phone,
      req.body.photo_url,
      req.body.commissioner_signature
    );

    res.json({ success: true, id_number });
  }
);

/* ================= PUBLIC VERIFY ================= */
app.get("/api/ids/:id_number", (req, res) => {
  const row = db
    .prepare("SELECT * FROM ids WHERE id_number = ?")
    .get(req.params.id_number);

  if (!row) return res.status(404).json({ error: "Not found" });

  db.prepare(
    "INSERT INTO scans (id_number, ip_address, user_agent) VALUES (?, ?, ?)"
  ).run(
    req.params.id_number,
    req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    req.headers["user-agent"]
  );

  res.json(row);
});

/* ================= ASSETS ================= */
app.get("/api/assets", authenticateToken, (req, res) => {
  const rows = db.prepare("SELECT * FROM assets").all();
  const data = {};
  rows.forEach((r) => (data[r.key] = r.value));
  res.json(data);
});

app.post(
  "/api/assets",
  authenticateToken,
  authorizeRole(["Administrator"]),
  (req, res) => {
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: "Missing key or value" });
    }

    db.prepare(
      "INSERT OR REPLACE INTO assets (key, value) VALUES (?, ?)"
    ).run(key, value);

    res.json({ success: true });
  }
);

/* ================= API 404 ================= */
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

/* ================= START ================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
