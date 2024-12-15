import { encryptMessage, decryptMessage } from "../utils/encryption.mjs";
import client from "../db/dbClient.mjs";
import { ERROR, INTERNALERR } from "../utils/constants.mjs";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.mjs";

/**
 * Adds a new note to the database.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The encryption key.
 * @param {string} req.body.title - The title of the note.
 * @param {string} req.body.description - The description of the note.
 * @param {string} req.body.date - The date of the note.
 * @param {string} req.body.email - The email of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the note is added.
 */
export async function addNote(req, res) {
    let { key, title, description, date, email } = req.body;

    if (title.length > 128) {
        return sendErrorResponse(res, ERROR, "title is too long")
    }
    if (!key || !title || !description || !date || !email) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    const currentDate = new Date();
    const noteDate = new Date(date);

    currentDate.setHours(0, 0, 0, 0);
    noteDate.setHours(0, 0, 0, 0);

    if (isNaN(noteDate.getTime()) || noteDate < currentDate || noteDate.getFullYear() > currentDate.getFullYear() + 10) {
        return sendErrorResponse(res, ERROR, "Date must be from today and within a reasonable future range.");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);
    title = encryptMessage(key, title);
    description = encryptMessage(key, description);

    try {
        let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
        let params = [key, email];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendErrorResponse(res, ERROR, "user not found");
        }

        query = `
            INSERT INTO note (dataora, titolo, testo, idStudente)
            VALUES ($1, $2, $3, $4)
        `;
        params = [date, title, description, email];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Retrieves notes in a specific date for a specific student based on the provided key, email, and date.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The key to identify the student.
 * @param {string} req.body.email - The email of the student.
 * @param {string} req.body.date - The date for which to retrieve notes.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - Sends a response with the notes or an error message.
 */
export async function getNotes(req, res) {
    let { key, email, date } = req.body;
    if (!key || !email || !date) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);

    try {
        let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
        let params = [key, email];
        let result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendErrorResponse(res, ERROR, "user not found");
        }

        query = `
            SELECT * from note WHERE idStudente = $1 AND dataora = $2 
        `;
        params = [email, date];
        result = await client.query(query, params);

        const notes = result.rows.map((note) => {
            return {
                title: decryptMessage(key, note.titolo),
                description: decryptMessage(key, note.testo),
                dataora: note.dataora,
            };
        });

        return sendSuccessResponse(res, { notes });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}

/**
 * Fetches the notes for the current day for a specific user.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The key of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function getTodayNotes(req, res) {
    let { key, email } = req.body;
    if (!key || !email) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);

    try {
        // Check if the user exists in the database
        let query = "SELECT * FROM studenti WHERE chiave = $1 AND email = $2";
        let params = [key, email];
        let result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendErrorResponse(res, ERROR, "User not found");
        }

        // Fetch the notes for the current day
        query = "SELECT * FROM note WHERE idStudente = $1 AND dataora = CURRENT_DATE";
        params = [email];
        result = await client.query(query, params);

        const notes = result.rows.map((note) => {
            return {
                id: note.id,
                title: decryptMessage(key, note.titolo),
                description: decryptMessage(key, note.testo),
                dataora: note.dataora,
            };
        });

        // If no notes, return an empty array
        return sendSuccessResponse(res, { notes: notes.length > 0 ? notes : [] });
    } catch (err) {
        console.error("Error during fetch:", err.message);
        return sendErrorResponse(res, INTERNALERR, "An error occurred on the server.");
    }
}

/**
 * Deletes a note from the database based on the provided note ID.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.key - The key to identify the student.
 * @param {string} req.body.email - The email of the student.
 * @param {number} req.body.id - The ID of the note to delete.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the note is deleted.
 */
export async function deleteNote(req, res) {
    let { key, email, id } = req.body;
    if (!key || !email || !id) {
        return sendErrorResponse(res, ERROR, "Invalid inputs");
    }

    email = encryptMessage(process.env.ENCRYPT_KEY, email);

    try {
        let query = `
            SELECT * from studenti WHERE chiave = $1 and email = $2
        `;
        let params = [key, email];
        const result = await client.query(query, params);

        if (result.rows.length === 0) {
            return sendErrorResponse(res, ERROR, "user not found");
        }

        query = `
            DELETE FROM note WHERE id = $1 AND idStudente = $2
        `;
        params = [id, email];
        await client.query(query, params);

        return sendSuccessResponse(res, { message: "OK" });
    } catch (err) {
        return sendErrorResponse(res, INTERNALERR, err.message);
    }
}