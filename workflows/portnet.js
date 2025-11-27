const { chromium } = require('playwright');
let browser = null;
let page = null;

async function launchAndGoto(url) {
    if (browser) {
        return {
            status: 'error',
            message: 'Browser is already running.',
            conflict: true
        };
    }

    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    await page.goto(url);

    const page_url = page.url();
    console.log(`current url: ${page_url}`);

    return {
        status: 'success',
        browser,
        page_url,
    };
}

module.exports = {
    launchAndGoto,
    getPage: () => page
};