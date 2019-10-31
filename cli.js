#!/usr/bin/env node
require('yargs') // eslint-disable-line
    .command('auth [authorizationToken] [secret] [assinanteId]', 'authenticate', (yargs) => {
        yargs
            .positional('authorizationToken', {
                describe: 'authorization token',
                default: process.env.AUTHORIZATION_TOKEN
            })
            .positional('secret', {
                describe: 'secret',
                default: process.env.SECRET
            })
            .positional('assinanteId', {
                describe: 'assinante id',
                default: '*'
            })
    }, (argv) => {
        return authenticate(argv.authorizationToken, argv.secret, argv.assinanteId);
    })
    .command('auth-payload [authorizationToken] [secret] [assinanteId]', 'generate a payload needed for authentication', (yargs) => {
        yargs
            .positional('authorizationToken', {
                describe: 'authorization token',
                default: process.env.AUTHORIZATION_TOKEN
            })
            .positional('secret', {
                describe: 'secret',
                default: process.env.SECRET
            })
            .positional('assinanteId', {
                describe: 'assinante id',
                default: '*'
            })
    }, (argv) => {
        return generateAuthPayload(argv.authorizationToken, argv.secret, argv.assinanteId);
    })
    .argv


function generateAuthPayload (authorizationToken, secret, assinanteId) {
    const StreamClient = require('./lib/stream-client');
    const client = new StreamClient({
        authorizationToken,
        secret,
        assinanteId
    });
    try {
        const object = client._getAuthenticationBody();
        console.log('PAYLOAD');
        console.log('----------------------------------');
        console.log(JSON.stringify(object));
        console.log('----------------------------------');
    } catch (e) {
        console.log(e);
    }
}

async function authenticate (authorizationToken, secret, assinanteId) {
    const StreamClient = require('./lib/stream-client');
    const client = new StreamClient({
        authorizationToken,
        secret,
        assinanteId
    });
    try {
        const { accessToken, refreshToken } = await client._authenticate();
        console.log('');
        console.log('Access Token');
        console.log('----------------------------------');
        console.log(accessToken);
        console.log('----------------------------------');
        console.log('');
        console.log('Refresh Token');
        console.log('----------------------------------');
        console.log(refreshToken);
        console.log('----------------------------------');
    } catch (e) {
        console.log(e);
    }
}

