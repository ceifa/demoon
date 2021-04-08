const { decorate, decorateUserData } = require('wasmoon')

const keywords = [
    "and", "break", "do", "else", "elseif",
    "end", "false", "for", "function", "goto", "if",
    "in", "local", "nil", "not", "or", "repeat",
    "return", "then", "true", "until", "while"
]

const proxy = {
    __index: (t, k) => {
        let value = t.instance[k]

        if (value === undefined && typeof k === 'string') {
            const possibleExpectedKey = k.substring(1)
            if (keywords.includes(possibleExpectedKey) && t.instance[possibleExpectedKey]) {
                value = t.instance[possibleExpectedKey]
            }
        }

        if (['object', 'function'].includes(typeof value)) {
            if (typeof value === 'function') {
                value.__lua_self = t.instance
            }

            return decorate(
                {
                    instance: decorateUserData(value, { reference: true }),
                },
                { metatable: proxy },
            )
        }

        return value
    },
    __newindex: (t, k, v) => {
        t.instance[k] = v
    },
    __call: (t, ...args) => {
        // Called with the : syntax, let's bind this
        if (args[0].instance === t.instance.__lua_self) {
            t = t.instance.bind(t.instance.__lua_self)
            delete args[0]
            args = args.slice(1)
        } else {
            t = t.instance
        }

        args = args.map(arg => {
            if (arg.instance !== undefined) {
                arg = arg.instance
            }
            if (typeof arg === 'function') {
                return (...luaFunctionArgs) => {
                    const fixedLuaFunctionArgs = luaFunctionArgs.map(luaFunctionArg => {
                        if (['object', 'function'].includes(typeof luaFunctionArg)) {
                            return decorate(
                                {
                                    instance: decorateUserData(luaFunctionArg, { reference: true }),
                                },
                                { metatable: proxy },
                            )
                        }

                        return luaFunctionArg
                    })

                    return arg(...fixedLuaFunctionArgs)
                }
            }

            return arg
        })

        delete t.__lua_self

        let value = t(...args)
        if (Buffer.isBuffer(value)) {
            value = value.toString()
        }

        if (['object', 'function'].includes(typeof value) && value !== Promise.resolve(value)) {
            return decorate(
                {
                    instance: decorateUserData(value, { reference: true }),
                },
                { metatable: proxy },
            )
        }

        return value
    },
    __tostring: (t) => {
        const value = t.instance
        return value.toString?.() ?? typeof value
    },
    __len: (t) => {
        return t.instance.length ?? 0
    },
    __pairs: (t) => {
        const value = t.instance
        const keys = Object.getOwnPropertyNames(value)
        let i = 0
        return new MultiReturn((ob, last) => {
            const k = keys[i]
            i = i + 1
            return k, ob[k]
        }, t, undefined)
    },
    __ipairs: (t) => {
        const value = t.instance

        const js_inext = (t, i) => {
            i = i + 1
            if (i >= value.length) {
                return undefined
            }
            return i, value[i]
        }

        return js_inext, value, -1
    },
    __eq: (t1, t2) => {
        return t1.instance === t2.instance
    },
}

module.exports = proxy
