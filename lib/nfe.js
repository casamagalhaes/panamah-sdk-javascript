const fs = require('fs');
const parseXml = require('xml2js').parseString;
const { PanamahLoja, PanamahCliente, PanamahProduto, PanamahVenda } = require('./models');
const get = require('lodash.result');
const flatten = require('lodash.flatten');
const { getFilesInDirectory } = require('./util');
const path = require('path');

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

    static deserializeLoja(xml) {
        let root = get(xml, 'nfeProc') || xml;
        root = { NFe: get(root, 'NFe[0]') || get(root, 'NFe') };
        return new PanamahLoja({
            id: get(root, 'NFe.infNFe[0].emit[0].CNPJ[0]'),
            descricao: get(root, 'NFe.infNFe[0].emit[0].xNome[0]'),
            numeroDocumento: get(root, 'NFe.infNFe[0].emit[0].CNPJ[0]'),
            logradouro: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].xLgr[0]'),
            numero: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].nro[0]'),
            uf: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].UF[0]'),
            cidade: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].xMun[0]'),
            bairro: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].xBairro[0]'),
            cep: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].CEP[0]'),
            complemento: get(root, 'NFe.infNFe[0].emit[0].enderEmit[0].xCpl[0]'),
            ativa: true,
            matriz: false
        });
    }

    static deserializeCliente(xml) {
        let root = get(xml, 'nfeProc') || xml;
        root = { NFe: get(root, 'NFe[0]') || get(root, 'NFe') };
        return new PanamahCliente({
            id: get(root, 'NFe.infNFe[0].dest[0].CNPJ[0]') || get(root, 'NFe.infNFe[0].dest[0].CPF[0]'),
            nome: get(root, 'NFe.infNFe[0].dest[0].xNome[0]'),
            numeroDocumento: get(root, 'NFe.infNFe[0].dest[0].CNPJ[0]') || get(root, 'NFe.infNFe[0].dest[0].CPF[0]'),
            logradouro: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].xLgr[0]'),
            numero: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].nro[0]'),
            uf: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].UF[0]'),
            cidade: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].xMun[0]'),
            bairro: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].xBairro[0]'),
            cep: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].CEP[0]'),
            complemento: get(root, 'NFe.infNFe[0].dest[0].enderDest[0].xCpl[0]')
        });
    }

    static deserializeProdutos(xml) {
        let root = get(xml, 'nfeProc') || xml;
        root = { NFe: get(root, 'NFe[0]') || get(root, 'NFe') };
        let dets = get(root, 'NFe.infNFe[0].det');
        return (dets && dets.map(det => {
            return new PanamahProduto({
                id: get(det, 'prod[0].cProd[0]'),
                descricao: get(det, 'prod[0].xProd[0]'),
                ativo: true
            });
        })) || [];
    }

    static deserializeVenda(xml) {
        let root = get(xml, 'nfeProc') || xml;
        root = { NFe: get(root, 'NFe[0]') || get(root, 'NFe') };
        const dets = get(root, 'NFe.infNFe[0].det');
        return new PanamahVenda({
            id: get(root, 'NFe.infNFe[0].$.Id'),
            lojaId: get(root, 'NFe.infNFe[0].emit[0].CNPJ[0]'),
            clienteId: get(root, 'NFe.infNFe[0].dest[0].CNPJ[0]') || get(root, 'NFe.infNFe[0].dest[0].CPF[0]'),
            data: get(root, 'NFe.infNFe[0].ide[0].dhEmi[0]'),
            dataHoraVenda: get(root, 'NFe.infNFe[0].ide[0].dhEmi[0]'),
            efetiva: true,
            quantidadeItens: (dets && dets.length) || 0,
            valor: Number(get(root, 'NFe.infNFe[0].total[0].ICMSTot[0].vNF[0]')),
            itens: (dets && dets.map(det => ({
                produtoId: get(det, 'prod[0].cProd[0]'),
                quantidade: Number(get(det, 'prod[0].qCom[0]')) || 0,
                preco: Number(get(det, 'prod[0].vUnCom[0]')) || 0,
                valorUnitario: Number(get(det, 'prod[0].vUnCom[0]')) || 0,
                valorTotal: Number(get(det, 'prod[0].vProd[0]')) || 0,
                desconto: Number(get(det, 'prod[0].vDesc[0]')) || 0,
                efetivo: true
            }))) || []
        });
    }

    static async readModelsFromFile(filename) {
        const file = path.basename(filename);
        if (!file.startsWith('ID')) {
            const xml = await this._parseXmlFile(filename);
            return [
                PanamahNFe.deserializeLoja(xml),
                PanamahNFe.deserializeCliente(xml),
                PanamahNFe.deserializeVenda(xml),
                ...PanamahNFe.deserializeProdutos(xml)
            ].filter(m => m);
        }
        return [];
    }

    static async readModelsFromDirectory(dirname) {
        const files = await getFilesInDirectory(dirname, /.*\.xml/i);
        const hasCancelEventFile = model => files.find(file => file.startsWith('ID110111') && model.id && new RegExp(model.id.replace(/[^0-9]+/, '')).test(file));
        const models = flatten(await Promise.all(files.map(file => PanamahNFe.readModelsFromFile(path.join(dirname, file)))));
        return models.map(model => {
            if (model instanceof PanamahVenda && hasCancelEventFile(model))
                return Object.assign(model, { efetiva: false });
            return model;
        });
    }
}

module.exports = PanamahNFe;
