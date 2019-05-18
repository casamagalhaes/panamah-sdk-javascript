const fs = require('fs');
const parseXml = require('xml2js').parseString;

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

    static async fromFile(filename) {
        const xml = await this._parseXmlFile(filename);
        console.dir(xml);
    }
}

module.exports = PanamahNFe;

PanamahNFe.fromFile('/home/caio/projects/panamah-sdk-javascript/test/support/fixtures/xmls/NFe13190507128945000132655081000000901000000040.xml');