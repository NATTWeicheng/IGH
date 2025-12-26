const express = require("express");
const router = express.Router();
const {getPage, cleanup, launchAndGoto, errorResponse, successResponse, getBrowser } = require('../workflows/portnet.js')
const {getGoogleAuthCode} = require('../googleAuthToken.js')
const path = require('path');
const fs = require('fs');



// kill chronium
router.post('/stop-chromium', async (req, res) => {
  try {
    const browser = getBrowser();
    if (browser) {
      await browser.close();
      res.status(200).json(successResponse('stop-chromium', { message: 'Browser closed successfully' }));
    } else {
      res.status(200).json(successResponse('stop-chromium', { message: 'No browser instance running' }));
    }
  } catch (error) {
    res.status(200).json(errorResponse('stop-chromium', error));
  }
}); 

// go to page
router.post("/fill-login-details", async (req, res) => {
    try {
        const result = await launchAndGoto(process.env.PORTNET_WEBSITE);
        
        const page = getPage();
        
        // Check timing BEFORE starting login
        let authResult = getGoogleAuthCode();
        console.log(`Pre-login timing check: ${authResult.code}, ${authResult.secondsRemaining}s remaining`);
        
        // If less than 15 seconds, wait for fresh code
        if (authResult.secondsRemaining < 15) {
            const waitTime = (authResult.secondsRemaining + 2) * 1000;
            await page.waitForTimeout(waitTime);
            authResult = getGoogleAuthCode();
        }
        
        // Fill username
        await page.waitForSelector('#mat-input-0', { state: 'visible', timeout: 10000 });
        await page.locator('#mat-input-0').fill(process.env.PORTNET_USER);
        
        // Fill password
        await page.waitForSelector('#mat-input-1', { state: 'visible', timeout: 10000 });
        await page.locator('#mat-input-1').fill(process.env.PORTNET_PASSWORD);

        // Click login
        await page.locator('body > app-root > app-login-page > div > mat-sidenav-container > mat-sidenav-content > div.login-form > form > div:nth-child(3) > button').click();
        
        // Wait for 2FA page
        await page.waitForSelector('#PASSWORD', { state: 'visible', timeout: 10000 });
        console.log('2FA page loaded');
        
        // Get current code (should still have plenty of time)
        authResult = getGoogleAuthCode();
        console.log(`At 2FA page: ${authResult.code}, ${authResult.secondsRemaining}s remaining`);
        
        // Clear field first
        await page.locator('#PASSWORD').clear();
        await page.waitForTimeout(300);
        
        // Click to focus
        await page.locator('#PASSWORD').click();
        await page.waitForTimeout(200);
        
        // Fill the code
        await page.locator('#PASSWORD').fill(authResult.code);
        
        // Verify it was actually filled
        const filledValue = await page.locator('#PASSWORD').inputValue();
        console.log(`Verification - Expected: "${authResult.code}", Actual: "${filledValue}"`);
        
        if (filledValue !== authResult.code) {
            console.warn('Fill failed, retrying...');
            
            // Retry once
            await page.locator('#PASSWORD').clear();
            await page.waitForTimeout(300);
            await page.locator('#PASSWORD').click();
            await page.waitForTimeout(200);
            
            // Type password
            await page.locator('#PASSWORD').type(authResult.code, { delay: 50 });
            
            const retryValue = await page.locator('#PASSWORD').inputValue();
            console.log(`Retry verification: "${retryValue}"`);
            
            if (retryValue !== authResult.code) {
                throw new Error(`Failed to fill 2FA code. Expected: ${authResult.code}, Got: ${retryValue}`);
            }
        }
        
        // Click continue
        await page.locator('#Continue').click();
        
        // Wait a bit for processing
        await page.waitForTimeout(3000);
        
        // Check current state
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);
        
        // Check for error messages first
        const errorCount = await page.locator('text=/invalid|incorrect|wrong|error/i').count();
        if (errorCount > 0) {
            const errorText = await page.locator('text=/invalid|incorrect|wrong|error/i').first().textContent();
            throw new Error(`2FA Error: ${errorText}`);
        }

        return res.status(200).json(successResponse('fill-login-details', {
            message: 'Login and 2FA completed successfully'
        }));

    } catch (err) {
        console.error('Login error:', err);
        return res.status(200).json(errorResponse('fill-login-details', err));
    }
});