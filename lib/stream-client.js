const HttpClient = require('./http-client');
const { RefreshTokenError, AuthError } = require('./exceptions');
const moment = require('moment');
const { sha1Base64 } = require('./util');

class StreamClient extends HttpClient {
    constructor(credentials) {
        super();
        this._credentials = credentials;
        this._tokens = null;
    }

    async _makeAuthenticatedRequest(method, url, data, headers) {
        const request = {
            url,
            method,
            headers: Object.assign({}, headers, { Authorization: this._tokens.accessToken }),
            data
        };
        let response = await this._client.request(request);
        if (response.status === 403) {
            this._tokens = await this._refreshTokens();
            response = await this._client.request(request);
        }
        return response;
    }

    async _makeRequest(method, url, data, headers) {
        if (!this._tokens)
            this._tokens = await this._authenticate();
        return await this._makeAuthenticatedRequest(method, url, data, headers);
    }

    async _refreshTokens() {
        const { status, data } = await this._client.get(
            '/stream/auth/refresh',
            {
                headers: {
                    Authorization: this._tokens.refreshToken
                }
            }
        );
        if (status === 200) return data;
        else throw new RefreshTokenError(`Erro ao renovar o token do stream. (Status: ${status} | Response: ${data instanceof Object ? JSON.stringify(data) : data})`);
    }

    _calculateKey(secret, assinanteId, ts) {
        return sha1Base64(secret + assinanteId + ts);
    }

    async _authenticate() {
        const ts = moment.utc().unix();
        const body = {
            assinanteId: this._credentials.assinanteId,
            key: this._calculateKey(
                this._credentials.secret,
                this._credentials.assinanteId,
                ts
            ),
            ts
        };
        const { status, data } = await this._client.post(
            '/stream/auth',
            body,
            {
                headers: {
                    Authorization: this._credentials.authorizationToken
                }
            }
        );
        switch (status) {
            case 200: return data;
            case 401, 403: throw new AuthError('Credenciais inválidas.');
            default: throw new AuthError(data instanceof Object ? JSON.stringify(data) : data);
        }
    }
}

module.exports = StreamClient;