const fs = require('fs');
const crypto = require('crypto');

const directoryHasFiles = async (dirname, pattern) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, function (err, files) {
            if (err) reject(err);
            else resolve(files.filter(file => pattern.test(file)).length);
        });
    });
}

const directoryIsEmpty = async (dirname, pattern) => !(await directoryHasFiles(dirname, pattern));

const readJSON = async path => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
}

const writeJSON = async (path, json) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, JSON.stringify(json), err => {
            if (err) reject(err)
            else resolve();
        })
    });
}

const sha1Base64 = data => {
    return crypto
        .createHash('sha1')
        .update(data)
        .digest('base64');
}

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        const breakFor = () => { index = array.length };
        await callback(array[index], index, array, breakFor);
    }
}

module.exports = {
    directoryIsEmpty,
    directoryHasFiles,
    sha1Base64,
    readJSON,
    writeJSON,
    asyncForEach
}
