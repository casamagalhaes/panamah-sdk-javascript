/**
 * @typedef {Object} PanamahModel
 * @property {string} modelName
 */
/**
 * @typedef {Object} PendingResources
 * @property {string} assinanteId
 * @property {PanamahModel[]} models
 */
const { ValidationError, InitError } = require('./lib/exceptions');
const processor = require('./lib/processor');
const NFe = require('./lib/nfe');
const EventEmitter = require('events');

/**
 * @class
 * @description API de streaming de dados para o Panamah
 */
class PanamahStream extends EventEmitter {
    constructor() {
        super();
        this._onBatchSent = (batch, status, response) => this.emit('batch_sent', batch, status, response);
        this._onBeforeSave = (model, assinanteId, preventSave) => this.emit('before_save', model, assinanteId, preventSave);
        this._onBeforeDelete = (model, assinanteId, preventDelete) => this.emit('before_delete', model, assinanteId, preventDelete);
        this._onError = error => this.emit('error', error);
    }

    /**
     * @function
     * @private
     */
    _validateCredentials(credentials) {
        if (!credentials.authorizationToken)
            throw new InitError('Authorization token é obrigatório.');
        if (!credentials.secret)
            throw new InitError('Secret é obrigatório.');
        if (!credentials.assinanteId)
            throw new InitError('AssinanteId é obrigatório.');
    }

    /**
     * @function
     * @private
     */
    _acceptableModel(model) {
        return !['ASSINANTE'].includes(model.modelName);
    }

    /**
     * @function
     * @description Inicia a API de streaming com as credenciais
     * @param {Object} opts Opções de inicialização
     * @param {string} [opts.assinanteId] Id do assinante (Obrigatório quando em ambiente single tentant)
     * @param {string} [opts.authorizationToken] Token de autorização (Caso não seja passado, o token é lido da variável de ambiente PANAMAH_AUTHORIZATION_TOKEN)
     * @param {string} [opts.secret] Secret (Caso não seja passado, o token é lido da variável de ambiente PANAMAH_SECRET)
     * @example
     * //Single tenancy
     * PanamahStream.init({ authorizationToken: process.env.MY_AUTH_TOKEN, secret: process.env.MY_SECRET, assinanteId: '123456789' });
     * //Multi tenancy
     * PanamahStream.init({ authorizationToken: process.env.MY_AUTH_TOKEN, secret: process.env.MY_SECRET });
     */
    init({ assinanteId, authorizationToken, secret } = {}) {
        const credentials = {
            authorizationToken: authorizationToken || process.env.PANAMAH_AUTHORIZATION_TOKEN,
            secret: secret || process.env.PANAMAH_SECRET,
            assinanteId: assinanteId || '*'
        };
        this._validateCredentials(credentials);
        processor.on('batch_sent', this._onBatchSent);
        processor.on('before_save', this._onBeforeSave);
        processor.on('before_delete', this._onBeforeDelete);
        processor.on('error', this._onError);
        processor.start({ credentials });
        return this;
    }

    /**
     * @function
     * @description Salva um modelo no Panamah
     * @param {PanamahModel} data Modelo a ser salvo
     * @param {string} [assinanteId] Id do assinante (Obrigatório quando em ambiente multi-tenant)
     * @example
     * //Single tenancy
     * PanamahStream.save(produto);
     * //Multi tenancy
     * PanamahStream.save(produto, '123456789');
     */
    save(data, assinanteId) {
        let models = Array.isArray(data) ? data : [data];
        models.forEach(model => {
            if (this._acceptableModel(model)) {
                let keepExecuting = true;
                let preventSave = () => { keepExecuting = false };
                this.emit('before_save', model, assinanteId, preventSave);
                if (keepExecuting)
                    processor.save(model, assinanteId);
            }
            else
                throw new ValidationError(`Impossível salvar modelos do tipo ${model.className} no stream.`);
        });
    }

    /**
     * @function
     * @description Deleta um modelo no Panamah
     * @param {PanamahModel} data Modelo a ser deletado
     * @param {string} [assinanteId] Id do assinante (Obrigatório quando em ambiente multi-tenant)
     * @example
     * //Single tenancy
     * PanamahStream.save(produto);
     * //Multi tenancy
     * PanamahStream.save(produto, '123456789');
     */
    delete(data, assinanteId) {
        let models = Array.isArray(data) ? data : [data];
        models.forEach(model => {
            if (this._acceptableModel(model)) {
                let keepExecuting = true;
                let preventDelete = () => { keepExecuting = false };
                this.emit('before_delete', model, assinanteId, preventDelete);
                if (keepExecuting)
                    processor.delete(model, assinanteId);
            }
            else
                throw new ValidationError(`Impossível deletar modelos do tipo ${model.className} no stream.`);
        });
    }

    /**
     * @function
     * @description Lê um arquivo de nota fiscal eletrônica para extrair modelos pré-preenchidos do Panamah
     * @param {string} filename Caminho para o arquivo da nota fiscal eletrônica
     * @returns {PanamahModel[]} Array de modelos do Panamah extraídos do arquivo
     * @example
     * const models = await PanamahStream.readNFe('/tmp/notas-fiscais/NFe12484920000000000004214100000003121555232146.xml');
     */
    async readNFe(filename) {
        return await NFe.readModelsFromFile(filename);
    }

    /**
     * @function
     * @description Lê um diretório que contenha arquivos de nota fiscal eletrônica ou eventos para extrair modelos pré-preenchidos do Panamah
     * @param {string} filename Caminho para o diretório que contém notas fiscais eletrônicas ou eventos
     * @returns {PanamahModel[]} Array de modelos do Panamah extraídos do diretório
     * @example
     * const models = PanamahStream.readNFe('/tmp/notas-fiscais');
     */
    async readNFeDirectory(dirname) {
        return await NFe.readModelsFromDirectory(dirname);
    }

    /**
     * @function
     * @description Busca recursos com pendências
     * @returns {PendingResources[]} 
     * @example
     * const pendingResources = await PanamahStream.getPendingResources();
     */
    async getPendingResources() {
        return await processor.getPendingResources();
    }

    /**
     * @function
     * @description Envia recursos que estejam aguardando liberação de buffer. (Necessário chamar sempre ao final da execução da aplicação)
     * @example
     * await PanamahStream.flush();
     */
    async flush() {
        await processor.flush();
        processor.removeListener('batch_sent', this._onBatchSent);
        processor.removeListener('before_save', this._onBeforeSave);
        processor.removeListener('before_delete', this._onBeforeDelete);
        processor.removeListener('error', this._onError);
        return this;
    }
}

const stream = new PanamahStream();

module.exports = stream;
