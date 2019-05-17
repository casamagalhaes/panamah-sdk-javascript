module.exports = {
    ValidationError: class ValidationError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahValidationError';
        }
    },
    RefreshTokenError: class RefreshTokenError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahRefreshTokenError';
        }
    },
    AuthError: class AuthError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahAuthError';
        }
    },
    DataError: class DataError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahDataError';
        }
    },
    AdminError: class AdminError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahAdminError';
        }
    },
    InitError: class InitError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahInitError';
        }
    },
    NotFoundError: class NotFoundError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahNotFoundError';
        }
    },
    ConflictError: class ConflictError extends Error {
        constructor(message) {
            super(message);
            this.name = 'PanamahConflictError';
        }
    }
}