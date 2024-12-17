import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { handleChat } from "./controllers/chatController.mjs";
import { getAvailableRoutes, keepAlive } from "./utils/serverUtils.mjs";
import { sendErrorResponse, sendSuccessResponse } from "./utils/response.mjs";

import { encryptMessage, decryptMessage } from "./utils/encryption.mjs";
import { client, connectDB } from "./db/dbClient.mjs";
import { login, deleteUser, updateTheme, updatePassword, updateName, register } from "./controllers/userController.mjs";
import { deleteNote, getNotes, getTodayNotes, addNote } from "./controllers/noteController.mjs";
import { checkEmailExists } from "./utils/validation.mjs";

import { ERROR, INTERNALERR, NOTFOUND } from "./utils/constants.mjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

/*--- middleware ---

    This will firstr parse the request body as JSON and then check if the JSON is valid.
    If the JSON is invalid, an error response will be sent. 
*/
app.use((req, res, next) => {
  express.json()(req, res, (jsonError) => {
    if (jsonError) {
      sendErrorResponse(res, ERROR, "Invalid JSON format");
      return;
    }
    next();
  });
});

/* --- CORS ---

    will be soon chnaged to only allow requests from the client's domain 
    but for now it's open to all origins
*/
app.use(cors({ origin: "*", methods: "GET,POST,DELETE,PATCH", allowedHeaders: ["Content-Type", "Authorization"] }));

connectDB();


// --- test routes ---
/*
    Query route
    @param query: SQL query
    @param params: SQL query parameters

    @return rows: query result rows
*/

app.post("/pocketDb", async (req, res) => {
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
    sendErrorResponse(res, INTERNALERR, "message cannot be decrypted with the provided key");
  }
});


//--- routes ---

app.get("/", (req, res) => {
  const availableRoutes = getAvailableRoutes(app);
  res.json({
    message: "Welcome to Pocket API!",
    availableEndpoints: availableRoutes,
  });
});

app.post("/chat", handleChat);

/*
    User routes
    - register
    - login
    - userDelete
    - changeTheme
    - changePassword
    - changeName
    - checkAvailability
*/
app.post("/register", register);
app.post("/login", login);
app.post("/userDelete", deleteUser);
app.post("/changeTheme", updateTheme);
app.post("/changePassword", updatePassword);
app.post("/changeName", updateName);

/*
    Note routes
    - addNote
    - deleteNote
    - getNotes
    - getTodayNotes
*/
app.post("/addNote", addNote);
app.post("/deleteNote", deleteNote);
app.post("/getNotes", getNotes);
app.post("/getTodayNotes", getTodayNotes);

/*
    other useful routes
    - checkEmailExists
*/
app.post("/checkAvailability", checkEmailExists);


/*
    Ping route, it's only used inside the server to avoid render auto-sleep
    since it will make a request to the server every 5 minutes (time before render auto-sleep kicks in)
    @return OK
*/

app.get("/ping", (req, res) => {
  res.status(200).send("OK");
});

/*
    Ping DB route, as the previous one, it's only used inside the server to avoid neon auto-sleep this time 
    @return Database connection successful
*/
app.get("/pingDB", (req, res) => {
  client.query("SELECT 1", (err) => {
    if (err) {
      return sendErrorResponse(res, INTERNALERR, "Database connection failed");
    }
    return sendSuccessResponse(res, "Database connection successful");
  });
});

/*
    404 route, will be used when a request is made to an unknown endpoint also will return the available endpoints witch
    might be useful or not but i guess it's not a bad idea to have them listed
    @return error: Endpoint not found
*/
app.use((req, res) => {
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

  keepAlive();
});
