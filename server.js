import "dotenv/config";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = Number(process.env.PORT ?? 3000);
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL env var. Set it before starting the server."
  );
}
if (!SESSION_SECRET) {
  throw new Error(
    "Missing SESSION_SECRET env var. Set it before starting the server."
  );
}

function requireAuth(req, res, next) {
  if (req.session?.user?.id) return next();
  return res.redirect("/login");
}

function parseDbUrl(dbUrl) {
  const u = new URL(dbUrl);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "defaultdb",
    ssl: { rejectUnauthorized: false }
  };
}

const pool = mysql.createPool({
  ...parseDbUrl(DATABASE_URL),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

app.get("/", (req, res) => {
  if (req.session?.user?.id) return res.redirect("/landing/");
  return res.redirect("/login");
});

app.get("/register", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.post("/register", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const email = String(req.body.email ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!username || !email || !password) {
    return res.redirect("/register?error=missing");
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username, email, password_hash]
    );
    return res.redirect("/login?registered=1");
  } catch (e) {
    const msg = String(e?.message ?? "");
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      return res.redirect("/register?error=exists");
    }
    console.error(e);
    return res.redirect("/register?error=server");
  }
});

app.get("/login", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!username || !password) {
    return res.redirect("/login?error=missing");
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1`,
      [username]
    );
    const user = Array.isArray(rows) ? rows[0] : null;
    if (!user) return res.redirect("/login?error=invalid");

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.redirect("/login?error=invalid");

    req.session.user = { id: user.id, username: user.username };
    return res.redirect("/landing/");
  } catch (e) {
    console.error(e);
    return res.redirect("/login?error=server");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// Static assets (login/register)
app.get("/auth.css", (req, res) => {
  return res.sendFile(path.join(__dirname, "public", "auth.css"));
});
app.use("/assets", express.static(path.join(__dirname, "public", "assets")));

// Protected Netflix landing
app.use(
  "/landing",
  requireAuth,
  express.static(path.join(__dirname, "public", "landing"), {
    extensions: ["html"]
  })
);

await ensureTables();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

