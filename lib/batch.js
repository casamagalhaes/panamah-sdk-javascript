const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { writeJSON, readJSONSync, forceDirectories, directoryExists } = require('./util');

class Batch {
    constructor(items) {
        this._items = items;
        this._createdAt = moment();
        this._priority = false;
    }

    get createdAt() {
        return this._createdAt;
    }

    get priority() {
        return this._priority;
    }

    set filename(val) {
        this._setFilename(val);
    }

    get filename() {
        return this._getFilename();
    }

    get length() {
        return this._items.length;
    }

    get size() {
        return JSON.stringify(this).length;
    }

    _setFilename(filename) {
        const parts = path.resolve(filename).split('_');
        if (parts.length >= 7) {
            this._priority = parts.length > 7 && parts[0] === '0';
            const offset = this._priority ? 1 : 0;
            this._createdAt = moment(
                parts[offset + 0] +
                parts[offset + 1] +
                parts[offset + 2] +
                parts[offset + 3] +
                parts[offset + 4] +
                parts[offset + 5] +
                parts[offset + 6]
                , 'YYYYMMDDhhmmssSSS');
        }
    }

    _getFilename() {
        return (this._priority ? '0_' : '') + this._createdAt.format(`YYYY_MM_DD_hh_mm_ss_SSS.pbt`);
    }

    async loadFromDirectory(dirname) {
        return await this.loadFromFilename(path.join(dirname, this.filename));
    }

    loadFromFilename(filename) {
        if (fs.existsSync(filename)) {
            this.filename = filename;
            this._items = readJSONSync(filename) || [];
        }
        return this;
    }

    async saveToFile(filename) {
        const dirname = path.dirname(filename);
        forceDirectories(dirname);
        return await writeJSON(filename, this);
    }

    async saveToDirectory(dirname) {
        await this.saveToFile(path.join(dirname, this.filename));
        return this;
    }

    async deleteFromDirectory(dirname) {
        if (directoryExists(dirname)) {
            return new Promise((resolve, reject) => {
                fs.unlink(path.join(dirname, this.filename), err => {
                    if (err) reject(err);
                    else resolve(this);
                })
            });
        }
    }

    async moveBetweenDirectories(source, destiny) {
        await this.deleteFromDirectory(source);
        await this.saveToDirectory(destiny);
        return this;
    }

    reset() {
        this._items = [];
        this._createdAt = moment();
        this._priority = false;
        return this;
    }

    push(operation) {
        this._items.push(operation);
        return this;
    }

    toJSON() {
        return this._items;
    }

    static from(filename) {
        return new Batch([]).loadFromFilename(filename);
    }
}

module.exports = Batch;
