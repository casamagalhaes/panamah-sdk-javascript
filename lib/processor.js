'use strict';

const { directoryHasFiles, asyncForEach, sha1Base64, getFilesInDirectory, directoryExists, deleteFile } = require('./util');
const { ValidationError, DataError } = require('./exceptions');
const Batch = require('./batch');
const StreamClient = require('./stream-client');
const { Operation, Update, Delete } = require('./operation');
const EventEmitter = require('events');
const path = require('path');
const moment = require('moment');
const { createModelByName } = require('./models');
const PANAMAH_BATCH_EXTENSION = /.*\.pbt/i;

class BatchProcessor extends EventEmitter {
    constructor() {
        super();
    }

    _currentBatchExpiredByCount() {
        return this._currentBatch.length >= this._config.batchMaxCount;
    }

    _currentBatchExpiredBySize() {
        return this._currentBatch.size >= this._config.batchMaxSize;
    }

    _currentBatchExpiredByTime() {
        return moment(this._currentBatch.createdAt).diff(moment(), 'milliseconds') >= this._config.batchTTL;
    }

    _currentBatchExpired() {
        return this._currentBatchExpiredByCount() || this._currentBatchExpiredBySize() || this._currentBatchExpiredByTime();
    }

    async _writeCurrentBatchChangesToDisk() {
        const currentBatchHash = sha1Base64(this._currentBatch);
        if (currentBatchHash != this._lastCurrentBatchHash) {
            this._currentBatch.saveToFile(this._path.currentBatch);
            this._lastCurrentBatchHash = sha1Base64(this._currentBatch);
        }
    }

    async _watchCurrentBatch() {
        if (this._currentBatchExpired())
            return await this._accumulateCurrentBatch();
        else
            return await this._writeCurrentBatchChangesToDisk();
    }

    async _getAccumulatedBatches() {
        const files = await getFilesInDirectory(this._path.accumulated, PANAMAH_BATCH_EXTENSION);
        return files.map(filename => Batch.from(path.join(this._path.accumulated, filename)));
    }

    async _accumulatedBatchesExists() {
        if (directoryExists(this._path.accumulated))
            return await directoryHasFiles(this._path.accumulated, PANAMAH_BATCH_EXTENSION);
        return false;
    }

    async _recoverFromFailures(batch, failures) {
        if (failures.total > 0) {
            const failedOperations = failures.itens.map(item => new Operation(item));
            const currentBatchFailedOperations = batch.find(failedOperations.map(op => op.id));
            const prioritizedBatch = new Batch(currentBatchFailedOperations, true);
            await prioritizedBatch.saveToDirectory(this._path.accumulated);
        }
    }

    async _sendAccumulatedBatches() {
        const batches = await this._getAccumulatedBatches();
        await asyncForEach(batches, async (batch, index, array, stopSendingBatches) => {
            const { status, data: response } = await this._client.post('/stream/data', batch.toJSON());
            if (status === 200) {
                if (response.falhas) {
                    await this._recoverFromFailures(batch, response.falhas);
                    return stopSendingBatches();
                } else {
                    await batch.moveBetweenDirectories(this._path.accumulated, this._path.sent);
                }
            } else
                throw new DataError(JSON.stringify(response));
        });
    }

    async _deleteOldBatches() {
        const files = await getFilesInDirectory(this._path.sent, PANAMAH_BATCH_EXTENSION);
        const oldBatches = files
            .map(filename => Batch.from(path.join(this._path.sent, filename)))
            .filter(batch => {
                return moment().diff(batch.createdAt, 'days') > 1
            });
        return await asyncForEach(oldBatches, async oldBatch => await deleteFile(path.join(this._path.sent, oldBatch.filename)));
    }

    async _keepQueueingProcess() {
        this._timer = setTimeout(() => {
            if (!this._running) return;
            try {
                this._process();
            } finally {
                this._startProcessing();
            }
        }, 1000);
    }

    async _stopQueueingProcess() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    async _startProcessing() {
        this._running = true;
        this._keepQueueingProcess();
    }

    async _stopProcessing() {
        this._running = false;
        this._stopQueueingProcess();
    }

    async _process() {
        try {
            if (await this._accumulatedBatchesExists())
                await this._sendAccumulatedBatches();
            await this._watchCurrentBatch();
            await this._deleteOldBatches();
        } catch (e) {
            this.emit('error', e);
        }
    }

    async flush() {
        await this._stopProcessing();
        await this._accumulateCurrentBatch();
        await this._sendAccumulatedBatches();
    }

    async _accumulateCurrentBatch() {
        if (this._currentBatch.length > 0) {
            await this._currentBatch.saveToDirectory(this._path.accumulated);
            await this._currentBatch
                .reset()
                .saveToFile(this._path.currentBatch);
        }
    }

    save(model, assinanteId) {
        if (this._config.multitenancy && !assinanteId) throw new Error('assinanteId é requerido no modo multitenancy');
        const validation = model.validate();
        if (validation.success) {
            const operation = new Update(model, assinanteId);
            this._currentBatch
                .remove(operation)
                .push(operation);
        }
        else
            throw new ValidationError(validation.message);
    }

    delete(model, assinanteId) {
        if (this._config.multitenancy && !assinanteId) throw new Error('assinanteId é requerido no modo multitenancy');
        if (model.id) {
            this._currentBatch.push(new Delete(model, assinanteId));
        } else {
            throw new ValidationError('Id obrigatório para exclusão.');
        }
    }

    start(config) {
        this._config = {
            credentials: config.credentials || {},
            batchTTL: 5 * 60 * 1000,
            batchMaxSize: 5 * 1024,
            batchMaxCount: 500,
            multitenancy: config.credentials.assinanteId === '*'
        };
        this._client = new StreamClient(config.credentials);
        this._path = {
            sent: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/sent'),
            accumulated: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/accumulated'),
            currentBatch: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/current.pbt')
        }
        this._currentBatch = Batch.from(this._path.currentBatch);
        this._startProcessing();
    }

    async stop() {
        await this._stopProcessing();
    }

    async getPendingResources() {
        const paginate = async (start = 0, count = 1000, result = {}) => {
            const { status, data } = await this._client.get(`/stream/pending-resources?start=${start}&count=${count}`);
            if (status === 200) {
                const modelNames = Object.keys(data);
                if (modelNames.length > 0) {
                    modelNames.forEach(modelName => {
                        result[modelName] = (result[modelName] || []).concat(data[modelName])
                    });
                    return await paginate(start + count, count, result);
                }
                else return result;
            } else {
                throw new DataError('Erro ao buscar recursos pendentes');
            }
        }
        const pendingResources = await paginate();
        const modelNames = Object.keys(pendingResources);
        const models = modelNames.map(modelName => {
            return pendingResources[modelName].map(id => createModelByName(modelName, { id }))
        }).reduce((a, b) => {
            return a.concat(b)
        }, []);
        return models;
    }
}

const batchProcessor = new BatchProcessor();

module.exports = batchProcessor;
