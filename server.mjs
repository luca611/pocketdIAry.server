import fetch from 'node-fetch';
import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());


// Load environment variables from .env
dotenv.config();

const { Client } = pkg;  // Destructure Client from the imported pg package

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render's SSL connection
});

// Connect to the PostgreSQL database
client.connect()
.then(() => console.log('Connected to PostgreSQL'))
.catch(err => console.error('Connection error', err.stack));

// Endpoint: Execute a custom SQL query
app.post('/pocketDb', async (req, res) => {
    const { query, params } = req.body;

    try {
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const result = await client.query(query, params || []);
        res.status(200).json({ rows: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Function to interact with the Groq API
async function getGroqChatCompletion(userMessage) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: userMessage }],
                model: 'llama3-70b-8192',
            }),
        });

        const data = await response.json();
        return data.choices[0]?.message?.content || "No response";
    } catch (error) {
        console.error('Error fetching Groq API:', error);
        return "Error communicating with Groq API";
    }
}

// API Endpoint to use the getGroqChatCompletion function
app.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const response = await getGroqChatCompletion(message);
    res.json({ response });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome pocket API!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
