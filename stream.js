const { ValidationError, InitError } = require('./lib/exceptions');
const processor = require('./lib/processor');
const EventEmitter = require('events');

class Stream extends EventEmitter {
    constructor() {
        super();
        this._onBeforeSave = model => this.emit('before_save', model);
        this._onBeforeDelete = model => this.emit('before_delete', model);
        this._onError = error => this.emit('error', error);
    }

    init(authorizationToken, secret, assinanteId) {
        const credentials = {
            authorizationToken: process.env.PANAMAH_AUTHORIZATION_TOKEN || authorizationToken,
            secret: process.env.PANAMAH_SECRET || secret,
            assinanteId: process.env.PANAMAH_ASSINANTE_ID || assinanteId
        };
        this._validateCredentials(credentials);
        processor.on('before_save', this._onBeforeSave);
        processor.on('before_delete', this._onBeforeDelete);
        processor.on('error', this._onError);
        processor.start({ credentials });
    }

    _validateCredentials(credentials) {
        if (!credentials.authorizationToken)
            throw new InitError('Authorization token é obrigatório.');
        if (!credentials.secret)
            throw new InitError('Secret é obrigatório.');
        if (!credentials.assinanteId)
            throw new InitError('AssinanteId é obrigatório.');
    }

    validModel(model) {
        return !['ASSINANTE'].includes(model.modelName);
    }

    save(model) {
        if (this.validModel(model)) {
            let keepExecuting = true;
            let preventSave = () => { keepExecuting = false };
            this.emit('before_save', model, preventSave);
            if (keepExecuting)
                processor.save(model);
        }
        else
            throw new ValidationError(`Impossível salvar modelos do tipo ${model.className} no stream.`);
    }

    delete(model) {
        if (this.validModel(model)) {
            let keepExecuting = true;
            let preventDelete = () => { keepExecuting = false };
            this.emit('before_delete', model, preventDelete);
            if (keepExecuting)
                processor.delete(model);
        }
        else
            throw new ValidationError(`Impossível deletar modelos do tipo ${model.className} no stream.`);
    }

    async flush() {
        await processor.flush();
        processor.off('before_save', this._onBeforeSave);
        processor.off('before_delete', this._onBeforeDelete);
        processor.off('error', this._onError);
        return this;
    }
}

const stream = new Stream();

module.exports = stream;
