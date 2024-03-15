const express = require('express')
const app = express();
const axios = require('axios');
const port = 3000
const uniqid = require('uniqid');
const sha256 = require("sha256");

//TESTING  
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const MERCHANT_ID = 'PGTESTPAYUAT';
const SALT_INDEX = 1;
const SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
app.get('/', (req, res) => {
    res.send('Phonepe app is working')
})


app.get("/pay", (req, res) => {
    const payEndpoint = "/pg/v1/pay";
    const merchantTransactionId = uniqid();
    const userId = 123;

    const redirectUrl = `https://localhost:3000/redirect-url/${merchantTransactionId}`;

    const payload = {
        "merchantId": MERCHANT_ID,
        "merchantTransactionId": "MT7850590068188104",
        "merchantUserId": userId,
        "amount": 10000,
        "redirectUrl": redirectUrl,
        "redirectMode": "REDIRECT",
        "mobileNumber": "9999999999",
        "paymentInstrument": {
            "type": "PAY_PAGE"
        }
    }
    // SHA256(base64 encoded payload + “/pg/v1/pay” +salt key) + ### + salt index
    const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
    const base64EncodePayload = bufferObj.toString("base64");
    const xVerify = sha256(base64EncodePayload + payEndpoint + SALT_KEY) + "###" + SALT_INDEX

    const options = {
        method: 'post',
        url: `${PHONE_PE_HOST_URL}${payEndpoint}`,
        headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "X-VERIFY": xVerify
        },
        data: {
            request: base64EncodePayload
        }
    };

    axios
        .request(options)
        .then(function (response) {
            console.log(response.data);
            const url = response.data.data.instrumentResponse.redirectInfo.url;
            res.redirect(url)
            //res.send({ url })
        })
        .catch(function (error) {
            console.error(error);
        });
});
app.get("/redirect-url/:merchantTransactionId", (req, res) => {
    const { merchantTransactionId } = req.params;
    console.log('merchantTransactionId', merchantTransactionId)
    if (merchantTransactionId) {
        //SHA256(“/pg/v1/status/{merchantId}/{merchantTransactionId}” + saltKey) + “###” + saltIndex
        const xVerify = sha256(`/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + SALT_KEY) + "###" + SALT_INDEX;
        const options = {
            method: 'get',
            url: `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                "Content-Type": "application/json",
                "X-MERCHANT-ID": merchantTransactionId,
                "X-VERIFY": xVerify
            },

        };
        axios
            .request(options)
            .then(function (response) {
                console.log(response.data);
                res.send(response.data)
            })
            .catch(function (error) {
                console.error(error);
            });
    } else {
        res.send({ error: 'Error' })
    }
});
app.listen(port, () => {
    console.log(`App started listening on port ${port}`)
})