return function(ms)
    return Promise.create(function(resolve)
        setTimeout(resolve, ms)
    end)
end