const fs = require('fs');
const parseXml = require('xml2js').parseString;
const { PanamahLoja, PanamahCliente, PanamahProduto, PanamahVenda } = require('./models');

class PanamahNFe {
    static async _parseXmlFile(filename) {
        return new Promise((resolve, reject) => {
            fs.readFile(filename, (err, data) => {
                if (err) reject(err);
                else parseXml(data, (err, xml) => {
                    if (err) reject(err);
                    else resolve(xml);
                })
            });
        });
    }

    static async deserializeLoja(xml) {
        console.log(JSON.stringify(xml));
    }

    static async deserializeCliente(xml) {

    }

    static async deserializeProdutos(xml) {

    }

    static async deserializeVenda(xml) {

    }

    static async parseModels(filename) {
        const xml = await this._parseXmlFile(filename);
        return [
            ...PanamahNFe.deserializeLoja(xml),
            ...PanamahNFe.deserializeCliente(xml),
            ...PanamahNFe.deserializeProdutos(xml),
            ...PanamahNFe.deserializeVenda(xml)
        ].filter(m => m);
    }
}

module.exports = PanamahNFe;

(async () => {
    let models = await PanamahNFe.parseModels('/home/caio/projects/panamah-sdk-javascript/test/support/fixtures/xmls/NFe13190507128945000132655081000000901000000040.xml');
    console.log(models);
})();