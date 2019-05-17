'use strict';

const { directoryHasFiles, asyncForEach, sha1Base64, getFilesInDirectory, directoryExists } = require('./util');
const { ValidationError, DataError } = require('./exceptions');
const Batch = require('./batch');
const StreamClient = require('./stream-client');
const Operation = require('./operation');
const EventEmitter = require('events');
const path = require('path');
const moment = require('moment');
const PANAMAH_BATCH_EXTENSION = /.*\.pbt/;

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

    async _recoverFromFailures(failures) {
        //TODO: do it
    }

    async _sendAccumulatedBatches() {
        const batches = await this._getAccumulatedBatches();
        await asyncForEach(batches, async (batch, index, array, stopSendingBatches) => {
            const { status, data: response } = await this._client.post('/stream/data', batch.toJSON());
            if (status === 200) {
                if (response.falhas) {
                    await this._recoverFromFailures(response.falhas);
                    return stopSendingBatches();
                } else {
                    await batch.moveBetweenDirectories(this._path.accumulated, this._path.sent);
                }
            } else
                throw new DataError(response);
        });
    }

    async _process() {
        return new Promise(async (resolve) => {
            this.on('processor_stop', () => {
                if (this._runningTimeout) clearTimeout(this._runningTimeout);
                resolve();
                this.emit('processor_stopped');
            });
            try {
                if (await this._accumulatedBatchesExists())
                    await this._sendAccumulatedBatches();
                else
                    await this._watchCurrentBatch();
                this._runningTimeout = setTimeout(() => this._process(), 500);
            } catch (e) {
                this.emit('error', e);
            }
        });
    }

    async flush() {
        await this.stop();
        try {
            await this._accumulateCurrentBatch();
            await this._sendAccumulatedBatches();
        } finally {
            this.start();
        }
    }

    async _accumulateCurrentBatch() {
        if (this._currentBatch.length > 0) {
            await this._currentBatch.saveToDirectory(this._path.accumulated);
            await this._currentBatch
                .reset()
                .saveToFile(this._path.currentBatch);
        }
    }

    save(model) {
        const validation = model.validate();
        if (validation.success)
            this._currentBatch.push(new Operation.Update(model));
        else
            throw new ValidationError(validation.message);
    }

    delete(model) {
        if (model.id) {
            this._currentBatch.push(new Operation.Delete(model));
        } else {
            throw new ValidationError('Id obrigatório para exclusão.');
        }
    }

    start(config) {
        this._config = {
            credentials: config.credentials || {},
            batchTTL: 5 * 60 * 1000,
            batchMaxSize: 5 * 1024,
            batchMaxCount: 500
        };
        this._client = new StreamClient(config.credentials);
        this._path = {
            sent: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/sent'),
            accumulated: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/accumulated'),
            currentBatch: path.join(process.env.PANAMAH_BASEDIR || process.cwd(), '/.panamah/current.pbt')
        }
        this._currentBatch = Batch.from(this._path.currentBatch);
        this._process();
    }

    async stop() {
        return new Promise((resolve, reject) => {
            this.once('processor_stopped', () => resolve());
            this.emit('processor_stop');
        });
    }
}

const batchProcessor = new BatchProcessor();

module.exports = batchProcessor;
