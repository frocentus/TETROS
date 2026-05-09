const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const dbConfig = {
	host: process.env.DB_HOST || "db",
	port: parseInt(process.env.DB_PORT || "3306", 10),
	user: process.env.DB_USER || "tetros",
	password: process.env.DB_PASSWORD || "tetros_secret",
	database: process.env.DB_NAME || "tetros",
};

let pool;

async function initDb() {
	for (let attempt = 1; attempt <= 20; attempt++) {
		try {
			pool = mysql.createPool({
				...dbConfig,
				waitForConnections: true,
				connectionLimit: 5,
			});
			const conn = await pool.getConnection();
			await conn.execute(`
                CREATE TABLE IF NOT EXISTS highscores (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(20) NOT NULL,
                    email VARCHAR(60) DEFAULT NULL,
                    score INT NOT NULL,
                    level INT NOT NULL DEFAULT 1,
                    lines_cleared INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
			conn.release();
			console.log(`DB connected (attempt ${attempt})`);
			return;
		} catch (err) {
			console.log(`DB connect attempt ${attempt}/20 failed: ${err.message}`);
			await new Promise((r) => setTimeout(r, 3000));
		}
	}
	console.error("Could not connect to database after 20 attempts");
	process.exit(1);
}

// ═══════════════════════════
// RATE LIMITING (in-memory)
// ═══════════════════════════
const rateMap = new Map();
const RATE_WINDOW = 60_000; // 1 minute
const RATE_MAX = 5; // max 5 score submissions per minute per IP

function rateLimit(req, res, next) {
	const ip = req.headers["x-real-ip"] || req.ip;
	const now = Date.now();
	let entry = rateMap.get(ip);
	if (!entry || now - entry.start > RATE_WINDOW) {
		entry = { start: now, count: 0 };
		rateMap.set(ip, entry);
	}
	entry.count++;
	if (entry.count > RATE_MAX) {
		return res.status(429).json({ error: "Too many requests. Wait a moment." });
	}
	next();
}

// cleanup stale entries every 5 min
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of rateMap) {
		if (now - entry.start > RATE_WINDOW * 2) rateMap.delete(ip);
	}
}, 300_000);

// ═══════════════════════════
// ANTI-CHEAT: score validation
// ═══════════════════════════
function validateScore(score, level, lines) {
	// basic sanity checks
	if (!Number.isInteger(score) || score < 0 || score > 999_999) return false;
	if (!Number.isInteger(level) || level < 1 || level > 100) return false;
	if (!Number.isInteger(lines) || lines < 0 || lines > 9999) return false;

	// level should roughly match lines (level = floor(lines/10) + 1)
	const expectedLevel = Math.floor(lines / 10) + 1;
	if (level > expectedLevel + 2) return false; // small tolerance

	// max theoretical score per line: ~800 * level + combo bonuses
	// generous upper bound: 1500 points per line cleared * level
	const maxReasonable = lines * 1500 * level + 5000;
	if (score > maxReasonable && lines > 0) return false;

	// zero lines but high score? only hard-drop points (2 per row * rows)
	// generous: max ~50 points per piece drop, ~500 pieces max
	if (lines === 0 && score > 25000) return false;

	return true;
}

// ═══════════════════════════
// Input sanitization (module scope — defined once)
// ═══════════════════════════
const INVALID_CHARS = /[<>\u200B-\u200D\u2028\u2029\u202A-\u202E\uFEFF]/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function sanitize(str, maxLen) {
    return str
        .trim()
        .replace(INVALID_CHARS, "")
        .replace(CONTROL_CHARS, "")
        .normalize("NFC")
        .slice(0, maxLen);
}

// ═══════════════════════════
// POST /api/scores
// ═══════════════════════════
app.post("/api/scores", rateLimit, async (req, res) => {
	const { username, email, score, level, lines } = req.body;

	if (
		!username ||
		typeof username !== "string" ||
		username.trim().length === 0
	) {
		return res.status(400).json({ error: "Username is required" });
	}
	if (
		typeof score !== "number" ||
		typeof level !== "number" ||
		typeof lines !== "number"
	) {
		return res.status(400).json({ error: "Invalid data types" });
	}
	if (!validateScore(score, level, lines)) {
		return res.status(400).json({ error: "Score validation failed" });
	}

	const cleanName = sanitize(username, 20);
	if (!cleanName) {
		return res.status(400).json({ error: "Username contains only invalid characters" });
	}
	const cleanEmail =
		email && typeof email === "string" && email.trim().length > 0
			? sanitize(email, 60)
			: null;

	try {
		await pool.execute(
			"INSERT INTO highscores (username, email, score, level, lines_cleared) VALUES (?, ?, ?, ?, ?)",
			[cleanName, cleanEmail, score, level, lines],
		);
		res.json({ ok: true });
	} catch (err) {
		console.error("Insert error:", err.message);
		res.status(500).json({ error: "Database error" });
	}
});

// ═══════════════════════════
// GET /api/scores?period=all|week|day
// ═══════════════════════════
app.get("/api/scores", async (req, res) => {
	const period = req.query.period || "all";
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
	let dateFilter = "";

	if (period === "day") {
		dateFilter = "WHERE created_at >= CURDATE()";
	} else if (period === "week") {
		dateFilter = "WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
	}

	try {
		const [rows] = await pool.execute(
			`SELECT username, score, level, lines_cleared FROM highscores ${dateFilter} ORDER BY score DESC LIMIT ?`,
			[limit],
		);
		res.json(rows);
	} catch (err) {
		console.error("Query error:", err.message);
		res.status(500).json({ error: "Database error" });
	}
});

// health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// ═══════════════════════════════════════
// ADMIN PANEL — password-protected
// ═══════════════════════════════════════
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
	console.error(
		"FATAL: ADMIN_USER and ADMIN_PASS environment variables must be set",
	);
	process.exit(1);
}

function adminAuth(req, res, next) {
	const auth = req.headers.authorization;
	if (!auth || !auth.startsWith("Basic ")) {
		res.set("WWW-Authenticate", 'Basic realm="TETROS Admin"');
		return res.status(401).send("Authentication required");
	}
	const decoded = Buffer.from(auth.slice(6), "base64").toString();
	const [user, pass] = decoded.split(":");
	if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
		res.set("WWW-Authenticate", 'Basic realm="TETROS Admin"');
		return res.status(401).send("Invalid credentials");
	}
	next();
}

// admin API: stats
app.get("/thevoid/api/stats", adminAuth, async (_req, res) => {
	try {
		const [[totals]] = await pool.execute(`
            SELECT
                COUNT(*) AS total_games,
                COUNT(DISTINCT username) AS unique_players,
                COALESCE(MAX(score), 0) AS highest_score,
                ROUND(COALESCE(AVG(score), 0)) AS avg_score,
                COALESCE(SUM(lines_cleared), 0) AS total_lines,
                ROUND(COALESCE(AVG(level), 0), 1) AS avg_level,
                COALESCE(MAX(level), 0) AS max_level
            FROM highscores
        `);
		const [[today]] = await pool.execute(
			"SELECT COUNT(*) AS games_today FROM highscores WHERE created_at >= CURDATE()",
		);
		const [[week]] = await pool.execute(
			"SELECT COUNT(*) AS games_week FROM highscores WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
		);
		const [byDay] = await pool.execute(`
            SELECT DATE(created_at) AS day, COUNT(*) AS games, ROUND(AVG(score)) AS avg_score
            FROM highscores
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at) ORDER BY day DESC
        `);
		res.json({ ...totals, ...today, ...week, daily: byDay });
	} catch (err) {
		console.error("Admin stats error:", err.message);
		res.status(500).json({ error: "Database error" });
	}
});

// admin API: all players
app.get("/thevoid/api/players", adminAuth, async (_req, res) => {
	try {
		const [rows] = await pool.execute(`
            SELECT
                username,
                email,
                COUNT(*) AS games_played,
                MAX(score) AS best_score,
                ROUND(AVG(score)) AS avg_score,
                MAX(level) AS max_level,
                SUM(lines_cleared) AS total_lines,
                MAX(created_at) AS last_played
            FROM highscores
            GROUP BY username, email
            ORDER BY best_score DESC
        `);
		res.json(rows);
	} catch (err) {
		console.error("Admin players error:", err.message);
		res.status(500).json({ error: "Database error" });
	}
});

// admin dashboard HTML
app.get("/thevoid", adminAuth, (_req, res) => {
	res.send(ADMIN_HTML);
});

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TETROS Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#ccc;font-family:'Segoe UI',system-ui,sans-serif;padding:24px;max-width:1100px;margin:0 auto}
h1{color:#ff00ff;font-size:1.6rem;margin-bottom:24px;letter-spacing:4px}
h2{color:#00ffff;font-size:0.9rem;letter-spacing:3px;margin:20px 0 12px;text-transform:uppercase}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:#12121a;border:1px solid #ffffff11;border-radius:6px;padding:14px;text-align:center}
.stat-card .val{font-size:1.8rem;font-weight:700;color:#fff;text-shadow:0 0 12px #ff00ff44}
.stat-card .label{font-size:0.65rem;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:0.8rem}
th{text-align:left;color:#ff00ff88;font-size:0.65rem;letter-spacing:2px;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid #ffffff11}
td{padding:8px 10px;border-bottom:1px solid #ffffff08}
tr:hover td{background:#ffffff05}
.email{color:#666;font-size:0.75rem}
.score{color:#00ffff;font-weight:700}
.chart{margin-bottom:24px;background:#12121a;border:1px solid #ffffff11;border-radius:6px;padding:16px}
.chart-bars{display:flex;align-items:flex-end;gap:3px;height:100px}
.chart-bar{flex:1;background:linear-gradient(to top,#ff00ff44,#00ffff44);border-radius:2px 2px 0 0;min-width:8px;position:relative}
.chart-bar:hover::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:#1a1a2a;color:#fff;padding:4px 8px;border-radius:4px;font-size:0.65rem;white-space:nowrap;border:1px solid #ffffff22}
.loading{color:#666;font-style:italic}
</style>
</head>
<body>
<h1>TETROS ADMIN</h1>
<div class="stats-grid" id="stats"><div class="loading">Loading...</div></div>
<h2>ACTIVITY (30 DAYS)</h2>
<div class="chart" id="chart"><div class="loading">Loading...</div></div>
<h2>ALL PLAYERS</h2>
<table>
<thead><tr><th>PLAYER</th><th>EMAIL</th><th>GAMES</th><th>BEST</th><th>AVG</th><th>MAX LVL</th><th>LINES</th><th>LAST SEEN</th></tr></thead>
<tbody id="players"><tr><td colspan="8" class="loading">Loading...</td></tr></tbody>
</table>
<script>
async function load() {
    const [statsRes, playersRes] = await Promise.all([
        fetch('/thevoid/api/stats'),
        fetch('/thevoid/api/players')
    ]);
    const stats = await statsRes.json();
    const players = await playersRes.json();

    document.getElementById('stats').innerHTML = [
        ['TOTAL GAMES', stats.total_games],
        ['UNIQUE PLAYERS', stats.unique_players],
        ['HIGHEST SCORE', stats.highest_score.toLocaleString()],
        ['AVG SCORE', Number(stats.avg_score).toLocaleString()],
        ['TOTAL LINES', stats.total_lines.toLocaleString()],
        ['AVG LEVEL', stats.avg_level],
        ['TODAY', stats.games_today],
        ['THIS WEEK', stats.games_week],
    ].map(([l,v]) => '<div class="stat-card"><div class="val">'+v+'</div><div class="label">'+l+'</div></div>').join('');

    if (stats.daily && stats.daily.length > 0) {
        const maxG = Math.max(...stats.daily.map(d => d.games));
        document.getElementById('chart').innerHTML = '<div class="chart-bars">' +
            stats.daily.reverse().map(d => {
                const h = Math.max(4, (d.games / maxG) * 100);
                return '<div class="chart-bar" style="height:'+h+'px" data-tip="'+d.day+': '+d.games+' games, avg '+d.avg_score+'"></div>';
            }).join('') + '</div>';
    } else {
        document.getElementById('chart').innerHTML = '<div class="loading">No data yet</div>';
    }

    document.getElementById('players').innerHTML = players.length === 0
        ? '<tr><td colspan="8" class="loading">No players yet</td></tr>'
        : players.map(p =>
            '<tr><td>'+esc(p.username)+'</td><td class="email">'+(p.email||'—')+'</td><td>'+p.games_played+'</td><td class="score">'+p.best_score.toLocaleString()+'</td><td>'+Number(p.avg_score).toLocaleString()+'</td><td>'+p.max_level+'</td><td>'+p.total_lines+'</td><td>'+new Date(p.last_played).toLocaleDateString()+'</td></tr>'
        ).join('');
}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
load();
</script>
</body>
</html>`;

initDb().then(() => {
	app.listen(PORT, "0.0.0.0", () => {
		console.log(`Tetros API listening on port ${PORT}`);
	});
});
