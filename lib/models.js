const path = require('path');
const fs = require('fs');
const camelCase = require('lodash.camelcase');
const moment = require('moment');

class Model {
    constructor(data, schema, className, modelName) {
        this._setData(data);
        this._schema = schema;
        this._className = className;
        this._modelName = modelName;
    }

    get className() {
        return this._className;
    }

    get modelName() {
        return this._modelName;
    }

    validate() {
        return this._validateSchema(this._getData(), this._schema);
    }

    _setData(data) {
        Object.keys(data).forEach(key => {
            this[key] = data[key];
        });
    }

    _getData() {
        return Object.assign({},
            ...Object
                .keys(this)
                .filter(key => !['_schema', '_className', '_modelName'].includes(key))
                .map(key => ({ [key]: this[key] }))
        );
    }

    _validationResult(message) {
        if (typeof message === 'string') {
            return {
                success: false,
                message
            }
        }
        else {
            return { success: true };
        }
    }

    _validateSchema(data, schema) {
        const validateType = (fieldName, value, schemaField) => {
            if (['string', 'number', 'boolean'].includes(schemaField.type)) {
                if (typeof value != schemaField.type)
                    return this._validationResult(`${fieldName} possui tipo inválido. (atual: ${typeof value}, esperado: ${schemaField.type})`);
                if (schemaField.allowedValues)
                    if (!schemaField.allowedValues.includes(value))
                        return this._validationResult(`${fieldName} possui valor inválido. (atual: ${typeof value}, permitidos: ${schemaField.allowedValues.join(', ')})`);
            } else if (schemaField.type == 'date') {
                if (!(value instanceof Date)) {
                    if (typeof value != 'string' || !moment(value).isValid())
                        return this._validationResult(`${fieldName} possui um data inválida`);
                }
            } else if (schemaField.type == "object") {
                if (!(value instanceof Object) || (value instanceof Array) || (value instanceof Date))
                    return this._validationResult(`${fieldName} possui tipo inválido. (atual: ${value instanceof Array ? 'array' : (value instanceof Date ? 'date' : typeof value)}, esperado: ${schemaField.type})`);
                const validationResult = this._validateSchema(value, {
                    fields: schemaField.fields
                });
                if (!validationResult.success)
                    return this._validationResult(`${fieldName}:  ${validationResult.message}`);
            } else if (/^list\[(object|string|number|boolean|date)\]$/.test(schemaField.type)) {
                const internalType = schemaField.type.substring(5, schemaField.type.indexOf(']'));
                if (!(value instanceof Array))
                    return this._validationResult(`${fieldName} não é uma lista`);
                for (let i = 0; i < value.length; i++) {
                    const resp = validateType(`item ${i + 1}`, value[i], {
                        type: internalType,
                        allowedValues: schemaField.allowedValues,
                        fields: schemaField.fields
                    });
                    if (!resp.success)
                        return this._validationResult(`${fieldName} => ${resp.message}`);
                }
            }
            return this._validationResult(true);
        };
        const keys = Object.keys(schema.fields);
        for (let i = 0; i < keys.length; i++) {
            const fieldName = keys[i];
            const schemaField = schema.fields[fieldName];
            if (schemaField.required && (data[fieldName] === undefined || data[fieldName] == null || data[fieldName] === ''))
                return this._validationResult(`propriedade ${fieldName} requerida`)
            if (data[fieldName]) {
                const value = data[fieldName];
                const typeValidation = validateType(fieldName, value, schemaField);
                if (typeValidation.success) {
                    if (schemaField.type == "date" && value)
                        data[fieldName] = moment(value).format('YYYY-MM-DDTHH:mm:ss[Z]');
                } else
                    return typeValidation;
            }
        }
        const incompatibleProps = Object.keys(data).filter(p => !keys.includes(p));
        if (incompatibleProps.length > 0)
            return this._validationResult(`propriedade${incompatibleProps.length > 1 ? 's' : ''} [${incompatibleProps.join(', ')}] não existe${incompatibleProps.length > 1 ? 'm' : ''} no schema`);
        return this._validationResult(true);
    }

    toJSON() {
        return this._getData();
    }
}

const generateModel = (className, modelName, schema) => {
    return {
        [className]: class extends Model {
            constructor(data) {
                super(data || {}, schema, className, modelName);
            }
        }
    }
}

const getClassName = modelName => 'Panamah' + modelName[0].toUpperCase() + camelCase(modelName.slice(1));

const generateModelsUsingSchema = () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json')).toString());
    const keys = Object.keys(schema);
    const classNames = keys.map(modelName => getClassName(modelName));
    return Object.assign({}, ...classNames.map((className, index) => generateModel(className, keys[index], schema[keys[index]])));
}

const models = generateModelsUsingSchema();

const createModelByName = (modelName, data) => {
    const className = getClassName(modelName);
    return new models[className](data);
}

module.exports = Object.assign(models, {
    createModelByName
});
