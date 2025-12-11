const crypto = require('crypto');
require('dotenv').config();
const SECRET_KEY = process.env.GOOGLE_AUTH_CODE

function base32Decode(base32) {
    // Base32 uses A to Z and 2-7
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    // uppercase and remove padding '='
    base32 = base32.toUpperCase().replace(/=+$/, '');
    let bits = 0, value = 0, output = [];
    
    // convert Base32 characters into bytes
    for (let i = 0; i < base32.length; i++) {
        value = (value << 5) | alphabet.indexOf(base32[i]); // Shift in 5 bits
        bits += 5;
        // when there is 8 or more bits, extract 1 byte
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

// Generate a 6 digit google auth code using TOTP
function getGoogleAuthCode() {
    // Decode Base32 secret into original bytes
    const key = base32Decode(SECRET_KEY);

    // Compute 30-second time counter
    const counter = Math.floor(Date.now() / 30000);
    const buffer = Buffer.alloc(8);
    // Convert counter into an 8 byte buffer
    buffer.writeBigUInt64BE(BigInt(counter));
    
    // Create HMAC-SHA1 hash using secret key + counter
    const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    // Extract 4 bytes starting from offset and convert to a 31-bit integer
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % 1000000;
    
    // Step 6: Calculate how many seconds remain before next refresh
    const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    
    // Return code as 6-digits (e.g. "004281")
    return {
        code: code.toString().padStart(6, '0'),
        secondsRemaining: secondsRemaining
    };
}

module.exports = { getGoogleAuthCode };