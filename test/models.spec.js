const fs = require('fs');
const path = require('path');
const models = require("../lib/models");
const { asyncForEach, deleteFolderRecursive } = require("../lib/util");
const Stream = require("../stream");
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
        const classNames = Object.keys(models).filter(className => !['PanamahAssinante', 'createModelByName'].includes(className));
        await asyncForEach(classNames, async className => {
            const ModelClass = models[className];
            const model = new ModelClass();
            const fixtureName = `${model.modelName.toLowerCase().split('_').join('-')}.json`;
            const instance = new ModelClass(readFixture(fixtureName));
            try {
                Stream.init();
                Stream.save(instance);
                await Stream.flush();
                console.log(`${className} enviado.`);
            } catch (e) {
                console.log('Model:', className);
                console.error(e, e.stack);
                throw new Error(e);
            }
        });
        expect(testServer.buffer.filter(i => i.action === 'DATA').length).to.equal(classNames.length);
        return;
    });

    it("should be sent after flushing multitenancy", async () => {
        const readFixture = name => {
            const data = fs.readFileSync(path.join(__dirname, '/support/fixtures/models', name));
            return JSON.parse(data.toString());
        }
        const classNames = Object.keys(models).filter(className => !['PanamahAssinante', 'createModelByName'].includes(className));
        await asyncForEach(classNames, async className => {
            const ModelClass = models[className];
            const model = new ModelClass();
            const fixtureName = `${model.modelName.toLowerCase().split('_').join('-')}.json`;
            const instance = new ModelClass(readFixture(fixtureName));
            try {
                Stream.init(
                    process.env.PANAMAH_AUTHORIZATION_TOKEN,
                    process.env.PANAMAH_SECRET,
                    '*'
                );                
                Stream.save(instance, '03992843467');
                Stream.save(instance, '02541926375');
                Stream.save(instance, '00934509022');                
                await Stream.flush();
                console.log(`${className} enviado.`);
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

