const fs = require('fs');
const path = require('path');
const models = require("../lib/models");
const { asyncForEach, deleteFolderRecursive } = require("../lib/util");
const PanamahStream = require("../stream");
const expect = require('chai').expect;
const testServer = require('./support/server');
const processor = require('../lib/processor');

describe("stream", () => {
    before(done => {
        deleteFolderRecursive(path.join(process.cwd(), '/.panamah'));
        testServer.start();
        done();
    });

    after(done => {
        testServer.stop();
        done();
    });

    it("should be send models after flushing", async () => {
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
                PanamahStream.init({ assinanteId: '03992843467' });
                PanamahStream.save(instance);
                await PanamahStream.flush();
            } catch (e) {
                console.log('Model:', className);
                console.error(e, e.stack);
                throw new Error(e);
            }
        });
        const operations = testServer
            .config
            .buffer
            .filter(i => i.action === 'DATA')
            .map(i => i.body)
            .reduce((a, b) => a.concat(b));
        expect(operations.length).to.equal(classNames.length);
        return;
    });

    it("should be send models flushing in multitenancy mode", async () => {
        testServer.config.buffer = [];
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
                PanamahStream.init();
                PanamahStream.save(instance, '03992843467');
                PanamahStream.save(instance, '02541926375');
                PanamahStream.save(instance, '00934509022');
                await PanamahStream.flush();
            } catch (e) {
                console.log('Model:', className);
                console.error(e, e.stack);
                throw new Error(e);
            }
        });
        const operations = testServer
            .config
            .buffer
            .filter(i => i.action === 'DATA')
            .map(i => i.body)
            .reduce((a, b) => a.concat(b));
        expect(operations.length).to.equal(classNames.length * 3);
    });

    it("should return models separated by assinanteId for getPendingResources in multitenancy mode", async () => {
        testServer.config.pendingResources = [
            { resource: 'LOJA', id: '111', assinanteId: '03992843467' },
            { resource: 'LOJA', id: '2345', assinanteId: '03992843467' },
            { resource: 'PRODUTO', id: '1', assinanteId: '03992843467' },
            { resource: 'SECAO', id: '001', assinanteId: '03992843467' },
            { resource: 'SECAO', id: '999', assinanteId: '03992843467' },
            { resource: 'SECAO', id: 'xxxx', assinanteId: '03992843467' },
            { resource: 'LOJA', id: '222', assinanteId: '02541926375' },
            { resource: 'LOJA', id: '6789', assinanteId: '02541926375' },
        ];
        PanamahStream.init();
        const pendingResources = await PanamahStream.getPendingResources();
        await PanamahStream.flush();

        expect(pendingResources.length).to.be.equal(2);

        expect(pendingResources[0].assinanteId).to.be.equal('03992843467');
        expect(pendingResources[0].models.length).to.be.equal(6);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahLoja).length).to.be.equal(2);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahProduto).length).to.be.equal(1);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahSecao).length).to.be.equal(3);

        expect(pendingResources[1].assinanteId).to.be.equal('02541926375');
        expect(pendingResources[1].models.length).to.be.equal(2);
        expect(pendingResources[1].models.filter(model => model instanceof models.PanamahLoja).length).to.be.equal(2);
        return;
    });

    it("should return models separated by assinanteId for getPendingResources in singletenant mode", async () => {
        testServer.config.pendingResources = [
            { resource: 'LOJA', id: '111', assinanteId: '03992843467' },
            { resource: 'LOJA', id: '2345', assinanteId: '03992843467' },
            { resource: 'PRODUTO', id: '1', assinanteId: '03992843467' },
            { resource: 'SECAO', id: '001', assinanteId: '03992843467' },
            { resource: 'SECAO', id: '999', assinanteId: '03992843467' },
            { resource: 'SECAO', id: 'xxxx', assinanteId: '03992843467' },
            { resource: 'LOJA', id: '222', assinanteId: '02541926375' },
            { resource: 'LOJA', id: '6789', assinanteId: '02541926375' },
        ];
        PanamahStream.init({ assinanteId: '03992843467' });
        const pendingResources = await PanamahStream.getPendingResources();
        await PanamahStream.flush();

        expect(pendingResources.length).to.be.equal(1);

        expect(pendingResources[0].assinanteId).to.be.equal('03992843467');
        expect(pendingResources[0].models.length).to.be.equal(6);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahLoja).length).to.be.equal(2);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahProduto).length).to.be.equal(1);
        expect(pendingResources[0].models.filter(model => model instanceof models.PanamahSecao).length).to.be.equal(3);
        return;
    });

    it("should send data when max time limit has been reached", done => {
        (async () => {
            testServer.config.buffer = [];
            PanamahStream.init();
            processor._config.batchTTL = 1000;
            const readFixture = name => {
                const data = fs.readFileSync(path.join(__dirname, '/support/fixtures/models', name));
                return JSON.parse(data.toString());
            }
            const classNames = ['PanamahProduto', 'PanamahSecao', 'PanamahLoja'];
            await asyncForEach(classNames, async className => {
                const ModelClass = models[className];
                const model = new ModelClass();
                const fixtureName = `${model.modelName.toLowerCase().split('_').join('-')}.json`;
                const instance = new ModelClass(readFixture(fixtureName));
                try {
                    PanamahStream.save(instance, '03992843467');
                } catch (e) {
                    console.log('Model:', className);
                    console.error(e, e.stack);
                    throw new Error(e);
                }
            });
            const timeout = setTimeout(() => {
                throw new Error("Batch não enviado no tempo correto");
            }, 2100);
            PanamahStream.on('batch_sent', (batch, status, response) => {
                clearTimeout(timeout);
                expect(status).to.be.equal(200);
                done();
            });
        })();
    });

    it("should refresh only once after 403 sending a batch", async () => {
        testServer.config.tokenExpired = true;
        const readFixture = name => {
            const data = fs.readFileSync(path.join(__dirname, '/support/fixtures/models', name));
            return JSON.parse(data.toString());
        }
        const model = new models.PanamahProduto();
        const fixtureName = `${model.modelName.toLowerCase().split('_').join('-')}.json`;
        const instance = new models.PanamahProduto(readFixture(fixtureName));
        try {
            PanamahStream.init();
            PanamahStream.on('error', e => {
                console.log(e, e.stack);
                throw new Error(e.message || e);
            });
            PanamahStream.on('batch_sent', (batch, status, response) => {
                console.log(batch, status, response);
            });
            PanamahStream.save(instance, '03992843467');
            await Promise.all([
                processor._process(),
                PanamahStream.flush()
            ]);
            expect(testServer.config.tokenExpired).to.be.equal(false);
        } catch (e) {
            console.log('Model:', model.modelName);
            console.error(e, e.stack);
            throw new Error(e.message || e);
        }
        return;
    });


});
