require('dotenv').config();
const express = require('express')
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const portnetRoute = require('./api/portnetRoute')
app.use('/portnet', portnetRoute)

app.get('/', (req, res) => {
    res.send("This is the API server.")
})

app.listen(PORT, () => {
    console.log(`SERVER listening on port ${PORT}`)
})