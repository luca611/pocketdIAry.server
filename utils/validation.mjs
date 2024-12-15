// Module: validation
// Description: Utility functions for validating data.
// Dependencies: encryption, dbClient
// Last Modified: 2024-12-15

import { encryptMessage } from "./encryption.mjs";
import { client } from "../db/dbClient.mjs";
import { sendErrorResponse, sendSuccessResponse } from "./response.mjs";
import { ERROR } from "./constants.mjs";

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
export async function checkEmailExists(req, res) {
    const email = req.body.email;
    if (!validateEmailFormat(email)) {
        return sendErrorResponse(res, ERROR, "Invalid email format");
    }
    const encryptedEmail = encryptMessage(process.env.ENCRYPT_KEY, email);
    const checkQuery = 'SELECT 1 FROM studenti WHERE email = $1 LIMIT 1';
    const checkParams = [encryptedEmail];

    try {
        const result = await client.query(checkQuery, checkParams);
        if (result.rows.length > 0) {
            return sendErrorResponse(res, ERROR, "Email already exists");
        }
        else {
            return sendSuccessResponse(res, "Email does not exist");
        }
    } catch (err) {
        return sendErrorResponse(res, ERROR, err.message);
    }
}