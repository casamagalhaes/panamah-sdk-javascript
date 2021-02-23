/**
 * @typedef {Object} PanamahAssinante
 * @property {string} modelName
 */
const AdminClient = require('./lib/admin-client');
const { InitError, AdminError, NotFoundError, ConflictError, ValidationError } = require('./lib/exceptions');

/**
 * @class
 * @description API de administração de assinantes do Panamah
 */
class PanamahAdmin {

    /**
     * @function
     * @description Inicia a API de administração de assinantes com o token de autorização
     * @param {Object} opts Opções de inicialização
     * @param {string} [opts.authorizationToken] Token de autorização (Caso não seja passado, o token é lido da variável de ambiente PANAMAH_AUTHORIZATION_TOKEN)
     * @example
     * PanamahStream.init({ authorizationToken: process.env.MY_AUTH_TOKEN });
     */
    init({ authorizationToken } = {}) {
        const credentials = {
            authorizationToken: authorizationToken || process.env.PANAMAH_AUTHORIZATION_TOKEN
        };
        if (!credentials.authorizationToken)
            throw new InitError('Authorization token é obrigatório.');
        this._client = new AdminClient(credentials);
    }

    /**
     * @function
     * @description Cria um assinante
     * @param {PanamahAssinante} assinante Modelo de assinante a ser criado
     * @throws {PanamahConflictError}
     * @example
     * await PanamahAdmin.createAssinante(assinante);
     */
    async createAssinante(assinante) {
        const { status, data } = await this._client.post('/admin/assinantes', assinante);
        switch (status) {
            case 201: return data;
            case 409: throw new ConflictError('Assinante já existe.');
            case 422: throw new ValidationError(JSON.stringify(data));
            default:
                throw new AdminError(`Erro ${status} ao criar assinante.`);
        }
    }

    /**
     * @function
     * @description Altera um assinante
     * @param {PanamahAssinante} assinante Modelo de assinante a ser alterado
     * @throws {ValidationError}
     * @example
     * await PanamahAdmin.updateAssinante(assinante);
     */
    async updateAssinante(assinante) {
        const { status, data } = await this._client.put(`/admin/assinantes/${assinante.id}`, assinante);
        switch (status) {
            case 200: return data;
            case 422: throw new ValidationError(JSON.stringify(data));
            default:
                throw new AdminError(`Erro ${status} ao alterar um assinante.`);
        }
    }

    /**
     * @function
     * @description Busca um assinante pelo id
     * @param {string} id Id do assinante a ser buscado
     * @returns {PanamahAdmin}
     * @throws {PanamahNotFoundError}
     * @example
     * const assinante = await PanamahAdmin.getAssinante('123456789');
     */
    async getAssinante(id) {
        const { status, data } = await this._client.get(`/admin/assinantes/${id}`);
        switch (status) {
            case 200: return data;
            case 404: throw new NotFoundError('Assinante não existe.');
            default:
                throw new AdminError(`Erro ${status} ao tentar buscar um assinante.`);
        }
    }

    /**
     * @function
     * @description Deleta um assinante
     * @param {string} id Id do assinante a ser deletado
     * @throws {PanamahNotFoundError}
     * @example
     * await PanamahAdmin.deleteAssinante('123456789');
     */
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
