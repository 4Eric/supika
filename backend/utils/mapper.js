const cache = {};

const toCamelCase = (snakeStr) => {
    if (cache[snakeStr]) return cache[snakeStr];
    const camelStr = snakeStr.replace(/(_\w)/g, (m) => m[1].toUpperCase());
    cache[snakeStr] = camelStr;
    return camelStr;
};

const mapToCamelCase = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(v => mapToCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = toCamelCase(key);
            acc[camelKey] = mapToCamelCase(obj[key]);
            return acc;
        }, {});
    }
    return obj;
};

module.exports = { mapToCamelCase };
