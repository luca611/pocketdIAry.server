// module: response
// Description: This module contains functions for sending responses to the client.
// Last Modified: 2024-12-15

import { SUCCESS } from "./constants.mjs";

/**
 * Sends an error response with the specified status code and message.
 *
 * @param {Object} res - The response object.
 * @param {number} statusCode - The HTTP status code to send.
 * @param {string} message - The error message to send.
 */
export const sendErrorResponse = (res, statusCode, message) =>
    res.status(statusCode).json({ error: message });

/**
 * Sends a success response with the given status code and data.
 *
 * @param {Object} res - The response object.
 * @param {Object} data - The data to include in the response.
 */
export const sendSuccessResponse = (res, data) =>
    res.status(SUCCESS).json(data);
