const axios = require('axios');
const consts = require('./consts');
const https = require('https');

class HttpClient {
    constructor() {
        this._client = axios.create({
            baseURL: consts.PANAMAH_API_URL,
            timeout: 60000,
            validateStatus: false,
            headers: {
                'x-sdk-identity': consts.SDK_IDENTITY
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
    }

    async _makeRequest(method, url, data, headers) {
        const response = await this._client.request({
            url,
            method,
            headers,
            data
        });
        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        }
    }

    async get(url, headers) {
        return await this._makeRequest('get', url, null, headers);
    }

    async post(url, data, headers) {
        return await this._makeRequest('post', url, data, headers);
    }

    async delete(url, data, headers) {
        return await this._makeRequest('delete', url, data, headers);
    }

    async put(url, data, headers) {
        return await this._makeRequest('put', url, data, headers);
    }
}

module.exports = HttpClient;