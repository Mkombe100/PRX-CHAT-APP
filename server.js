// server.js
const express = require("express");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // important for /api/messages JSON body
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// SIGNUP
app.post("/signup", async (req, res) => {
  const { username, password, publicKey } = req.body;

  console.log("=== /signup ===");
  console.log("username:", username);
  console.log("publicKey present:", !!publicKey);

  if (!username || !password || !publicKey) {
    return res.status(400).send("Missing username, password, or publicKey");
  }

  try {
    const check = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    if (check.rows.length > 0) {
      return res.status(400).send("Username already exists.");
    }

    await pool.query(
      "INSERT INTO users(username, password, public_key) VALUES($1, $2, $3)",
      [username, password, publicKey]
    );

    res.redirect("/login.html");
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).send("Database Error");
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("=== /login ===");
  console.log("username:", username);

  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username=$1 AND password=$2",
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).send("Invalid username or password.");
    }

    const user = result.rows[0];

    res.render("dashboard", {
      username: user.username,
      userId: user.id,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).send("Database Error");
  }
});

// Get all other users (for chat list)
app.get("/api/users", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: "Missing username" });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, public_key FROM users WHERE username <> $1",
      [username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json([]);
  }
});

// Get single user's public key
app.get("/api/users/:username", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, public_key FROM users WHERE username=$1",
      [req.params.username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send encrypted message
app.post("/api/messages", async (req, res) => {
  const { fromUsername, toUsername, ciphertext } = req.body;

  console.log("=== /api/messages (POST) ===");
  console.log("fromUsername:", fromUsername);
  console.log("toUsername:", toUsername);
  console.log("ciphertext:", ciphertext);

  // Basic validation
  if (!fromUsername || !toUsername) {
    console.error("Missing fromUsername or toUsername");
    return res.status(400).json({ error: "Missing fromUsername or toUsername" });
  }

  if (!ciphertext || typeof ciphertext !== "object") {
    console.error("Missing or invalid ciphertext");
    return res.status(400).json({ error: "Missing or invalid ciphertext" });
  }

  if (!ciphertext.iv || !ciphertext.data) {
    console.error("ciphertext must have iv and data");
    return res.status(400).json({ error: "ciphertext must have iv and data" });
  }

  try {
    const fromRes = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [fromUsername]
    );
    const toRes = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [toUsername]
    );

    console.log("fromRes.rows:", fromRes.rows);
    console.log("toRes.rows:", toRes.rows);

    if (fromRes.rows.length === 0 || toRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid users" });
    }

    const fromId = fromRes.rows[0].id;
    const toId = toRes.rows[0].id;

    console.log("Inserting message:", { fromId, toId, iv: ciphertext.iv, data: ciphertext.data });

    await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, iv, data)
       VALUES ($1, $2, $3, $4)`,
      [fromId, toId, ciphertext.iv, ciphertext.data]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    res.status(500).json({ error: "Failed to send message", details: err.message });
  }
});

// Get messages between two users
app.get("/api/messages", async (req, res) => {
  const { user1, user2 } = req.query;

  console.log("=== /api/messages (GET) ===");
  console.log("user1:", user1, "user2:", user2);

  if (!user1 || !user2) {
    return res.status(400).json({ error: "Missing user1 or user2" });
  }

  try {
    const u1 = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [user1]
    );
    const u2 = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [user2]
    );

    if (u1.rows.length === 0 || u2.rows.length === 0) {
      return res.status(400).json({ error: "Invalid users" });
    }

    const id1 = u1.rows[0].id;
    const id2 = u2.rows[0].id;

    const result = await pool.query(
      `SELECT m.*, 
              s.username AS sender_username,
              r.username AS recipient_username
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.recipient_id = r.id
       WHERE (m.sender_id=$1 AND m.recipient_id=$2)
          OR (m.sender_id=$2 AND m.recipient_id=$1)
       ORDER BY m.created_at ASC`,
      [id1, id2]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});