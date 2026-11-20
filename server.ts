import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// Simple sliding-window rate limiter per IP to protect /api/* from abuse
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, val] of rateBuckets.entries()) {
      if (val.resetAt <= now) rateBuckets.delete(key);
    }
  }
  const entry = rateBuckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  // Harden HTTP Security Headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    next();
  });

  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "firebase" });
  });

  // Secure Gemini Translation Proxy with strict validation & rate-limiting
  app.post("/api/gemini", async (req, res) => {
    try {
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
      if (!checkRateLimit(clientIp, 60, 60_000)) {
        return res.status(429).json({ error: "Too many translation requests. Please wait a moment." });
      }

      if (!req.is("application/json")) {
        return res.status(415).json({ error: "Unsupported content type" });
      }

      const { prompt } = req.body || {};
      if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 600) {
        return res.status(400).json({ error: "Invalid translation prompt" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Translation service not configured" });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt.trim() }] }],
            }),
            signal: controller.signal,
          }
        );

        const data = (await response.json()) as any;
        if (!response.ok) {
          return res.status(response.status).json({ error: data?.error?.message || "Translation API error" });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.json({ text });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return res.status(504).json({ error: "Translation request timed out" });
      }
      console.error("Gemini Proxy Error:", error);
      return res.status(500).json({ error: "Failed to process translation request" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  return app;
}

const appPromise = startServer();
export default appPromise;
