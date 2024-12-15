// Module: AI API
// Description: Fetches AI response from OpenAI API.
// Dependencies: node-fetch
// Last Modified: 2024-12-15

import fetch from "node-fetch";

const AIAPIURL = "https://api.groq.com/openai/v1/chat/completions";
const AIMODEL = "llama3-70b-8192";

/**
 * Sends a user message to the AI API and retrieves the AI's response.
 *
 * @param {string} userMessage - The message from the user to send to the AI.
 * @returns {Promise<string>} - The response from the AI, or an error message if the request fails.
 */
export async function getAiResponse(userMessage) {
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
