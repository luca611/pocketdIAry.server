import fetch from "node-fetch";
import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import cors from "cors";
import { validate } from 'deep-email-validator';

import pkg from "pg";

const INTERVAL = 4 * 60 * 1000;
const ERROR = 400;
const SUCCESS = 200;
const INTERNALERR = 500;
const NOTFOUND = 404;

const AIAPIURL = "https://api.groq.com/openai/v1/chat/completions";
const AIMODEL = "llama3-70b-8192";

const { Client } = pkg;

const app = express();
const PORT = process.env.PORT || 3005;

//--- loading env ---

app.use(express.json());
dotenv.config();

app.use(
  cors({
    origin: "*", // Allow all origins temporarily
    methods: "GET,POST,DELETE,PATCH",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

//--- db connection ---
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

client
  .connect()
  .then(() => console.log("✓ -> Connected to PostgreSQL successfully"))
  .catch((err) => console.error("Connection error", err.stack));

//--- endpoints logic ---

async function getAiResponse(userMessage) {
  try {
    const response = await fetch(AIAPIURL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        model: AIMODEL,
      }),
    });
    const data = await response.json();
    return data.choices[0]?.message?.content || "No response";
  } catch (error) {
    console.error("x -> Error: fetching AI API:", error);
    return "Error communicating with AI API";
  }
}

function keepServerAlive() {
  setInterval(async () => {
    try {
      await fetch(`http://localhost:${PORT}/`);
      await client.query("SELECT 1");
      console.log("✓ -> Keepalive executed at: " + new Date().toLocaleString());
    } catch (error) {
      console.error("x -> Keep-alive error:", error);
    }
  }, INTERVAL);
}

function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

function encryptMessage(key, message) {
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    iv
  );
  let encrypted = cipher.update(message, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptMessage(key, encryptedMessage) {
  const iv = Buffer.alloc(16, 0);
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    iv
  );
  let decrypted = decipher.update(encryptedMessage, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function createHash(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

const sendErrorResponse = (res, status, message) =>
  res.status(status).json({ error: message });
const sendSuccessResponse = (res, data) => res.status(SUCCESS).json(data);

const getAvailableRoutes = (app) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const { path } = middleware.route;
      const methods = Object.keys(middleware.route.methods)
        .join(", ")
        .toUpperCase();
      routes.push({ path, methods });
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const { path } = handler.route;
          const methods = Object.keys(handler.route.methods)
            .join(", ")
            .toUpperCase();
          routes.push({ path, methods });
        }
      });
    }
  });
  return routes;
};

//--- endpoints ---

// Home route
app.get("/", (req, res) => {
  const availableRoutes = getAvailableRoutes(app);
  res.json({
    message: "Welcome to Pocket API!",
    availableEndpoints: availableRoutes,
  });
});

