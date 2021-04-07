const { decorate } = require('wasmoon')

const keywords = [
    "and", "break", "do", "else", "elseif",
    "end", "false", "for", "function", "goto", "if",
    "in", "local", "nil", "not", "or", "repeat",
    "return", "then", "true", "until", "while"
]

const proxy = {
    __index: (t, k) => {
        let value = t[k]

        if (value === undefined && typeof k === 'string') {
            const possibleExpectedKey = k.substring(1)
            if (keywords.includes(possibleExpectedKey) && t[possibleExpectedKey]) {
                value = t[possibleExpectedKey]
            }
        }

        if (['object', 'function'].includes(typeof value)) {
            if (typeof value === 'function') {
                value.__lua_self = t
            }

            return decorate(value, { reference: true, metatable: proxy })
        }

        return value
    },
    __newindex: (t, k, v) => {
        t[k] = v
    },
    __call: (t, ...args) => {
        // Called with the : syntax, let's bind this
        if (args[0] === t.__lua_self) {
            t = t.bind(t.__lua_self)
            delete args[0]
            args = args.slice(1)
        }

        args = args.map(arg => {
            if (typeof arg === 'function') {
                return (...luaFunctionArgs) => {
                    const fixedLuaFunctionArgs = luaFunctionArgs.map(luaFunctionArg => {
                        if (['object', 'function'].includes(typeof luaFunctionArg)) {
                            return decorate(luaFunctionArg, { reference: true, metatable: proxy })
                        }

                        return luaFunctionArg
                    })

                    return arg(...fixedLuaFunctionArgs)
                }
            }

            return arg
        })

        delete t.__lua_self

        const value = t(...args)

        if (['object', 'function'].includes(typeof value) && value !== Promise.resolve(value)) {
            return decorate(value, { reference: true, metatable: proxy })
        }

        return value
    },
    __tostring: (t) => {
        const value = t
        return value.toString?.() ?? typeof value
    },
    __len: (t) => {
        return t.lenght ?? 0
    },
    __pairs: (t) => {
        const value = t
        const keys = Object.getOwnPropertyNames(value)
        let i = 0
        return new MultiReturn((ob, last) => {
            const k = keys[i]
            i = i + 1
            return k, ob[k]
        }, t, undefined)
    },
    __ipairs: (t) => {
        const value = t

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
        return t1 === t2
    },
}

module.exports = proxy