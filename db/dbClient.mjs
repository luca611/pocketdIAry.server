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

export const connectDB = async () => {
    try {
        console.log("Attempting to connect to PostgreSQL...");
        await client.connect();
        console.log("✓ -> Connected to PostgreSQL successfully");
    } catch (err) {
        console.error("X -> Connection error:", err.message);
    }
};

export default client;