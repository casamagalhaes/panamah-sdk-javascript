const HttpClient = require('./http-client');

class AdminClient extends HttpClient {
    constructor(credentials) {
        super();
        this._credentials = credentials;
    }

    async _makeRequest(method, url, data, headers) {
        return await super._makeRequest(method, url, data, Object.assign({ Authorization: this._credentials.authorizationToken }, headers));
    }
}

module.exports = AdminClient;