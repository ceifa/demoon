-- async function to bound awaits
function async(callback)
    return function(...)
        local varargs = {...}

        return Promise.create(function(resolve, reject)
            local co = coroutine.create(function()
                local safe, args = pcall(callback, table.unpack(varargs))

                if safe then
                    resolve(args)
                else
                    reject(args)
                end
            end)

            function tick()
                local status = coroutine.status(co)

                if status == "suspended" then
                    coroutine.resume(co)
                    setImmediate(tick)
                end
            end

            tick()
        end)
    end
end

-- package searcher to handle lua files on the fly
table.insert(package.searchers, function(moduleName)
    if moduleName:sub(-4) == ".lua" then
        local path = jsRequire("path")
        local fs = jsRequire("fs")

        local calledDirectory = debug.getinfo(3).short_src
        local luafile = path.resolve(calledDirectory, "..", moduleName)

        local success, content = pcall(fs.readFileSync, luafile)
        if success and content then
            mountFile(luafile, content)
            return loadfile(luafile)
        end
    end
end)

-- package searcher to handle JS modules
table.insert(package.searchers, function(moduleName)
    local success, result = pcall(jsRequire, moduleName, debug.getinfo(3).short_src)
    if success then return function() return result end end
end)

-- replace the origin getenv by the nodejs one
function os.getenv(varname)
    return process.env[varname]
end

-- set the nodejs global as fallback to default lua global
setmetatable(_G, {
    __index = function(t, k) return global[k] end
})