/*
    Chat route
    @param message: user message

    @return response: AI response
*/
app.get("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return sendErrorResponse(res, ERROR, "Message not provided");
  }

  try {
    const response = await getAiResponse(message);
    sendSuccessResponse(res, { response });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    Query route
    @param query: SQL query
    @param params: SQL query parameters

    @return rows: query result rows
*/

app.get("/pocketDb", async (req, res) => {
  const { query, params = [] } = req.body;
  if (!query) {
    return sendErrorResponse(res, ERROR, "Query not provided");
  }

  try {
    const result = await client.query(query, params);
    sendSuccessResponse(res, { rows: result.rows });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    Encrypt route
    @param key: encryption key
    @param message: message to encrypt

    @return encryptedMessage: encrypted message
*/
app.post("/encrypt", (req, res) => {
  const { key, message } = req.body;
  if (!key || !message) {
    return sendErrorResponse(res, ERROR, "Missing key or message");
  }

  try {
    const encryptedMessage = encryptMessage(key, message);
    sendSuccessResponse(res, { encryptedMessage });
  } catch {
    sendErrorResponse(res, INTERNALERR, "Invalid key");
  }
});

/*
    Decrypt message route
    @param key: decryption key
    @param message: encrypted message

    @return decryptedMessage: decrypted message
*/
app.post("/decrypt", (req, res) => {
  const { key, message } = req.body;
  if (!key || !message) {
    return sendErrorResponse(res, ERROR, "Missing key or message");
  }

  try {
    const decryptedMessage = decryptMessage(key, message);
    sendSuccessResponse(res, { decryptedMessage });
  } catch {
    sendErrorResponse(
      res,
      INTERNALERR,
      "message cannot be decrypted with the provided key"
    );
  }
});

/*
    Register route
    @param email: user email
    @param password: user password
    @param ntema: user theme
    @param name: user name

    @return message: "OK" if the user was registered
*/
app.post("/register", async (req, res) => {
  let { email, password, ntema, name } = req.body;
  if (
    !email ||
    !password ||
    !name ||
    typeof ntema !== "number" ||
    email.length > 128 ||
    password.length > 128 ||
    name.length > 128
  ) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  const validationResult = await validate(email);

  if (!validationResult.valid) {
    return sendErrorResponse(res, ERROR, "not existing email");
  }

  try {
    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    name = encryptMessage(process.env.ENCRYPT_KEY, name);
    password = createHash(password);
    const key = generateKey();

    const query = `
            INSERT INTO studenti (email, password, ntema, nome, chiave)
            VALUES ($1, $2, $3, $4, $5)
        `;
    const params = [email, password, ntema, name, key];
    await client.query(query, params);

    sendSuccessResponse(res, { message: "OK" });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    Login route
    @param email: user email
    @param password: user password

    @return key: user key
*/

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  try {
    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    password = createHash(password);

    const query = `
        SELECT chiave, nome, ntema
        FROM studenti
        WHERE email = $1 AND password = $2
        `;
    const params = [email, password];
    const result = await client.query(query, params);

    if (result.rows.length === 0) {
      return sendErrorResponse(res, ERROR, "Invalid credentials");
    }

    const user = result.rows[0];
    const name = decryptMessage(process.env.ENCRYPT_KEY, user.nome);

    sendSuccessResponse(res, {
      key: user.chiave,
      name: name,
      theme: user.ntema
    });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    user deletion route
    @param key: user key
    @param email: user email
    @param password: user password

    @return message: "OK" if the user was deleted or if no action was taken because the user was not found
*/

app.delete("/userDelete", async (req, res) => {
  let { key, email, password } = req.body;
  if (!key || !email || !password) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  email = encryptMessage(process.env.ENCRYPT_KEY, email);
  password = createHash(password);

  try {
    const query = `
            SELECT * FROM studenti
            WHERE chiave = $1 AND email = $2 AND password = $3
        `;
    const params = [key, email, password];
    let result = await client.query(query, params);

    if (result.rows.length === 0) {
      return sendSuccessResponse(res, { message: "no user found" });
    }
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }

  try {
    const query = `
            DELETE FROM studenti
            WHERE chiave = $1 AND email = $2 AND password = $3
        `;
    const params = [key, email, password];
    await client.query(query, params);

    sendSuccessResponse(res, { message: "OK" });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    user information update route
    @param key: user key
    @param email: user email <optional>
    @param password: user password <optional>
    @param ntema: user theme <optional>
    @param name: user name <optional>

    @return message: "OK" if the user was updated
*/
app.patch("/userUpdate", async (req, res) => {
  let { key, email, password, ntema, name } = req.body;
  if (!key) {
    return sendErrorResponse(res, ERROR, "Key is required");
  }

  if (
    email.length > 128 ||
    password > 128 ||
    typeof ntema !== "number" ||
    name > 128
  ) {
    return sendErrorResponse(
      res,
      ERROR,
      "A parameter is too long or the type dosen't match the expected one"
    );
  }

  let updateFields = [];
  let params = [];

  if (email) {
    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    updateFields.push("email = $" + (params.length + 1));
    params.push(email);
  }

  if (password && password.length <= 128) {
    password = createHash(password);
    updateFields.push("password = $" + (params.length + 1));
    params.push(password);
  }

  if (typeof ntema === "number") {
    updateFields.push("ntema = $" + (params.length + 1));
    params.push(ntema);
  }

  if (name && name.length <= 128) {
    name = encryptMessage(process.env.ENCRYPT_KEY, name);
    updateFields.push("nome = $" + (params.length + 1));
    params.push(name);
  }

  if (updateFields.length === 0) {
    return sendErrorResponse(res, ERROR, "No fields to update");
  }

  params.push(key);

  const query = `
        UPDATE studenti
        SET ${updateFields.join(", ")}
        WHERE chiave = $${params.length}
    `;

  try {
    await client.query(query, params);
    sendSuccessResponse(res, { message: "OK - Executed:" + query });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    note creation route
    @param key: user key
    @param title: note title
    @param description: note description
    @param date: note expire date
    @param email: user email
*/

app.post("/addNote", async (req, res) => {
  let { key, title, description, date, email } = req.body;
  if (!key || !title || !description || !date || !email) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  email = encryptMessage(process.env.ENCRYPT_KEY, email);
  title = encryptMessage(key, title);
  description = encryptMessage(key, description);

  try {
    let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
    let params = [key, email];
    let result = await client.query(query, params);

    if (result.rows.length === 0) {
      return sendErrorResponse(res, ERROR, "user not found");
    }

    query = `
            INSERT INTO note (dataora, titolo, testo, idStudente)
            VALUES ($1, $2, $3, $4)
        `;
    params = [date, title, description, email];
    await client.query(query, params);

    sendSuccessResponse(res, { message: "OK" });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    notes fetch route
    @param key: user key
    @param email: user email
    @param date: note date

    @return notes: list of notes

    warning: for some reasons postgree dastes are 1 day behind
             this won't affect the functionality of the endpoin
             but will appear in the output
*/

app.get("/getNotes", async (req, res) => {
  let { key, email, date } = req.body;
  if (!key || !email || !date) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  email = encryptMessage(process.env.ENCRYPT_KEY, email);

  try {
    let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
    let params = [key, email];
    let result = await client.query(query, params);

    if (result.rows.length === 0) {
      return sendErrorResponse(res, ERROR, "user not found");
    }

    query = `
            SELECT * from note WHERE idStudente = $1 AND dataora = $2 
        `;
    params = [email, date];
    result = await client.query(query, params);

    let notes = result.rows.map((note) => {
      return {
        title: decryptMessage(key, note.titolo),
        description: decryptMessage(key, note.testo),
        dataora: note.dataora,
      };
    });

    sendSuccessResponse(res, { notes });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    notes fetch route
    @param key: user key
    @param email: user email
    
    @return notes: list of today notes

    warning: shares the same issue as the previous endpoint
*/

app.get("/getTodayNotes", async (req, res) => {
  let { key, email } = req.body;
  if (!key || !email) {
    return sendErrorResponse(res, ERROR, "Invalid inputs");
  }

  email = encryptMessage(process.env.ENCRYPT_KEY, email);

  try {
    let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
    let params = [key, email];
    let result = await client.query(query, params);

    if (result.rows.length === 0) {
      return sendErrorResponse(res, ERROR, "user not found");
    }

    query = `
            SELECT * from note WHERE idStudente = $1 AND dataora = CURRENT_DATE
        `;
    params = [email];
    result = await client.query(query, params);

    let notes = result.rows.map((note) => {
      return {
        title: decryptMessage(key, note.titolo),
        description: decryptMessage(key, note.testo),
        dataora: note.dataora,
      };
    });

    sendSuccessResponse(res, { notes });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

/*
    notes fetch route
    @param key: user key
    @param email: user email

    @return notes: list of all notes
*/
app.post("/checkAvailability", async (req, res) => {
  const { email } = req.body;

  if (!email || email.length > 128) {
    return sendErrorResponse(res, ERROR, "Invalid email");
  }

  try {
    const emailExists = await checkEmailExists(email);

    if (emailExists) {
      return sendErrorResponse(res, ERROR, "Email is already taken");
    }

    sendSuccessResponse(res, { message: "Email is available" });
  } catch (err) {
    sendErrorResponse(res, INTERNALERR, err.message);
  }
});

async function checkEmailExists(email) {
  const encryptedEmail = encryptMessage(process.env.ENCRYPT_KEY, email);
  const checkQuery = `SELECT 1 FROM studenti WHERE email = $1 LIMIT 1`;
  const checkParams = [encryptedEmail];

  try {
    const result = await client.query(checkQuery, checkParams);
    return result.rows.length > 0; // Returns true if the email exists
  } catch (err) {
    console.error("Error checking email existence:", err);
    return false; // In case of error, assume email doesn't exist
  }
}

//--- not existing endpoint handler ---

/*
    Not existing endpoint handler
 
    @return availableEndpoints: list of available endpoints
*/
app.use((req, res) => {
  console.warn(
    `⚠ -> Attempt to access unknown endpoint: ${req.method} ${req.originalUrl}`
  );
  const availableRoutes = getAvailableRoutes(app);
  res.status(NOTFOUND).json({
    error: "Endpoint not found",
    availableEndpoints: availableRoutes,
  });
});

//--- server start ---
app.listen(PORT, () => {
  console.log(`------------------------------------------------`);
  console.log(`Server is running on port ${PORT}`);
  console.log(`------------------------------------------------`);

  keepServerAlive();
});
