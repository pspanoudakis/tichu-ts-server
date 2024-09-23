export class BusinessError extends Error {
    constructor(message: string) {
        super(message);
    }

    override toString() {
        return `Business Error: ${this.message}`;
    }
}
