
export function loadByte(addr) {
    const b = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    return (b << 24) >> 24;
}

export function loadByteUnsigned(addr) {
    return cacheLoadByte(state.dCache, state.memory, addr) | 0;
}

export function storeByte(addr, value) {
    cacheStoreByte(state.dCache, state.memory, addr, value, true);
}

export function loadHalfword(addr) {
    if (addr & 1) throw new Error("Unaligned halfword load");
    const b0 = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    const b1 = cacheLoadByte(state.dCache, state.memory, addr + 1) | 0;
    let hw = (b0 << 8) | b1;
    hw = (hw << 16) >> 16;
    return hw;
}

export function loadHalfwordUnsigned(addr) {
    if (addr & 1) throw new Error("Unaligned halfword load");
    const b0 = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    const b1 = cacheLoadByte(state.dCache, state.memory, addr + 1) | 0;
    return ((b0 << 8) | b1) & 0xFFFF;
}

export function storeHalfword(addr, value) {
    if (addr & 1) throw new Error("Unaligned halfword store");
    cacheStoreByte(state.dCache, state.memory, addr,     (value >> 8) & 0xFF, true);
    cacheStoreByte(state.dCache, state.memory, addr + 1, (value >> 0) & 0xFF, true);
}

export function loadWord(addr) {
    if (addr & 3) throw new Error("Unaligned word load");
    const b0 = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    const b1 = cacheLoadByte(state.dCache, state.memory, addr + 1) | 0;
    const b2 = cacheLoadByte(state.dCache, state.memory, addr + 2) | 0;
    const b3 = cacheLoadByte(state.dCache, state.memory, addr + 3) | 0;
    return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) | 0;
}

export function storeWord(addr, value) {
    if (addr & 3) throw new Error("Unaligned word store");
    cacheStoreByte(state.dCache, state.memory, addr,     (value >>> 24) & 0xFF, true);
    cacheStoreByte(state.dCache, state.memory, addr + 1, (value >>> 16) & 0xFF, true);
    cacheStoreByte(state.dCache, state.memory, addr + 2, (value >>> 8)  & 0xFF, true);
    cacheStoreByte(state.dCache, state.memory, addr + 3, (value >>> 0)  & 0xFF, true);
}



export function storeWordRaw(addr, value) {
    if (addr & 3) throw new Error("Unaligned word store");
    const m = state.memory;
    m[addr]     = (value >>> 24) & 0xFF;
    m[addr + 1] = (value >>> 16) & 0xFF;
    m[addr + 2] = (value >>> 8)  & 0xFF;
    m[addr + 3] = (value >>> 0)  & 0xFF;
}

