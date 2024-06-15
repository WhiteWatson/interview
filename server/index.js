require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);

app.get('/api/get-speech-token', async (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    if (speechKey === 'paste-your-speech-key-here' || speechRegion === 'paste-your-speech-region-here') {
        res.status(400).send('You forgot to add your speech key or region to the .env file.');
    } else {
        const headers = { 
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        try {
            const tokenResponse = await axios.post(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, null, headers);
            res.send({ token: tokenResponse.data, region: speechRegion });
        } catch (err) {
            res.status(401).send('There was an error authorizing your speech key.');
        }
    }
});

// app.get('/api/get-speech-token', async (req, res, next) => {
//     res.setHeader('Content-Type', 'application/json');
//     const speechKey = process.env.SPEECH_KEY;
//     const speechRegion = process.env.SPEECH_REGION;

//     if (!speechKey || !speechRegion || speechKey === 'paste-your-speech-key-here' || speechRegion === 'paste-your-speech-region-here') {
//         return res.status(400).send('You forgot to add your speech key or region to the .env file.');
//     }

//     const headers = { 
//         headers: {
//             'Ocp-Apim-Subscription-Key': 'acee3f2b04ce43bdbf831d8a74b7665c' || speechKey,
//             'Content-Type': 'application/x-www-form-urlencoded'
//         }
//     };

//     try {
//         // const tokenResponse = await axios.post(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, '', headers); // Note the empty string as the payload
//         const tokenResponse = await axios.post(`https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken`, '', headers);
//         return res.send({ token: tokenResponse.data, region: speechRegion });
//     } catch (err) {
//         console.error('Error authorizing speech key:', err);  // Enhanced error logging
//         return res.status(401).send(`There was an error authorizing your speech key. ${err.response ? err.response.data : ''}`);
//     }
// });

app.listen(3005, () =>
    console.log('Express server is running on localhost:3005')
);