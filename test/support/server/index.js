const crypto = require('crypto');
const http = require('http');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
const path = require('path');
const privateKey = fs.readFileSync(path.join(__dirname, '/sslcert/server.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, '/sslcert/server.crt'), 'utf8');
const credentials = { key: privateKey, cert: certificate };
const express = require('express');
const app = express();
let buffer = [];
let config = {
    streamFailing: false,
    tokenExpired: false,
    tokens: {}
}

app.use(bodyParser.json());

app.all('/echo', function (req, res) {
    res = res.status(200);    
    res.json({
        method: req.method,
        headers: req.headers,
        body: req.body
    });
});

app.post('/stream/data', function (req, res) {
    if (config.tokenExpired)
        return res.status(403).send();
    const r = {
        action: 'DATA',
        method: req.method,
        headers: req.headers,
        body: req.body
    };    
    buffer.push(r);
    if (config.streamFailing) {
        res.status(200).json({ "falhas": { "total": req.body.length, "itens": req.body.map(obj => ({ tipo: obj.tipo, op: obj.op.toLowerCase(), id: obj.data.id })) } });
    } else {
        res.status(200).json({ "sucessos": { "total": req.body.length, "itens": req.body.map(obj => ({ tipo: obj.tipo, op: obj.op.toLowerCase(), id: obj.data.id })) } });
    }
});

app.all('/stream/start-failing', function (req, res) {
    config.streamFailing = true;
    res.status(200).send();
});

app.all('/stream/expire-access-token', function (req, res) {
    config.tokenExpired = true;
    res.status(200).send();
});

app.all('/stream/stop-failing', function (req, res) {
    config.streamFailing = false;
    res.status(200).send();
});

app.all('/buffer', function (req, res) {
    res.status(200).json(buffer);
});

app.all('/flush', function (req, res) {
    fs.writeFileSync(path.join(__dirname, '/output.json'), JSON.stringify(buffer.filter(d => !!d.body).map(d => d.body)));
    buffer = [];
    res.status(200).send();
});

const generateNewTokens = () => {
    const tokens = {
        accessToken: Buffer.from(crypto.randomBytes(64).toString('hex')).toString('base64'),
        refreshToken: Buffer.from(crypto.randomBytes(64).toString('hex')).toString('base64')
    };    
    config.tokens = tokens;
    return tokens;
}

app.post('/stream/auth', (req, res) => {
    const r = {
        action: 'STREAM_LOGIN',
        method: req.method,
        headers: req.headers,
        body: req.body
    };    
    buffer.push(r);
    res.json(generateNewTokens());
});

app.get('/stream/auth/refresh', (req, res) => {
    const r = {
        action: 'STREAM_REFRESH_TOKEN',
        method: req.method,
        headers: req.headers,
        body: req.body
    };    
    buffer.push(r);
    if (config.tokenExpired) {
        if (req.headers.authorization === config.tokens.refreshToken) {
            config.tokenExpired = false;
            res.json(generateNewTokens());
        }
        else
            res.status(401).send();
    } else {
        res.json(generateNewTokens());
    }
});

app.get('/admin/assinantes/:id', (req, res) => {
    const r = {
        action: 'GET_ADMIN',
        method: req.method,
        headers: req.headers,
        body: req.body
    };    
    buffer.push(r);
    if (req.params.id === '94912067024')
        res.json({
            "id": "94912067024",
            "razaoSocial": "ASSINANTE TESTE",
            "fantasia": "ASSINANTE TESTE",
            "bairro": "PAPICU",
            "cidade": "FORTALEZA",
            "ramo": "-----------",
            "uf": "CE",
            "chave": "123456",
            "dataAtivacao": "2018-03-27T17:12:59.000Z",
            "emissorPanama": "VAREJOFACIL",
            "funcionarioAtivador": "000001",
            "cmRevendaId": "000818",
            "ativo": true,
            "container": "sslt",
            "softwaresAtivos": [
                "MILENIO"
            ],
            "softwaresEmContratosDeManutencao": [
                "MILENIO"
            ]
        });
    else
        res.status(404).send();
});

app.post('/admin/assinantes', (req, res) => {
    let r = {
        action: 'CREATE_ADMIN',
        method: req.method,
        headers: req.headers,
        body: req.body
    };
    buffer.push(r);
    res
        .status(201)
        .send();
});

let servers = {};

module.exports = {
    buffer,
    config,
    start: () => {
        servers.http = http.createServer(app).listen(7780);
        servers.https = https.createServer(credentials, app).listen(7443);
        console.log("listening on http://0.0.0.0:7780 / https://0.0.0.0:7443");
    },
    stop: () => {
        if (servers.http) servers.http.close();
        if (servers.https) servers.https.close();
    }
}
