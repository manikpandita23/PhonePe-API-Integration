const express = require('express')
const app = express()
const port = 3000
//TESTING  
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const MERCHANT_ID = 'PGTESTPAYUAT';
const SALT_INDEX = 1;
const SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
app.get('/', (req, res) => {
    res.send('Phonepe app is working')
})

app.listen(port, () => {
    console.log(`App started listening on port ${port}`)
})