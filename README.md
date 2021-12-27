# demoon

You love Lua but the runtime API is very weak and you don't want to handle and learn a lot of different luarock libraries? You came at the right place! This project aims to offer the bests of **Lua** and **NodeJS** together.

## Usage

You don't need `lua` installed to run demoon, but you need `node` and npm as well, firstly, install demoon globally:

```sh
$: npm i -g demoon
```

Then run it passing your entry lua file:

```sh
$: demoon app.lua
```

## Example

This is a little sample code to demonstrate how demoon is powerful and bridges well with nodeJS:
```lua
-- you can require node modules (package.json/node_modules works as well)
local http = require('http')

-- you can require js modules and lua files
-- require('./myjsmodule.js')
-- require('./myluamodule.lua')

local port = os.getenv('PORT') or 8080

function sleep(ms)
    -- you can use and create promises
    return Promise.create(function(resolve)
        setTimeout(resolve, ms)
    end)
end

-- top level await works!
sleep(1000):await()

http.createServer(async(function (req, res)
    -- you can await inside async bounded functions
    sleep(1000):await()

    res:write('Hello World!')
    res['end']()
end)):listen(port)

print('Your server is running on port ' .. port .. '!')
```