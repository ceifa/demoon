const { LuaFactory, decorate } = require('wasmoon')
const path = require('path')
const { walk } = require('./file')
const fs = require('fs').promises
const proxy = require('./proxy')

const registerDirectory = async (factory, dir) => {
    for await (const file of walk(dir)) {
        await factory.mountFile(file, await fs.readFile(file))
    }
}

const start = async (entryFile) => {
    const factory = new LuaFactory()

    await factory.mountFile(path.resolve(process.cwd(), entryFile), await fs.readFile(entryFile))
    await registerDirectory(factory, path.resolve(__dirname, "std"))

    const lua = await factory.createEngine({ injectObjects: true })

    lua.global.set('new', constructor => new constructor)
    lua.global.set('global', decorate(global, {
        reference: true,
        metatable: proxy
    }))
    lua.global.set('mountFile', factory.mountFileSync.bind(factory))
    lua.global.set('jsRequire', (modulename, metaDirectory) => {
        if (modulename.startsWith('.')) {
            modulename = path.resolve(metaDirectory, '..', modulename)
        }

        return decorate(require(modulename), {
            reference: true,
            metatable: proxy
        })
    })

    const module = await factory.getModule()
    module.module.FS.chdir(process.cwd())

    await lua.doFile(path.resolve(__dirname, "std/main.lua"))
    await lua.doFile(entryFile)
}

module.exports = { start }