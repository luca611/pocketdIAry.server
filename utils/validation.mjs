// Module: validation
// Description: Utility functions for validating data.
// Dependencies: encryption, dbClient
// Last Modified: 2024-12-15

import { encryptMessage } from "./encryption.mjs";
import { client } from "../db/dbClient.mjs";

/**
 * Validates the format of an email address.
 *
 * @param {string} email - The email address to validate.
 * @returns {boolean} - Returns `true` if the email format is valid, otherwise `false`.
 */
export function validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Checks if an email exists in the database.
 *
 * @param {string} email - The email address to check.
 * @returns {Promise<boolean>} - A promise that resolves to true if the email exists, false otherwise.
 * @throws {Error} - Throws an error if there is an issue with the database query.
 */
export async function checkEmailExists(email) {
    const encryptedEmail = encryptMessage(process.env.ENCRYPT_KEY, email);
    const checkQuery = 'SELECT 1 FROM studenti WHERE email = $1 LIMIT 1';
    const checkParams = [encryptedEmail];

    try {
        const result = await client.query(checkQuery, checkParams);
        return result.rows.length > 0; // Returns true if the email exists
    } catch (err) {
        console.error("Error checking email existence:", err);
        return false; // In case of error, assume email doesn't exist
    }
}