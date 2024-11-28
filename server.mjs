import fetch from 'node-fetch';
import express from 'express';
import dotenv from 'dotenv';
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

app.post('/pocketDb', async (req, res) => {
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


//
app.listen(PORT, () => {
    console.log(`---------------------------------`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`---------------------------------`);

    keepServerAlive();
});
