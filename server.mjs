import fetch from 'node-fetch';
import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';

import pkg from 'pg';

const INTERVAL = 5 * 60 * 1000;
const ERROR = 400;
const SUCCESS = 200;
const INTERNALERR = 500;

const AIAPIURL = 'https://api.groq.com/openai/v1/chat/completions';
const AIMODEL = 'llama3-70b-8192';

const { Client } = pkg;

const app = express();
const PORT = process.env.PORT || 3005;

//--- loading env ---

app.use(express.json());
dotenv.config();

//--- db connection ---
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
.then(() => console.log('Connected to PostgreSQL'))
.catch(err => console.error('Connection error', err.stack));

//--- endpoints logic ---

async function getAiResponse(userMessage) {
    try {
        const response = await fetch(AIAPIURL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: userMessage }],
                model: AIMODEL,
            }),
        });
        const data = await response.json();
        return data.choices[0]?.message?.content || "No response";
    } catch (error) {
        console.error('-> Error: fetching AI API:', error);
        return "Error communicating with AI API";
    }
}

function keepServerAlive() {
    setInterval(async () => {
        try {
            await fetch(`http://localhost:${PORT}/`);
            await client.query('SELECT 1');
        } catch (error) {
            console.error('Keep-alive error:', error);
        }
    }, INTERVAL);
}

function generateKey() {
    return crypto.randomBytes(32).toString('hex');
}

function encryptMessage(key, message) {
    const iv = Buffer.alloc(16, 0); 
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptMessage(key, encryptedMessage) {
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function createHash(data) {
    const hash = crypto.createHash('sha256'); 
    hash.update(data); 
    return hash.digest('hex');  
}

//--- endpoints ---

app.get('/', (req, res) => {
    res.send('Welcome pocket API!');
});

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(ERROR).json({ error: 'Message not provided'});
    }
    const response = await getAiResponse(message);
    res.json({ response });
});

app.get('/pocketDb', async (req, res) => {
    const { query, params } = req.body;
    try {
        if (!query) {
            return res.status(ERROR).json({ error: 'Query not provided' });
        }
        const result = await client.query(query, params || []);
        res.status(SUCCESS).json({ rows: result.rows });
    } catch (err) {
        res.status(INTERNALERR).json({ error: err.message });
    }
});

app.post('/encrypt', (req, res) => {
    const { key, message } = req.body;
    if (!key || !message) {
      return res.status(ERROR).json({ error: 'Missing key or message' });
    }
    try {
      const encryptedMessage = encryptMessage(key, message);
      res.json({ encryptedMessage });
    }catch (error) {
      res.status(INTERNALERR).json({ error: 'Invalid key' });
    }
});

app.post('/decrypt', (req, res) => {
    const { key, message } = req.body;
    if (!key || !message) {
      return res.status(ERROR).json({ error: 'Missing key or message' });
    }
    try {
      const decryptedMessage = decryptMessage(key, message);
      res.json({ decryptedMessage });
    }catch (error) {
      res.status(INTERNALERR).json({ error: 'Invalid key' });
    }
});

app.post('/register', async (req, res) => {
  let { email, password, ntema, name } = req.body;
  try {
    if (
      !email || !password || !name || typeof ntema !== 'number' ||
      email.length > 128 || password.length > 128 || name.length > 128
    ) {
      return res.status(ERROR).json({ error: 'invalid inputs' });
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    name = encryptMessage(process.env.ENCRYPT_KEY, name);
    password = createHash(password);

    const key =  generateKey();
    const query = `
      INSERT INTO studenti (email, password, ntema, nome, chiave)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const params = [email, password, ntema, name, key];
    await client.query(query, params);

    res.status(SUCCESS).json({
      message: 'OK',
    });
  } catch (err) {
    res.status(INTERNALERR).json({ error: err.message });
  }
});

app.get('/logn', async (req, res) => {
    let { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(ERROR).json({ error: 'invalid inputs' });
        }
        email = encryptMessage(process.env.ENCRYPT_KEY, email);
        password = createHash(password);

        const query = `
            SELECT chiave
            FROM studenti
            WHERE email = $1 AND password = $2
        `;
        const params = [email, password];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return res.status(ERROR).json({ error: 'invalid credentials' });
        }

        res.status(SUCCESS).json({
            key: result.rows[0].chiave,
        });
    } catch (err) {
        res.status(INTERNALERR).json({ error: err.message });
    }
});

//--- server start ---
app.listen(PORT, () => {
    console.log(`---------------------------------`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`---------------------------------`);

    keepServerAlive();
});
