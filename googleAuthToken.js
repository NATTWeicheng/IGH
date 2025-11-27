require('dotenv').config();
const { totp } = require('otplib');

const secret = process.env.GOOGLE_AUTH_CODE;
// make sure algorithm is lowercase
totp.options = {
  digits: 6,
  step: 30,
  algorithm: 'sha1'
};

function getGoogleAuthCode() {
    return totp.generate(secret)
}

module.exports = {
  getGoogleAuthCode
}