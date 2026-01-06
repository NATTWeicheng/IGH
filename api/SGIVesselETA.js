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
        await launchAndGoto(process.env.PORTNET_WEBSITE);
        const page = getPage();

        // ===== PRE-LOGIN OTP CHECK =====
        let authResult = getGoogleAuthCode(process.env.GOOGLE_AUTH_CODE2);
        console.log(
            `Pre-login timing check: ${authResult.code}, ${authResult.secondsRemaining}s remaining`
        );

        // If OTP is about to expire, wait for a fresh window
        if (authResult.secondsRemaining < 15) {
            const waitTime = (authResult.secondsRemaining + 2) * 1000;
            await page.waitForTimeout(waitTime);
            authResult = getGoogleAuthCode(process.env.GOOGLE_AUTH_CODE2);
        }

        // fill login details
        await page.waitForSelector('#mat-input-0', { state: 'visible', timeout: 10000 });
        await page.locator('#mat-input-0').fill(process.env.PORTNET_USER2);

        await page.waitForSelector('#mat-input-1', { state: 'visible', timeout: 10000 });
        await page.locator('#mat-input-1').fill(process.env.PORTNET_PASSWORD2);

        await page.locator(
            'body > app-root > app-login-page > div > mat-sidenav-container > mat-sidenav-content > div.login-form > form > div:nth-child(3) > button'
        ).click();

        // wait for 2fa 
        await page.waitForSelector('#PASSWORD', { state: 'visible', timeout: 10000 });
        console.log('2FA page loaded');

        // Generate OTP close to submission
        authResult = getGoogleAuthCode(process.env.GOOGLE_AUTH_CODE2);
        console.log(
            `At 2FA page: ${authResult.code}, ${authResult.secondsRemaining}s remaining`
        );

        // ===== ENTER OTP =====
        const otpInput = page.locator('#PASSWORD');

        await otpInput.clear();
        await page.waitForTimeout(300);
        await otpInput.click();
        await page.waitForTimeout(200);
        await otpInput.fill(authResult.code);

        // Verify input
        let filledValue = await otpInput.inputValue();
        console.log(`Verification - Expected: "${authResult.code}", Actual: "${filledValue}"`);

        // Retry once if fill failed
        if (filledValue !== authResult.code) {
            console.warn('OTP fill failed, retrying...');
            await otpInput.clear();
            await page.waitForTimeout(300);
            await otpInput.type(authResult.code, { delay: 50 });

            filledValue = await otpInput.inputValue();
            console.log(`Retry verification: "${filledValue}"`);

            if (filledValue !== authResult.code) {
                throw new Error(
                    `Failed to fill 2FA code. Expected: ${authResult.code}, Got: ${filledValue}`
                );
            }
        }

        // Submit 2FA
        await page.locator('#Continue').click();
        await page.waitForTimeout(3000);

        // ===== POST-LOGIN CHECK =====
        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        const errorCount = await page
            .locator('text=/invalid|incorrect|wrong|error/i')
            .count();

        if (errorCount > 0) {
            const errorText = await page
                .locator('text=/invalid|incorrect|wrong|error/i')
                .first()
                .textContent();
            throw new Error(`2FA Error: ${errorText}`);
        }

        return res.status(200).json(
            successResponse('fill-login-details', {
                message: 'Login and 2FA completed successfully'
            })
        );

    } catch (err) {
        console.error('Login error:', err);
        return res.status(200).json(
            errorResponse('fill-login-details', err)
        );
    }
});

