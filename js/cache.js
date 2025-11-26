function toInt(value) {
    return value | 0;
}

export function createCache(totalBytes, blockSize, associativity) {
    const sets = Math.max(1, Math.floor(totalBytes / (blockSize * associativity)));

    const cache = {
        totalBytes,
        blockSize,
        associativity,
        sets,
        hits: 0,
        misses: 0,
        tick: 0,
        data: [],
        lastAccess: null
    };

    for (let i = 0; i < sets; i++) {
        const ways = [];
        for (let w = 0; w < associativity; w++) { 
            ways.push({
                valid: false,
                tag: 0,
                lru: 0,
                data: new Uint8Array(blockSize)
            });
        }
        cache.data.push(ways);
    }
    return cache;
}

function pickWay(set) {
    // escolhe uma way inválida, senão a com lru mínima (LRU)
    let victim = set[0];
    let victimIdx = 0;
    let idx = 0;
    for (const way of set) {
        if (!way.valid) return { way, index: idx };
        if (way.lru < victim.lru) {
            victim = way;
            victimIdx = idx;
        }
        idx++;
    }
    return { way: victim, index: victimIdx };
}

function getIndexTagOffset(cache, address) {
    const blockNumber = Math.floor(address / cache.blockSize);
    const index = blockNumber % cache.sets;
    const tag = Math.floor(blockNumber / cache.sets);
    const blockOffset = address % cache.blockSize;
    const blockStart = address - blockOffset;
    return { index, tag, blockOffset, blockStart };
}

export function cacheLoadByte(cache, memory, address) {
    const { index, tag, blockOffset, blockStart } = getIndexTagOffset(cache, address);
    const set = cache.data[index];
    cache.tick++;

    for (let i = 0; i < set.length; i++) {
        const way = set[i];
        if (way.valid && way.tag === tag) {
            cache.hits++;
            way.lru = cache.tick;
            cache.lastAccess = { type: 'load', address, index, tag, blockOffset, blockStart, hit: true, way: i };
            return way.data[blockOffset];
        }
    }

    cache.misses++;
    const picked = pickWay(set);
    const victim = picked.way;
    for (let i = 0; i < cache.blockSize; i++) {
        victim.data[i] = memory[blockStart + i] ?? 0;
    }
    victim.tag = tag;
    victim.valid = true;
    victim.lru = cache.tick;
    cache.lastAccess = { type: 'load', address, index, tag, blockOffset, blockStart, hit: false, way: picked.index };
    return victim.data[blockOffset];
}

export function cacheStoreByte(cache, memory, address, value, writeAllocate = true) {
    value = toInt(value) & 0xFF;
    const { index, tag, blockOffset, blockStart } = getIndexTagOffset(cache, address);
    const set = cache.data[index];
    cache.tick++;

    for (let i = 0; i < set.length; i++) {
        const way = set[i];
        if (way.valid && way.tag === tag) {
            cache.hits++;
            way.data[blockOffset] = value;
            way.lru = cache.tick;
            memory[address] = value;
            cache.lastAccess = { type: 'store', address, index, tag, blockOffset, blockStart, hit: true, way: i };
            return;
        }
    }

    cache.misses++;
    memory[address] = value;
    if (!writeAllocate) return;

    const picked = pickWay(set);
    const victim = picked.way;
    for (let i = 0; i < cache.blockSize; i++) {
        victim.data[i] = memory[blockStart + i] ?? 0;
    }
    victim.data[blockOffset] = value;
    victim.tag = tag;
    victim.valid = true;
    victim.lru = cache.tick;
    cache.lastAccess = { type: 'store', address, index, tag, blockOffset, blockStart, hit: false, way: picked.index };
}

export function resetCache(cache) {
    cache.hits = 0;
    cache.misses = 0;
    cache.tick = 0;
    cache.lastAccess = null;
    for (const set of cache.data) {
        for (const way of set) {
            way.valid = false;
            way.tag = 0;
            way.lru = 0;
            way.data.fill(0);
        }
    }
}
