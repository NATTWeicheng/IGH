const express = require("express");
const router = express.Router();
const {getPage, getBrowser, launchAndGoto} = require('../workflows/portnet.js')
const {getGoogleAuthCode} = require('../googleAuthToken.js')
const path = require('path');
const fs = require('fs');

// kill chronium
router.post('/stop-chromium', async (req, res) => {
  try {
    const browser = getBrowser(); // Get the browser instance
    if (browser) {
      await browser.close();
      res.json({ success: true, message: 'Browser closed successfully' });
    } else {
      res.json({ success: false, message: 'No browser instance running' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}); 

// go to page
router.post("/fill-login-details", async (req, res) => {
    try {
        const result = await launchAndGoto(process.env.PORTNET_WEBSITE);

        page = getPage();
        // fill in username and password
        await page.waitForTimeout(1000);
        await page.locator('#mat-input-0').fill(process.env.PORTNET_USER)
        await page.waitForTimeout(1000);
        await page.locator('#mat-input-1').fill(process.env.PORTNET_PASSWORD)

        // click login
        await page.waitForTimeout(1000);
        await page.locator('body > app-root > app-login-page > div > mat-sidenav-container > mat-sidenav-content > div.login-form > form > div:nth-child(3) > button').click();
        
        // fill in 2fa (google authentication)
        await page.waitForTimeout(1000);
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

// route to click on others
router.post("/click-others", async (req, res) => {
    try {
        page = getPage();
        let otherSelector = 'body > app-root > div > div.slidebar > div:nth-child(8) > div'
        await page.locator(otherSelector).click()
        res.status(200).send({ status: "success" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// route to click on supplier management
router.post("/click-supplier-management", async (req, res) => {
    try {
        page = getPage();
        let supplierManagamentSelector = 'body > app-root > div > div.main-content > app-container-group > div > div.half-width > div:nth-child(2) > div:nth-child(2) > div > div.lv2-panel > div:nth-child(5) > div.mat-mdc-menu-trigger.subheading.flex-layout'
        await page.locator(supplierManagamentSelector).click()
        res.status(200).send({ status: "success" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// route to click on enquire LD/NSIR invoice under payment advice
router.post("/click-enquire-invoice", async (req, res) => {
    try {
        page = getPage();
        
        // Get the iframe
        const frameElement = await page.waitForSelector('iframe.frame__webview', { 
            state: 'attached', 
            timeout: 10000 
        });
        
        const frame = await frameElement.contentFrame();
        
        if (!frame) {
            throw new Error('Could not access iframe content');
        }
        // Click the link inside the iframe
        await frame.locator('a[href="/SUMS-WLS12/SUMSMainServlet?requestID=initNisrLdInvoiceEnqID"]').click();
        
        res.json({ status: 'success', message: 'Clicked Enquire LD/NSIR Invoice' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// route to select IGH from the dropdown; click accepted and fill date to 1 day ago
router.post("/fill-job-payment-table", async (req, res) => {
    try {
        page = getPage();
        
        const frameElement = await page.waitForSelector('iframe.frame__webview', { 
            state: 'attached', 
            timeout: 10000 
        });
        
        const frame = await frameElement.contentFrame();
        
        if (!frame) {
            throw new Error('Could not access iframe content');
        }
        
        await frame.waitForSelector('select[name="invoiceType"]', { 
            state: 'visible', 
            timeout: 10000 
        });
        
        await frame.waitForTimeout(500);
        
        await frame.selectOption('select[name="invoiceType"]', 'LD');
        await frame.waitForTimeout(500);
        
        // Date logic
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        const day = String(oneWeekAgo.getDate()).padStart(2, '0');
        const month = String(oneWeekAgo.getMonth() + 1).padStart(2, '0');
        const year = String(oneWeekAgo.getFullYear());
        
        await frame.fill('input[name="fDD"]', day);
        await frame.waitForTimeout(200);
        await frame.fill('input[name="fMM"]', month);
        await frame.waitForTimeout(200);
        await frame.fill('input[name="fYYYY"]', year);
        
        await frame.waitForTimeout(500);
        
        await frame.locator('body > form > table > tbody > tr:nth-child(7) > td > input[type=submit]:nth-child(1)').click();
        
        // Wait for the "Details" links to appear
        await frame.waitForSelector('a:has-text("Detail Information")', { 
            state: 'visible', 
            timeout: 10000 
        });
        
        await frame.waitForTimeout(1000);
        
        // Get ONLY the rows with "Details" links (the actual job rows)
        const detailsLinks = await frame.locator('a:has-text("Detail Information")').all();
        
        console.log(`Found ${detailsLinks.length} job items with Details links`);
        
        res.json({ 
            status: 'success', 
            message: 'Search completed',
            itemCount: detailsLinks.length,
            fromDate: `${day}/${month}/${year}`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Click a specific "Details" link by index
router.post("/click-job-item", async (req, res) => {
    try {
        const { index } = req.body; // 0 = first Details, 1 = second, 2 = third
        
        page = getPage();
        
        const frameElement = await page.waitForSelector('iframe.frame__webview', { 
            state: 'attached', 
            timeout: 10000 
        });
        
        const frame = await frameElement.contentFrame();
        
        if (!frame) {
            throw new Error('Could not access iframe content');
        }
        
        // Wait for Details links
        await frame.waitForSelector('a:has-text("Detail Information")', { 
            state: 'visible', 
            timeout: 10000 
        });
        
        // Get all Details links
        const detailsLinks = await frame.locator('a:has-text("Detail Information")').all();
        
        if (index >= detailsLinks.length) {
            throw new Error(`Index ${index} out of range. Only ${detailsLinks.length} Details links available.`);
        }
        
        // Click the specific Details link
        await detailsLinks[index].click();
        
        await frame.waitForTimeout(2000); // Wait for the details page to load
        
        res.json({ 
            status: 'success', 
            message: `Clicked Details link at index ${index}`,
            index: index
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});


// route to download and rename pdf files
router.post("/download-and-rename-pdf", async (req, res) => {
    try {
        const { index } = req.body; // Get index from request (0, 1, 2)
        
        page = getPage();
        
        const frameElement = await page.waitForSelector('iframe.frame__webview', { 
            state: 'attached', 
            timeout: 10000 
        });
        
        const frame = await frameElement.contentFrame();
        
        if (!frame) {
            throw new Error('Could not access iframe content');
        }
        
        await frame.waitForTimeout(500);
        
        // Extract invoice number from the page
        let invoiceNumber = 'unknown';
        try {
            // Try to find the invoice number in the iframe
            const invoiceText = await frame.textContent('body');
            const invoiceMatch = invoiceText.match(/Invoice No\s*:(\w+)/);
            
            if (invoiceMatch) {
                invoiceNumber = invoiceMatch[1].trim();
                console.log(`Found invoice number: ${invoiceNumber}`);
            } else {
                console.warn('Invoice number not found, using index-based name');
                invoiceNumber = `invoice_${index + 1}`;
            }
        } catch (extractErr) {
            console.error('Error extracting invoice number:', extractErr);
            invoiceNumber = `invoice_${index + 1}`;
        }
        
        // Use invoice number as filename
        const newFileName = `${invoiceNumber}.pdf`;
        
        console.log(`Downloading page as PDF and saving as: ${newFileName}`);
        
        // Save to file - define path
        const downloadPath = 'C:\\Intern\\Test IGH';
        const filePath = path.join(downloadPath, newFileName);
        
        // Generate PDF directly from the page
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        
        // go back to the previous page in order to download next file
        if (page && typeof page.isClosed === 'function' && !page.isClosed()) {
            try {
                await page.goBack({ waitUntil: 'load', timeout: 5000 }).catch(() => null);
                await page.waitForTimeout(100);
            } catch (goBackErr) {
                console.warn('goBack failed but continuing:', goBackErr.message);
            }
        } else {
            console.warn('Cannot goBack — page is closed or unavailable');
        }
        
        await frame.waitForTimeout(1000);
        
        res.json({ 
            status: 'success', 
            message: 'Successfully downloaded page as PDF',
            fileName: newFileName,
            filePath: filePath,
            index: index,
            invoiceNumber: invoiceNumber
        });

    } catch (err) {
        console.error('PDF download error:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
module.exports = router;