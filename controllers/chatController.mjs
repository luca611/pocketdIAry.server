// module: chatController
// Description: This module contains functions for handling chat requests.
// Dependencies: utils/aiAPI, utils/response
// Last Modified: 2024-12-15

import { getAiResponse } from "../utils/aiAPI.mjs";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.mjs";

/**
 * Handles chat requests by processing the message and returning an AI response.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.message - The message to be processed.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the response is sent.
 */
export async function handleChat(req, res) {
    const { message } = req.body;
    if (!message) {
        return sendErrorResponse(res, 400, "Message not provided");
    }

    try {
        const response = await getAiResponse(message);
        return sendSuccessResponse(res, { response });
    } catch (err) {
        return sendErrorResponse(res, 500, err.message);
    }
}