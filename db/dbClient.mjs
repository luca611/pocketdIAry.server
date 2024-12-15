// Module: dbClient
// Description: This module establishes a connection to a PostgreSQL database using the client.
// Dependencies: pg
// Last Modified: 2024-12-15

import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pkg;

export const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

/**
 * Attempts to establish a connection to the PostgreSQL database.
 * @returns {Promise<void>} Resolves when the connection is successfully established.
 */
export const connectDB = async () => {
    try {
        console.warn("Attempting to connect to PostgreSQL...");
        await client.connect();
        console.warn("✓ -> Connected to PostgreSQL successfully");
    } catch (err) {
        console.error("X -> Connection error:", err.message);
    }
    client.on('error', (err) => {
        console.warn("Database connection lost:", err.message);
    });
};


export default client;