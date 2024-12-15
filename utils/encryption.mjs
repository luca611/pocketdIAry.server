// module: encryption
// Description: This module contains utility functions for encrypting and decrypting messages.
// Dependencies: crypto
// Last Modified: 2024-12-15

import crypto from "crypto";

/**
 * Generates a random 32-byte key and returns it as a hexadecimal string.
 *
 * @returns {string} A 64-character hexadecimal string representing the generated key.
 */
export function generateKey() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Encrypts a message using AES-256-CBC algorithm.
 *
 * @param {string} key - The encryption key in hexadecimal format.
 * @param {string} message - The message to be encrypted.
 * @returns {string} The encrypted message in hexadecimal format.
 */
export function encryptMessage(key, message) {
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let encrypted = cipher.update(message, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

/**
 * Decrypts an encrypted message using AES-256-CBC algorithm.
 *
 * @param {string} key - The encryption key in hexadecimal format.
 * @param {string} encryptedMessage - The encrypted message in hexadecimal format.
 * @returns {string} The decrypted message in UTF-8 format.
 */
export function decryptMessage(key, encryptedMessage) {
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let decrypted = decipher.update(encryptedMessage, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

/**
 * Creates a SHA-256 hash of the given data.
 *
 * @param {string} data - The data to hash.
 * @returns {string} The resulting hash in hexadecimal format.
 */
export function createHash(data) {
    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
}