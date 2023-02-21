const { LuaFactory, LuaEngine } = require('wasmoon')
const path = require('path')
const FunctionClassTypeExtension = require('./legacyclasses')
const fs = require('fs/promises')

module.exports = class {
    /** @returns {Promise<LuaEngine>} */
    async getLuaEngine() {
        await this.#setupIfNeeded()
        return this.#engine
    }

    /**
     *  @param {string} file
     *  @returns {Promise<void>}
    */
    async runFile(file) {
        await this.#setupIfNeeded()

        this.#factory.mountFileSync(await this.#factory.getLuaModule(), file, await fs.readFile(file))

        try {
            const thread = this.#engine.global.newThread()
            thread.loadFile(file)

            this.#engine.global.set('jsRequire', (modulename, metaDirectory) => {
                if (metaDirectory) {
                    if (modulename.startsWith('.')) {
                        modulename = path.resolve(metaDirectory, '..', modulename)
                    }

                    modulename = require.resolve(modulename, { paths: [file] })
                }

                return module.require(modulename)
            })

            await thread.run(0)
        } catch (e) {
            console.error(e)
        }
    }

    /** @type {LuaEngine | undefined} */
    #engine

    /** @type {LuaFactory | undefined} */
    #factory

    async #setupIfNeeded() {
        if (this.#factory) return

        this.#factory = new LuaFactory(undefined, process.env)
        const luamodule = await this.#factory.getLuaModule()

        const fullStdFile = path.resolve(__dirname, "std.lua")
        this.#factory.mountFileSync(luamodule, fullStdFile, await fs.readFile(fullStdFile))

        this.#engine = await this.#factory.createEngine({ injectObjects: true })

        this.#engine.global.registerTypeExtension(10, new FunctionClassTypeExtension)
        this.#engine.global.set('typeof', value => typeof value)
        this.#engine.global.set('instanceof', (value, type) => value instanceof type)
        this.#engine.global.set('new', (constructor, ...args) => new constructor(...args))
        this.#engine.global.set('global', global)
        this.#engine.global.set('mountFile', (path, content) => this.#factory.mountFileSync(luamodule, path, content))
        this.#engine.global.set('jsRequire', (modulename, metaDirectory) => {
            if (metaDirectory) {
                if (modulename.startsWith('.')) {
                    modulename = path.resolve(metaDirectory, '..', modulename)
                }

                modulename = require.resolve(modulename)
            }

            return module.require(modulename)
        })
        this.#engine.doFileSync(fullStdFile)
    }
}