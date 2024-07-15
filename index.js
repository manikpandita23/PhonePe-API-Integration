const express = require('express');
const app = express();
const axios = require('axios');
const port = 3000;
const uniqid = require('uniqid');
const sha256 = require('sha256');

axios.defaults.retry = 3; // Number of retry attempts
axios.defaults.retryDelay = 1000; // Retry delay in milliseconds
axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
    const config = err.config;
    // If config does not exist or the retry option is not set, reject
    if (!config || !config.retry) return Promise.reject(err);

    // Set the variable for keeping track of the retry count
    config.__retryCount = config.__retryCount || 0;

    // Check if we've maxed out the total number of retries
    if (config.__retryCount >= config.retry) {
        // Reject with the error
        return Promise.reject(err);
    }

    // Increment the retry count
    config.__retryCount += 1;

    // Create new promise to handle exponential backoff
    const backoff = new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, config.retryDelay || 1);
    });

    // Return the promise in which recalls axios to retry the request
    return backoff.then(function () {
        return axios(config);
    });
});

// Testing credentials provided by PhonePe (refer to PhonePe API docs in the browser)
const PHONE_PE_HOST_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const MERCHANT_ID = 'PGTESTPAYUAT';
const SALT_INDEX = 1;
const SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';

app.get('/', (req, res) => {
    res.send('Phonepe app is working');
});

app.get('/pay', (req, res) => {
    const payEndpoint = '/pg/v1/pay';
    const merchantTransactionId = uniqid();
    const userId = 123;

    const redirectUrl = `https://localhost:3000/redirect-url/${merchantTransactionId}`;

    const payload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: userId,
        amount: 10000,
        redirectUrl: redirectUrl,
        redirectMode: 'REDIRECT',
        mobileNumber: '9999999999',
        paymentInstrument: {
            type: 'PAY_PAGE',
        },
    };
    const bufferObj = Buffer.from(JSON.stringify(payload), 'utf8');
    const base64EncodePayload = bufferObj.toString('base64');
    const xVerify = sha256(base64EncodePayload + payEndpoint + SALT_KEY) + '###' + SALT_INDEX;

    const options = {
        method: 'post',
        url: `${PHONE_PE_HOST_URL}${payEndpoint}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
        },
        data: {
            request: base64EncodePayload,
        },
    };

    axios
        .request(options)
        .then(function (response) {
            console.log(response.data);
            const url = response.data.data.instrumentResponse.redirectInfo.url;
            res.redirect(url);
        })
        .catch(function (error) {
            console.error(error);
            res.status(error.response ? error.response.status : 500).send(error.message);
        });
});

app.get('/redirect-url/:merchantTransactionId', (req, res) => {
    const { merchantTransactionId } = req.params;
    console.log('merchantTransactionId', merchantTransactionId);
    if (merchantTransactionId) {
        const statusEndpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
        const xVerify = sha256(statusEndpoint + SALT_KEY) + '###' + SALT_INDEX;
        const options = {
            method: 'get',
            url: `${PHONE_PE_HOST_URL}${statusEndpoint}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': xVerify,
            },
        };
        axios
            .request(options)
            .then(function (response) {
                console.log(response.data);
                res.send(response.data);
            })
            .catch(function (error) {
                console.error(error);
                res.status(error.response ? error.response.status : 500).send(error.message);
            });
    } else {
        res.status(400).send({ error: 'Invalid merchantTransactionId' });
    }
});

app.listen(port, () => {
    console.log(`App started listening on port ${port}`);
});
