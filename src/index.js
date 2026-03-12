import { LuaFactory, LuaEngine } from 'wasmoon'
import { createRequire } from 'module'
import { resolve } from 'path'
import FunctionClassTypeExtension from './legacyclasses.js'

export default class {
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
        try {
            const thread = this.#engine.global.newThread()
            thread.loadFile(file)

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

        this.#factory = new LuaFactory({ env: process.env, fs: 'node' })
        this.#engine = await this.#factory.createEngine({ injectObjects: true })

        const require = createRequire(process.cwd())

        this.#engine.global.registerTypeExtension(10, new FunctionClassTypeExtension)
        this.#engine.global.set('typeof', value => typeof value)
        this.#engine.global.set('instanceof', (value, type) => value instanceof type)
        this.#engine.global.set('new', (constructor, ...args) => new constructor(...args))
        this.#engine.global.set('global', global)
        this.#engine.global.set('jsRequire', (modulename, metaDirectory) => {
            if (metaDirectory && modulename.startsWith('.')) {
                modulename = resolve(metaDirectory, '..', modulename)
            }

            return require(modulename)
        })

        await this.#engine.doFile('/' + resolve(import.meta.dirname, 'std.lua').replace(/\\/g, '/'))
    }
}