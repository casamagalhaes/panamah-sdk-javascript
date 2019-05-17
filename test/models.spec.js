const fs = require('fs');
const path = require('path');
const models = require("../lib/models");
const { asyncForEach, deleteFolderRecursive } = require("../lib/util");
const Stream = require("../stream");
const mocha = require("mocha");
const expect = require('chai').expect;
const testServer = require('./support/server');

describe("models", () => {
    before(done => {
        deleteFolderRecursive(path.join(process.cwd(), '/.panamah'));
        testServer.start();
        done();
    });

    after(done => {
        testServer.stop();
        done();
    });

    it("should be sent after flushing", async () => {
        const readFixture = name => {
            const data = fs.readFileSync(path.join(__dirname, '/support/fixtures/models', name));
            return JSON.parse(data.toString());
        }
        const classNames = Object.keys(models).filter(className => className !== 'PanamahAssinante');
        await asyncForEach(classNames, async className => {
            const ModelClass = models[className];
            const model = new ModelClass();
            const fixtureName = `${model.modelName.toLowerCase().split('_').join('-')}.json`;
            const instance = new ModelClass(readFixture(fixtureName));
            try {
                Stream.init();
                Stream.save(instance);
                await Stream.flush();
            } catch (e) {
                console.log('Model:', className);
                console.error(e, e.stack);
                throw new Error(e);
            }
        });
        expect(testServer.buffer.filter(i => i.action === 'DATA').length).to.equal(classNames.length);
        return;
    });
});

