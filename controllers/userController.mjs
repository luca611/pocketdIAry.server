//module: userController
//Description: This module contains functions for user registration, login, and profile management.
//Dependencies: utils/response, utils/encryption, utils/validation, db/dbClient
//Last Modified: 2024-12-15

import { sendErrorResponse, sendSuccessResponse } from "../utils/response.mjs";
import { encryptMessage, createHash, generateKey, decryptMessage } from "../utils/encryption.mjs";
import { validateEmailFormat } from "../utils/validation.mjs";
import { ERROR, INTERNALERR } from "../utils/constants.mjs";

import client from "../db/dbClient.mjs";

/**
 * Registers a new user.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {number} req.body.ntema - The ntema value of the user. (yellow ,green, blue or purple in numerical form)
 * @param {string} req.body.name - The name of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the user is registered.
 */
export async function register(req, res) {
    const { email, password, ntema, name } = req.body;

    // Input validation
    if (
        !email ||
        !password ||
        !name ||
        typeof ntema !== "number" ||
        email.length > 128 ||
        password.length > 128 ||
        name.length > 128
    ) {
        return sendErrorResponse(res, ERROR, "Invalid input parameters.");
    }

    if (!validateEmailFormat(email)) {
        return sendErrorResponse(res, ERROR, "Invalid email format.");
    }

    try {
        const encryptedEmail = encryptMessage(process.env.ENCRYPT_KEY, email);
        const encryptedName = encryptMessage(process.env.ENCRYPT_KEY, name);
        const hashedPassword = createHash(password);
        const generatedKey = generateKey();

        // Insert into the database
        const insertQuery = `
            INSERT INTO studenti (email, password, ntema, nome, chiave)
            VALUES ($1, $2, $3, $4, $5)
        `;
        const insertParams = [encryptedEmail, hashedPassword, ntema, encryptedName, generatedKey];
        await client.query(insertQuery, insertParams);

        return sendSuccessResponse(res, { message: "Registration successful!" });
    } catch (error) {
        if (error.code === "23505") {
            return sendErrorResponse(res, ERROR, "Email already registered.");
        } else {
            console.error("Error during registration:", error.message);
            return sendErrorResponse(res, INTERNALERR, "An error occurred. Please try again.");
        }
    }
}

/**
 * Logs in a user by validating their email and password, and returns user details if successful.
 * the returned object contains the user's non obtainable from the client side. so key, ntema and name.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the login process is complete.
 */
export async function login(req, res) {
    let { email, password } = req.body;
    if (!email || !password) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    try {
        email = encryptMessage(process.env.ENCRYPT_KEY, email);
        password = createHash(password);

        const query = `
            SELECT chiave, nome, ntema
            FROM studenti
            WHERE email = $1 AND password = $2
        `;
        const params = [email, password];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendErrorResponse(res, ERROR, "Invalid credentials");
        } else {
            const user = result.rows[0];
            const name = decryptMessage(process.env.ENCRYPT_KEY, user.nome);

            return sendSuccessResponse(res, {
                key: user.chiave,
                name,
                theme: user.ntema
            });
        }


    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Deletes a user from the database based on the provided key, email, and password.
 * the key is an extra security measure to ensure that the user is deleting their own account. 
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The unique key of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - Sends a response indicating the result of the operation.
 */
export async function deleteUser(req, res) {
    let { key, email, password } = req.body;
    if (!key || !email || !password) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    password = createHash(password);

    try {
        const query = `
            SELECT * FROM studenti
            WHERE chiave = $1 AND email = $2 AND password = $3
        `;
        const params = [key, email, password];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendSuccessResponse(res, { message: "no user found" });
        }
    } catch (err) {
        sendErrorResponse(res, INTERNALERR, err.message);
    }

    try {
        const query = `
            DELETE FROM studenti
            WHERE chiave = $1 AND email = $2 AND password = $3
        `;
        const params = [key, email, password];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Updates the user's name in the database based on the provided key, email, and password.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The unique key of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {string} req.body.name - The new name of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - Sends a response indicating the result of the operation.
 */
export async function updateName(req, res) {
    let { key, email, password, name } = req.body;
    if (!key || !email || !password || !name) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    password = createHash(password);
    name = encryptMessage(process.env.ENCRYPT_KEY, name);

    try {
        const query = `
            UPDATE studenti
            SET nome = $1
            WHERE chiave = $2 AND email = $3 AND password = $4
        `;
        const params = [name, key, email, password];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Updates the user's password in the database based on the provided key, email, and password.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The unique key of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The old password of the user.
 * @param {string} req.body.newPassword - The new password of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - Sends a response indicating the result of the operation.
 */

export async function updatePassword(req, res) {
    let { key, email, password, newPassword } = req.body;
    if (!key || !email || !password || !newPassword) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    password = createHash(password);
    newPassword = createHash(newPassword);

    try {
        const query = `
            UPDATE studenti
            SET password = $1
            WHERE chiave = $2 AND email = $3 AND password = $4
        `;
        const params = [newPassword, key, email, password];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Updates the user's theme in the database based on the provided key, email, and password.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The unique key of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {number} req.body.ntema - The new theme of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - Sends a response indicating the result of the operation.
 */

export async function updateTheme(req, res) {
    let { key, email, password, ntema } = req.body;
    if (!key || !email || !password || !ntema) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    password = createHash(password);

    try {
        const query = `
            UPDATE studenti
            SET ntema = $1
            WHERE chiave = $2 AND email = $3 AND password = $4
        `;
        const params = [ntema, key, email, password];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}


