-- you can require JS module files
local jssleep = require('./sleep.js')
-- you can require node modules
local http = require('http')
-- you can require Lua files
local luasleep = require('sleep.lua')

local port = os.getenv('PORT') or 8080

-- yes, we have top level await
luasleep(1000):await()

-- create a server object:
http.createServer(async(function (req, res)
    -- you can await inside async bounded functions
    jssleep(1000):await()

    res:write('Hello World!'); -- write a response to the client
    -- because end is a lua keyword you have to put the '_'
    res:_end(); -- end the response
end)):listen(port); -- the server object listens on port 8080

print('Your server is running on port ' .. port .. '!')