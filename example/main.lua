#!/usr/bin/env demoon
-- you can require node modules (package.json/node_modules works as well)
local http = require('http')

-- you can require js modules and lua files
local jssleep = require('./sleep.js')
local luasleep = require('sleep.lua')

local port = os.getenv('PORT') or 8080

-- top level await works!
luasleep(1000):await()

http.createServer(async(function (req, res)
    -- you can await inside async bounded functions
    jssleep(1000):await()

    res:write('Hello World!');
    res['end']();
end)):listen(port);

print('Your server is running on port ' .. port .. '!')