require('dotenv').config();
const express = require('express')
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dailyJobRoute = require('./api/dailyJobRoute')
app.use('/dailyJob', dailyJobRoute)

const dailyInvoiceRoute = require('./api/dailyInvoiceRoute')
app.use('/dailyInvoice', dailyInvoiceRoute)

const LDNSIRroute = require('./api/LDNSIRroute')
app.use('/LDNSIR', LDNSIRroute)

const SGIVesselETA = require('./api/SGIVesselETA')
app.use('/SGIVesselETA', SGIVesselETA)

app.get('/', (req, res) => {
    res.send("This is the API server.")
})

app.listen(PORT, () => {
    console.log(`SERVER listening on port ${PORT}`)
})