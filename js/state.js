import { CONSTANTS } from './constants.js';
import { createCache } from './cache.js';

export const state = {
    // Memória
    memory: new Uint8Array(CONSTANTS.MEMORY_SIZE).fill(0), //cada posicao, 1 byte (0-255)
    opcodeMap: new Array(CONSTANTS.MEMORY_SIZE).fill(null), // mapa de instruções na memória

    // CPU core
    pc: 0, // program counter (em MIPS, conta em bytes e incrementa de 4 em 4)

    // 32 registradores gerais
    regs: new Array(CONSTANTS.REGISTER_COUNT).fill(0),

    // registrador de pipeline
    pipeline: {
        cycle: CONSTANTS.NOP,
        IF_ID: { pc: null, instr: 0, decoded: null },
        ID_EX: { pc: null, decoded: null, rsVal: 0, rtVal: 0, imm: 0, writeReg: null, ctrl: {} },
        EX_MEM: { pc: null, decoded: null, aluRes: 0, rtVal: 0, writeReg: null, ctrl: {} },
        MEM_WB: { pc: null, decoded: null, aluRes: 0, memData: 0, writeReg: null, ctrl: {} }
        },

    // registradores especiais HI/LO
    hi: 0,
    lo: 0,

    // Contadores de estatísticas
    lastTrace: '',
    
    
    

    // Caches (set-associative)
    iCache: createCache(CONSTANTS.I_CACHE_SIZE_BYTES, CONSTANTS.I_CACHE_BLOCK_SIZE, CONSTANTS.I_CACHE_ASSOCIATIVITY),
    dCache: createCache(CONSTANTS.D_CACHE_SIZE_BYTES, CONSTANTS.D_CACHE_BLOCK_SIZE, CONSTANTS.D_CACHE_ASSOCIATIVITY)
};
