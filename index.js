require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const uniqid = require('uniqid');
const sha256 = require('sha256');
const morgan = require('morgan');

const app = express();
const port = 3000;

if (!process.env.MERCHANT_ID || !process.env.SALT_INDEX || !process.env.SALT_KEY) {
    console.error('Missing required environment variables.');
    process.exit(1);
}


const PHONE_PE_HOST_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const MERCHANT_ID = process.env.MERCHANT_ID;
const SALT_INDEX = process.env.SALT_INDEX;
const SALT_KEY = process.env.SALT_KEY;

axios.defaults.retry = 3; 
axios.defaults.retryDelay = 1000; 
axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
    const config = err.config;
    if (!config || !config.retry) return Promise.reject(err);

    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) {
        return Promise.reject(err);
    }

    config.__retryCount += 1;

    const backoff = new Promise((resolve) => {
        setTimeout(resolve, config.retryDelay || 1);
    });

    return backoff.then(() => axios(config));
});

app.use(morgan('dev')); 

const createXVerifyHeader = (payload, endpoint) => {
    const bufferObj = Buffer.from(JSON.stringify(payload), 'utf8');
    const base64EncodePayload = bufferObj.toString('base64');
    return sha256(base64EncodePayload + endpoint + SALT_KEY) + '###' + SALT_INDEX;
};

const createPaymentPayload = (merchantTransactionId, userId, amount, mobileNumber) => {
    return {
        merchantId: MERCHANT_ID,
        merchantTransactionId,
        merchantUserId: userId,
        amount,
        redirectUrl: `https://localhost:3000/redirect-url/${merchantTransactionId}`,
        redirectMode: 'REDIRECT',
        mobileNumber,
        paymentInstrument: {
            type: 'PAY_PAGE',
        },
    };
};


app.get('/', (req, res) => {
    res.send('Phonepe app is working');
});

app.get('/pay', (req, res) => {
    const { amount, mobileNumber } = req.query;

    if (!amount || !mobileNumber) {
        return res.status(400).send({ error: 'Amount and mobileNumber are required' });
    }

    const payEndpoint = '/pg/v1/pay';
    const merchantTransactionId = uniqid();
    const userId = 123;
    const payload = createPaymentPayload(merchantTransactionId, userId, amount, mobileNumber);
    const xVerify = createXVerifyHeader(payload, payEndpoint);

    const options = {
        method: 'post',
        url: `${PHONE_PE_HOST_URL}${payEndpoint}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
        },
        data: {
            request: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
        },
    };

    axios.request(options)
        .then((response) => {
            console.log(response.data);
            const url = response.data.data.instrumentResponse.redirectInfo.url;
            res.redirect(url);
        })
        .catch((error) => {
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
        axios.request(options)
            .then((response) => {
                console.log(response.data);
                res.send(response.data);
            })
            .catch((error) => {
                console.error(error);
                res.status(error.response ? error.response.status : 500).send(error.message);
            });
    } else {
        res.status(400).send({ error: 'Invalid merchantTransactionId' });
    }
});


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`App started listening on port ${port}`);
});
