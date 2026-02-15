import { state } from './state.js?v=5';
import { CONSTANTS } from './constants.js?v=5';
import { cacheLoadByte, cacheStoreByte } from './cache.js?v=5';

// Wrapper para acesso via DataView
// O DataView exige um ArrayBuffer. Como a memória é Uint8Array, é usado state.memory.buffer.
// Nota: O offset do DataView deve ser absoluto no buffer.

const view = new DataView(state.memory.buffer);
const isBigEndian = true; // MIPS padrão é Big Endian

// Verifica alinhamento e lança exceção (Hardware Behavior)
function checkAlignment(addr, size) {
    if (addr % size !== 0) {
        throw new Error(`Address Error: Unaligned access at 0x${addr.toString(16)} for size ${size}`);
    }
}

// --- Leitura (Load) ---

export function loadByte(addr) {
    // Byte não tem problema de alinhamento ou endianness no load simples,
    // mas passa pela cache para estatística
    const val = cacheLoadByte(state.dCache, state.memory, addr);
    // Sign-extend manual é rápido para 8 bits, ou usamos DataView:
    return (val << 24) >> 24;
}

export function loadByteUnsigned(addr) {
    return cacheLoadByte(state.dCache, state.memory, addr) & 0xFF;
}

export function loadHalfword(addr) {
    checkAlignment(addr, 2);
    // Sincroniza cache (simulação)
    cacheLoadByte(state.dCache, state.memory, addr);
    cacheLoadByte(state.dCache, state.memory, addr + 1);

    // Leitura real via DataView
    return view.getInt16(addr, isBigEndian);
}

export function loadHalfwordUnsigned(addr) {
    checkAlignment(addr, 2);
    cacheLoadByte(state.dCache, state.memory, addr);
    cacheLoadByte(state.dCache, state.memory, addr + 1);

    return view.getUint16(addr, isBigEndian);
}

export function loadWord(addr) {
    checkAlignment(addr, 4);
    // Simula acesso à cache para os 4 bytes (para contar hits/misses)
    for (let i = 0; i < 4; i++) cacheLoadByte(state.dCache, state.memory, addr + i);

    return view.getInt32(addr, isBigEndian);
}

// Preparado para MIPS64 (future-proof)
export function loadDoubleword(addr) {
    checkAlignment(addr, 8);
    for (let i = 0; i < 8; i++) cacheLoadByte(state.dCache, state.memory, addr + i);

    return view.getBigInt64(addr, isBigEndian);
}

// --- Escrita (Store) ---

export function storeByte(addr, value) {
    // Cache write-through simulation inside cacheStoreByte
    cacheStoreByte(state.dCache, state.memory, addr, value, true);
    // O DataView atualiza o buffer subjacente automaticamente
}

export function storeHalfword(addr, value) {
    checkAlignment(addr, 2);
    // Atualiza cache line e memória
    const v = value & 0xFFFF;
    // Precisa escrever byte a byte para acionar a lógica de cache simulation
    // OU atualiza memória via view e apenas "avisamos" a cache.
    // Para manter fidelidade da cache.js atual:
    //TODO: fazer isso mais eficiente e fidedigno
    if (isBigEndian) {
        cacheStoreByte(state.dCache, state.memory, addr, (v >>> 8) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 1, v & 0xFF, true);
    } else {
        cacheStoreByte(state.dCache, state.memory, addr, v & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 1, (v >>> 8) & 0xFF, true);
    }
}

export function storeWord(addr, value) {
    checkAlignment(addr, 4);
    const v = value | 0;

    // Atualiza memória e cache simulada
    if (isBigEndian) {
        cacheStoreByte(state.dCache, state.memory, addr, (v >>> 24) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 1, (v >>> 16) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 2, (v >>> 8) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 3, v & 0xFF, true);
    } else {
        // Little Endian logic (se configurado futuramente)
        cacheStoreByte(state.dCache, state.memory, addr, v & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 1, (v >>> 8) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 2, (v >>> 16) & 0xFF, true);
        cacheStoreByte(state.dCache, state.memory, addr + 3, (v >>> 24) & 0xFF, true);
    }
}

// Acesso bruto para o Loader (sem cache ticks)
export function storeWordRaw(addr, value) {
    // Usa DataView direto para velocidade no load
    view.setInt32(addr, value, isBigEndian);
}