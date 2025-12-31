const crypto = require('crypto');
require('dotenv').config();

/**
 * Decode a Base32 string into a Buffer
 */
function base32Decode(base32) {
    if (!base32 || typeof base32 !== 'string') {
        throw new Error(
            'Invalid Base32 secret passed to getGoogleAuthCode()'
        );
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    base32 = base32.toUpperCase().replace(/=+$/, '');

    let bits = 0;
    let value = 0;
    const output = [];

    for (let i = 0; i < base32.length; i++) {
        const idx = alphabet.indexOf(base32[i]);
        if (idx === -1) {
            throw new Error(`Invalid Base32 character: ${base32[i]}`);
        }

        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(output);
}

/**
 * Generate a 6-digit Google Authenticator TOTP
 * Usage:
 *   getGoogleAuthCode(process.env.GOOGLE_AUTH_CODE)
 *   getGoogleAuthCode(process.env.GOOGLE_AUTH_CODE_2)
 */
function getGoogleAuthCode(secret) {
    if (!secret) {
        throw new Error(
            'TOTP secret is missing. Call getGoogleAuthCode(secret)'
        );
    }

    const key = base32Decode(secret);

    const counter = Math.floor(Date.now() / 30000);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto
        .createHmac('sha1', key)
        .update(buffer)
        .digest();

    const offset = hmac[hmac.length - 1] & 0x0f;

    const code =
        (((hmac[offset] & 0x7f) << 24) |
         ((hmac[offset + 1] & 0xff) << 16) |
         ((hmac[offset + 2] & 0xff) << 8) |
         (hmac[offset + 3] & 0xff)) % 1000000;

    const secondsRemaining =
        30 - (Math.floor(Date.now() / 1000) % 30);

    return {
        code: code.toString().padStart(6, '0'),
        secondsRemaining
    };
}

module.exports = { getGoogleAuthCode };
