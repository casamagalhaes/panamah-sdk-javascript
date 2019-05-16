const { directoryHasFiles, asyncForEach, sha1Base64 } = require('./util');
const { ValidationError, DataError } = require('./exceptions');
const Batch = require('./batch');
const StreamClient = require('./stream-client');
const EventEmitter = require('events');
const path = require('path');
const PANAMAH_BATCH_EXTENSION = /.*\.pbt/;
const moment = require('moment');

class BatchProcessor extends EventEmitter {
    constructor(config) {
        this._config = {
            credentials: config.credentials || {},
            batchTTL: 5 * 60 * 1000,
            batchMaxSize: 5 * 1024,
            batchMaxCount: 500
        };
        this._client = new StreamClient(config.credentials);
        this._path = {
            sent: path.join(process.cwd(), '/.panamah/sent'),
            accumulated: path.join(process.cwd(), '/.panamah/accumulated'),
            currentBatch: path.join(process.cwd(), '/.panamah/current.pbt')
        }
        this._currentBatch = Batch.from(this._path.currentBatch);
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
            this._currentBatch.saveToDirectory(this._path.currentBatch);
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
        return await readFilesInDirectory(this._path.accumulated, PANAMAH_BATCH_EXTENSION);
    }

    async _accumulatedBatchesExists() {
        return await directoryHasFiles(this._path.accumulated, PANAMAH_BATCH_EXTENSION);
    }

    async _recoverFromFailures(failures) {

    }

    async _sendAccumulatedBatches() {
        const batches = await this._getAccumulatedBatches();
        await asyncForEach(batches, async (batch, _, _, stopSendingBatches) => {
            const { status, data: response } = this._client.post('/stream/data', batch);
            if (status === 200) {
                if (response.falhas) {
                    await this._recoverFromFailures(response.falhas);
                    return stopSendingBatches();
                }
            } else
                throw new DataError(response);
        });
    }

    async _process() {
        if (await this._accumulatedBatchesExists())
            await this._sendAccumulatedBatches();
        else
            await this._watchCurrentBatch();
        await this._removeOldSentBatches();
    }

    save(model) {
        const validation = model.validate();
        if (validation.success)
            this._currentBatch.push(new Operation.Update(model));
        else
            throw new ValidationError(validation.reasons);
    }

    delete(model) {
        if (model.id) {
            this._currentBatch.push(new Operation.Delete(model));
        } else {
            throw new ValidationError('Id obrigatório para exclusão.');
        }
    }

    start() {
        this._interval = setInterval(() => this._process(), 500);
    }

    stop() {
        clearInterval(this._interval);
    }
}

module.exports = BatchProcessor;
