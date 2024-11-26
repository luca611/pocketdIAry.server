import fetch from 'node-fetch';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';


const scriptURL = 'http://pockeddb.rf.gd/query.php?';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());

import puppeteer from 'puppeteer';

app.get('/query', async (req, res) => {
    const userQuery = req.query.query;  // Get query parameter from URL

    if (!userQuery) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        // Launch Puppeteer and make the request
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Set up necessary headers
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        });

        // Go to the URL with the provided query
        await page.goto(`http://pockeddb.rf.gd/query.php?query=${encodeURIComponent(userQuery)}`, {
            waitUntil: 'networkidle2',
        });

        // Extract the JSON data from the <pre> tag
        const jsonData = await page.evaluate(() => {
            const preTag = document.querySelector('pre');
            return preTag ? preTag.innerText : null;
        });

        if (jsonData) {
            try {
                // Parse the JSON data and return it
                const cleanedData = JSON.parse(jsonData);
                res.json(cleanedData);
            } catch (error) {
                res.status(500).json({ error: 'Error parsing JSON from the response' });
            }
        } else {
            res.status(500).json({ error: 'No JSON data found in the response' });
        }

        // Close the browser after processing the request
        await browser.close();
    } catch (error) {
        console.error('Error with Puppeteer:', error);
        res.status(500).json({ error: 'Error processing the request' });
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
