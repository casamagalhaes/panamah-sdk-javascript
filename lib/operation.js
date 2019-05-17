class Operation {
    constructor(data, modelName) {
        this.data = data;
        this.tipo = modelName;
    }

    get id() {
        return (this.data && this.data.id) || this._id;
    }

    set id(val) {
        if (this.data)
            this.data.id = val;
        this._id = val;
    }
}

module.exports = {
    Update: class Update extends Operation {
        constructor(data) {
            super(data, data.modelName);
            this.op = 'update';
        }
    },
    Delete: class Delete extends Operation {
        constructor(data) {
            super({ id: data.id }, data.modelName);
            this.op = 'delete';
        }
    }
}
