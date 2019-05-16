module.exports = {
    ValidationError: class ValidationError extends Error {
        constructor(reasons) {
            super((Array.isArray(reasons) ? reasons : [reasons]).join('\n'));
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
    }
}