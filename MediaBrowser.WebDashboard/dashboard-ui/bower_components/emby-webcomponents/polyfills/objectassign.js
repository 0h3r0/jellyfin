"function" != typeof Object.assign && function() {
    Object.assign = function(target) {
        "use strict";
        if (void 0 === target || null === target) throw new TypeError("Cannot convert undefined or null to object");
        for (var output = Object(target), index = 1; index < arguments.length; index++) {
            var source = arguments[index];
            if (void 0 !== source && null !== source)
                for (var nextKey in source) source.hasOwnProperty(nextKey) && (output[nextKey] = source[nextKey])
        }
        return output
    }
}();