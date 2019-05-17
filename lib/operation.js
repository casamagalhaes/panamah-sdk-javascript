class Operation {
    constructor(data, tipo, op, id) {
        this.data = (data.data && typeof data.data === 'object' ? data.data : data) || data;
        this.tipo = tipo || data.tipo;
        this.op = op || data.op;
        this._id = id || data.id;
    }

    get id() {
        return (this.data && this.data.id) || this._id;
    }

    set id(val) {
        if (this.data)
            this.data.id = val;
        this._id = val;
    }

    toJSON() {
        return Object.assign({},
            ...Object
                .keys(this)
                .filter(key => !['_id'].includes(key))
                .map(key => ({ [key]: this[key] }))
        );
    }

    static from(obj) {
        return new Operation(obj.data, obj.tipo, obj.op, obj.id);
    }
}

module.exports = {
    Operation,
    Update: class Update extends Operation {
        constructor(data) {
            super(data, data.modelName, 'update');
        }
    },
    Delete: class Delete extends Operation {
        constructor(data) {
            super({ id: data.id }, data.modelName, 'delete');
        }
    }
}
