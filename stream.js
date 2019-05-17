const { ValidationError } = require('./lib/exceptions');
const processor = require('./lib/processor');
const EventEmitter = require('events');

class Stream extends EventEmitter {
    constructor() {
        super();
    }

    init(authorizationToken, secret, assinanteId) {
        processor.on('before_save', model => this.emit('before_save', model));
        processor.on('before_delete', model => this.emit('before_delete', model));
        processor.on('error', error => this.emit('error', error));
        processor.start({
            credentials: {
                authorizationToken: process.env.PANAMAH_AUTHORIZATION_TOKEN || authorizationToken,
                secret: process.env.PANAMAH_SECRET || secret,
                assinanteId: process.env.PANAMAH_ASSINANTE_ID || assinanteId
            }
        });
    }

    validModel(model) {
        return !['ASSINANTE'].includes(model.className);
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
        return await processor.flush();
    }
}

const stream = new Stream();

module.exports = stream;
