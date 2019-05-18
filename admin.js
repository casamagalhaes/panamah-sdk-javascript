const AdminClient = require('./lib/admin-client');
const { InitError, AdminError, NotFoundError, ConflictError } = require('./lib/exceptions');

class PanamahAdmin {
    init(authorizationToken) {
        const credentials = {
            authorizationToken: process.env.PANAMAH_AUTHORIZATION_TOKEN || authorizationToken
        };
        if (!credentials.authorizationToken)
            throw new InitError('Authorization token é obrigatório.');
        this._client = new AdminClient(credentials);
    }

    async createAssinante(assinante) {
        const { status, data } = await this._client.post('/admin/assinantes', assinante);
        switch (status) {
            case 201: return data;
            case 409: throw new ConflictError('Assinante já existe.');
            default:
                throw new AdminError(`Erro ${status} ao criar assinante.`);
        }
    }

    async getAssinante(id) {
        const { status, data } = await this._client.get(`/admin/assinantes/${id}`);
        switch (status) {
            case 200: return data;
            case 404: throw new NotFoundError('Assinante não existe.');
            default:
                throw new AdminError(`Erro ${status} ao tentar buscar um assinante.`);
        }
    }

    async deleteAssinante(id) {
        const { status } = await this._client.delete(`/admin/assinantes/${id}`);
        switch (status) {
            case 200: return true;
            case 404: throw new NotFoundError('Assinante não existe.');
            default:
                throw new AdminError(`Erro ${status} ao deletar assinante.`);
        }
    }
}

const admin = new PanamahAdmin();

module.exports = admin;
