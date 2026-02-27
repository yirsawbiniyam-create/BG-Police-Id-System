import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "police-id-secret-key-2026";

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Database (Render uses ephemeral disk – OK for now)
const DB_PATH = "database.sqlite";
const db = new Database(DB_PATH);

// Init DB
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Ensure default admin
const admin = db.prepare(
  "SELECT * FROM users WHERE username = ? COLLATE NOCASE"
).get("POLICE");

const hashed = bcrypt.hashSync("POLICE1234", 10);

if (!admin) {
  db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)"
  ).run("POLICE", hashed, "Administrator");
} else {
  db.prepare(
    "UPDATE users SET password = ?, role = 'Administrator' WHERE username = ? COLLATE NOCASE"
  ).run(hashed, "POLICE");
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE username = ? COLLATE NOCASE"
  ).get(username);

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
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// API 404
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
});