// navigate to berth sail schedule page
router.post('/goto-berth-sail-schedule', async (req, res) => {
    try {
        const page = getPage();

        if (!page) {
            throw new Error('Playwright page not initialized');
        }

        const targetUrl = 'https://www.portnet.com/report/en-US/berthsailsch';

        await page.goto(targetUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Navigated to:', targetUrl);

        return res.status(200).json(
            successResponse('goto-berth-sail-schedule', {
                message: 'Navigation successful',
                url: page.url()
            })
        );

    } catch (err) {
        console.error('Navigation error:', err);
        return res.status(200).json(
            errorResponse('goto-berth-sail-schedule', err)
        );
    }
});

// search vessel and click search button
router.post('/search-vessel', async (req, res) => {
    try {
        const page = getPage();

        if (!page) {
            throw new Error('Playwright page not initialized');
        }

        // Get vessel from request body
        // const vessel = req.body.vessel;
        
        // Hardcoded vessel for testing
        const vessel = "ACX CRYSTAL";

        if (!vessel) {
            throw new Error('Vessel name is required');
        }

        // Wait for and fill the vessel input
        const vesselInput = '#ui-tabpanel-0 > div > div.p-col-3 > pc-auto-complete > p-autocomplete > span > input';
        await page.waitForSelector(vesselInput, { state: 'visible', timeout: 10000 });
        
        await page.locator(vesselInput).clear();
        await page.waitForTimeout(300);
        await page.locator(vesselInput).pressSequentially(vessel, { delay: 30 }); // Type slower with 30ms delay between characters
        await page.waitForTimeout(800); // Wait for autocomplete suggestions
        
        console.log(`Filled vessel: ${vessel}`);

        // Click the search button after 0.3 seconds
        const searchButton = '#ui-tabpanel-0 > div > div.p-col-2 > button > span';
        await page.waitForSelector(searchButton, { state: 'visible', timeout: 10000 });
        await page.waitForTimeout(300); // Wait 0.3 seconds before clicking
        await page.locator(searchButton).click();
        
        console.log('Search button clicked');

        // Wait for results to load
        await page.waitForTimeout(2000);

        return res.status(200).json(
            successResponse('search-vessel', {
                message: 'Vessel search completed successfully',
                vessel: vessel
            })
        );

    } catch (err) {
        console.error('Vessel search error:', err);
        return res.status(200).json(
            errorResponse('search-vessel', err)
        );
    }
});

// filter by voyage number
router.post('/filter-voyage', async (req, res) => {
    try {
        const page = getPage();

        if (!page) {
            throw new Error('Playwright page not initialized');
        }

        // Get voyage number from request body
        const voyageNo = req.body.voyageNo;

        // Hardcoded voyage for testing
        // const voyageNo = "7-014N";

        if (!voyageNo) {
            throw new Error('Voyage number is required');
        }

        // Wait for and fill the voyage number input
        const voyageInput = '#ui-panel-0-content > div > p-table > div > div > table > thead > tr > th:nth-child(3) > input';
        await page.waitForSelector(voyageInput, { state: 'visible', timeout: 10000 });

        await page.locator(voyageInput).clear();
        await page.waitForTimeout(300);
        await page.locator(voyageInput).pressSequentially(voyageNo, { delay: 100 }); // Type slower with 100ms delay

        console.log(`Filled voyage number: ${voyageNo}`);

        // Wait for table to filter
        await page.waitForTimeout(1000);

        // Check if "No record found" is displayed
        const noResultSelector = '#ui-panel-0-content > div > p-table > div > div > table > tbody > tr > td';
        const noResultElement = await page.locator(noResultSelector).first();

        if (await noResultElement.isVisible().catch(() => false)) {
            const text = await noResultElement.textContent();
            if (text && text.includes('No record found')) {
                console.log('No records found for voyage:', voyageNo);
                return res.status(200).json(
                    successResponse('filter-voyage', {
                        message: 'No record found',
                        voyageNo: voyageNo,
                        resultCount: 0
                    })
                );
            }
        }

        // Count the number of result rows (excluding the header row and "No record found" row)
        const resultRowsSelector = '#ui-panel-0-content > div > p-table > div > div > table > tbody > tr';
        const resultRows = await page.locator(resultRowsSelector).all();
        const resultCount = resultRows.length;

        console.log(`Found ${resultCount} result(s) for voyage:`, voyageNo);

        // If more than 1 result, return error
        if (resultCount > 1) {
            return res.status(200).json(
                successResponse('filter-voyage', {
                    message: 'Multiple records found',
                    voyageNo: voyageNo,
                    resultCount: resultCount
                })
            );
        }

        // Exactly 1 result - success
        return res.status(200).json(
            successResponse('filter-voyage', {
                message: 'Voyage filter applied successfully',
                voyageNo: voyageNo,
                resultCount: resultCount
            })
        );

    } catch (err) {
        console.error('Voyage filter error:', err);
        return res.status(200).json(
            errorResponse('filter-voyage', err)
        );
    }
});

// read berth time
router.post('/read-berth-time', async (req, res) => {
    try {
        const page = getPage();

        if (!page) {
            throw new Error('Playwright page not initialized');
        }

        // Selector for berth time
        const berthTimeSelector = '#ui-panel-0-content > div > p-table > div > div > table > tbody > tr > td:nth-child(10)';

        // Wait for the berth time element to be visible
        await page.waitForSelector(berthTimeSelector, { state: 'visible', timeout: 10000 });

        // Get the content of the berth time element
        const berthTimeContent = await page.locator(berthTimeSelector).textContent();

        if (!berthTimeContent) {
            throw new Error('Berth time content not found');
        }

        console.log('Berth Time Content:', berthTimeContent);

        // Separate date and time
        const [date, time] = berthTimeContent.split(' ');

        // Convert date from DD-MM-YYYY to YYYY-MM-DD
        const [day, month, year] = date.split('-');
        const formattedDate = `${year}-${month}-${day}`;

        console.log('Formatted Date:', formattedDate);
        console.log('Time:', time);

        return res.status(200).json(
            successResponse('read-berth-time', {
                message: 'Berth time read successfully',
                date: formattedDate,
                time: time
            })
        );

    } catch (err) {
        console.error('Read berth time error:', err);
        return res.status(200).json(
            errorResponse('read-berth-time', err)
        );
    }
});

module.exports = router;