local path = jsRequire("path")
local fs = jsRequire("fs")

-- async function to bound awaits
function async(callback)
    return function(...)
        local co = coroutine.create(callback)
        local safe, result = coroutine.resume(co, ...)

        return Promise.create(function(resolve, reject)
            local function step()
                if coroutine.status(co) == "dead" then
                    local send = safe and resolve or reject
                    return send(result)
                end

                safe, result = coroutine.resume(co)

                if safe and result == Promise.resolve(result) then
                    result:finally(step)
                else
                    step()
                end
            end

            result:finally(step)
        end)
    end
end

-- package searcher to handle lua files on the fly
table.insert(package.searchers, function(moduleName)
    if moduleName:sub(-4) == ".lua" then
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

-- set the nodejs global as fallback to default lua global
setmetatable(_G, {
    __index = function(t, k) return global[k] end
})