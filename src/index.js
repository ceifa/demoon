const { LuaFactory } = require('wasmoon')
const path = require('path')
const fs = require('fs').promises

const start = async (entryFile) => {
    const factory = new LuaFactory(undefined, process.env)

    const fullEntryFile = path.resolve(process.cwd(), entryFile)
    const fullStdFile = path.resolve(__dirname, "std.lua")

    await factory.mountFile(fullEntryFile, await fs.readFile(fullEntryFile))
    await factory.mountFile(fullStdFile, await fs.readFile(fullStdFile))

    const engine = await factory.createEngine({ injectObjects: true })

    engine.global.set('typeof', value => typeof value)
    engine.global.set('instanceof', (value, type) => value instanceof type)
    engine.global.set('new', (constructor, ...args) => new constructor(...args))
    engine.global.set('global', global)
    engine.global.set('mountFile', factory.mountFileSync.bind(factory))
    engine.global.set('jsRequire', (modulename, metaDirectory) => {
        if (modulename.startsWith('.')) {
            modulename = path.resolve(metaDirectory, '..', modulename)
        }

        return require(modulename)
    })

    try {
        engine.doFileSync(fullStdFile)
    
        const thread = engine.global.newThread()
        thread.loadFile(fullEntryFile)
    
        await thread.run(0)
    } catch (e) {
        console.error(e)
    }
}

module.exports = { start }