const express = require("express");
const { launchAndGoto } = require("../workflows/portnet");
const router = express.Router();
const {getPage} = require('../workflows/portnet')
const {getGoogleAuthCode} = require('../googleAuthToken')

// go to page
router.post("/fill-login-details", async (req, res) => {
    try {
        const result = await launchAndGoto(process.env.PORTNET_WEBSITE);

        page = getPage();
        // fill in username and password
        await page.locator('#mat-input-0').fill(process.env.PORTNET_USER)
        await page.locator('#mat-input-1').fill(process.env.PORTNET_PASSWORD)

        // click login
        await page.locator('body > app-root > app-login-page > div > mat-sidenav-container > mat-sidenav-content > div.login-form > form > div:nth-child(3) > button').click();
        
        // fill in 2fa (google authentication)
        let googleAuthCode = getGoogleAuthCode();
        await page.locator('#PASSWORD').focus();
        await page.locator('#PASSWORD').fill(googleAuthCode);
        // click continue
        await page.locator('#Continue').click();

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
