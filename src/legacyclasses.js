const { decorateProxy, LuaTypeExtension } = require("wasmoon");

const functionClasses = [
    Buffer,
    Object,
    Array,
    String,
    Number,
]

module.exports = class extends LuaTypeExtension {
    constructor(thread, injectObject) {
        super(thread, 'js_functionclass')
    }

    pushValue(thread, { target, options }) {
        // If is a function not bounded yet
        if (typeof target === 'function' && !options?.proxy) {
            const isLegacyNativeClass = functionClasses.includes(target)
            // If it has a prototype, probably is something important
            const hasPrototype = target.prototype && Object.keys(target.prototype).length > 0

            if (isLegacyNativeClass || hasPrototype) {
                thread.pushValue(decorateProxy(target, { proxy: true }))
                return true
            }
        }
    }
}