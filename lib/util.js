const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const directoryHasFiles = async (dirname, pattern) => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, (err, files) => {
            if (err) reject(err);
            else resolve(files.filter(file => pattern.test(file)).length);
        });
    });
}

const directoryIsEmpty = async (dirname, pattern) => !(await directoryHasFiles(dirname, pattern));

const directoryExists = dirname => fs.existsSync(dirname) && fs.statSync(dirname).isDirectory();

const readJSON = path => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
}

const readJSONSync = path => {
    const data = fs.readFileSync(path);
    return JSON.parse(data);
}

const writeJSON = async (path, json) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, JSON.stringify(json), err => {
            if (err) reject(err)
            else resolve();
        });
    });
}

const sha1Base64 = data => {
    if (!data) return null;
    return crypto
        .createHash('sha1')
        .update(data instanceof Object ? JSON.stringify(data) : data)
        .digest('base64');
}

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        const breakFor = () => { index = array.length };
        await callback(array[index], index, array, breakFor);
    }
}

const getFilesInDirectory = async (dirname, pattern) => {
    return new Promise((resolve, reject) => {
        fs.exists(dirname, (exists) => {
            if (exists)
                return fs.readdir(dirname, (err, files) => {
                    const matches = (files || []).filter(file => pattern.test(file));
                    if (err) reject(err);
                    else resolve(matches);
                });
            return resolve([]);
        });
    });
}

const forceDirectories = dirname => {
    const sep = path.sep;
    const initDir = path.isAbsolute(dirname) ? sep : '';
    return dirname.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') { //
                return curDir;
            }
            if (err.code === 'ENOENT') {
                throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
            }
            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
            if (!caughtErr || caughtErr && curDir === path.resolve(dirname)) {
                throw err;
            }
        }

        return curDir;
    }, initDir);
}

const waitForFalse = async (value, delay) => {
    return new Promise(resolve => {
        if (value)
            return setTimeout(() => waitForFalse(value), delay);
        return resolve(value);
    });
}

const deleteFolderRecursive = path => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(file => {
            const curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

const deleteFile = async filename => {
    return new Promise((resolve, reject) => {
        fs.exists(filename, (exists) => {
            if (exists) fs.unlink(filename, (err, data) => {
                if (err) reject(err);
                else resolve();
            })
            else resolve();
        });
    });
}

module.exports = {
    directoryIsEmpty,
    directoryHasFiles,
    sha1Base64,
    readJSON,
    readJSONSync,
    writeJSON,
    asyncForEach,
    forceDirectories,
    getFilesInDirectory,
    directoryExists,
    waitForFalse,
    deleteFolderRecursive,
    deleteFile
}
