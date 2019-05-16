const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { writeJSON, readJSON } = require('./util');

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
        const parts = filename.split('_');
        this._priority = parts.length > 7 && parts[0] === '0';
        const offset = this._priority ? 1 : 0;
        this._createdAt = moment({
            year: parts[offset + 0],
            month: parts[offset + 1],
            day: parts[offset + 2],
            hours: parts[offset + 3],
            minutes: parts[offset + 4],
            seconds: parts[offset + 5],
            milliseconds: parts[offset + 6]
        });
    }

    _getFilename() {
        return moment(this._createdAt).format(`${this._priority ? '0_' : ''}YYYY_MM_DD_hh_mm_ss.pbt`);
    }

    async loadFromDirectory(directory) {
        return await this.loadFromFilename(path.join(directory, this.filename));
    }

    async loadFromFilename(filename) {
        if (fs.existsSync(filename)) {
            this.filename = filename;
            this._items = await readJSON(filename) || [];
        }
        return this;
    }

    async saveToDirectory(directory) {
        return await writeJSON(path.join(directory, this.filename), this);
    }

    push(operation) {
        this._items.push(operation);
    }

    toJSON() {
        return this._items;
    }

    static async from(filename) {
        return await new Batch([]).loadFromFilename(filename);
    }
}

module.exports = Batch;
