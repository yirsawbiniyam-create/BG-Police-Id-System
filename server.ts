import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =========================
   ENV & APP
========================= */
const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC UPLOADS
========================= */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use("/uploads", express.static(uploadDir));

/* =========================
   MONGODB CONNECT
========================= */
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =========================
   SCHEMA & MODEL
========================= */
const idCardSchema = new mongoose.Schema({
  cardCode: { type: String, unique: true },
  fullNameAm: String,
  fullNameEn: String,
  rankAm: String,
  rankEn: String,
  badgeNumber: String,
  photo: String, // /uploads/card.png
  createdAt: { type: Date, default: Date.now }
});

const IdCard = mongoose.model("IdCard", idCardSchema);

/* =========================
   HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "server running" });
});

/* =========================
   CREATE ID CARD
========================= */
app.post("/api/id/create", async (req, res) => {
  try {
    const cardCode = `BGR-${Date.now()}`;

    const card = await IdCard.create({
      cardCode,
      ...req.body,
      photo: "/uploads/card.png"
    });

    res.json({
      success: true,
      cardCode,
      verifyUrl: `/verify/${cardCode}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   VERIFY PAGE (PUBLIC)
========================= */
app.get("/verify/:cardCode", async (req, res) => {
  const card = await IdCard.findOne({ cardCode: req.params.cardCode });

  if (!card) {
    return res.send("<h1>❌ INVALID CARD</h1>");
  }

  res.send(`
    <html>
      <head>
        <title>Police ID Verification</title>
      </head>
      <body style="font-family: Arial">
        <h1>✅ VALID POLICE ID</h1>
        <img src="${card.photo}" width="150"/><br/><br/>
        <strong>${card.fullNameEn}</strong><br/>
        Rank: ${card.rankEn}<br/>
        Badge: ${card.badgeNumber}<br/>
        <hr/>
        <small>Card Code: ${card.cardCode}</small>
      </body>
    </html>
  `);
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
