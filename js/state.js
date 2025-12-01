import { CONSTANTS } from './constants.js';
import { createCache } from './cache.js';
import { VECTOR_CONSTANTS } from './constantsMSAExtension.js';

export const extensionFlags = {
    msaEnabled: false,
    mulDivEnabled: false,
    fpuEnabled: false,
    branchPredictionEnabled: false,
    cacheEnabled: false,
    pipelineEnabled: false,
    mips64Enabled: false
};





export const state = {
    // Memória Principal
    memory: new Uint8Array(CONSTANTS.MEMORY_SIZE).fill(0), //cada posicao, 1 byte (0-255)

    // Mapa da origem da instrução na memória (para debugging, não arquitetural)
    opcodeMap: new Array(CONSTANTS.MEMORY_SIZE).fill(null), 

    // CPU core
    pc: 0,                                              // program counter (em MIPS, conta em bytes e incrementa de 4 em 4)
    regs: new Array(CONSTANTS.REGISTER_COUNT).fill(0),  // 32 registradores gerais

    // registradores especiais HI/LO
    hi: 0,
    lo: 0,

    // registrador de pipeline
    pipeline: {
        cycle: CONSTANTS.NOP,
        IF_ID: { pc: null, instr: 0, decoded: null },
        ID_EX: { pc: null, decoded: null, rsVal: 0, rtVal: 0, imm: 0, writeReg: null, ctrl: {} },
        EX_MEM: { pc: null, decoded: null, aluRes: 0, rtVal: 0, writeReg: null, ctrl: {} },
        MEM_WB: { pc: null, decoded: null, aluRes: 0, memData: 0, writeReg: null, ctrl: {} }
        },

    // Coprocessador 0 (sistema) mínimo para futuro
    cop0: {
        status: 0,
        cause: 0,
        epc: 0,
        // no futuro: config, badvaddr, etc.  
    },

    // Extensão MSA, vetor 
    msa: { 
        enabled: false, // equivalente ao Config5.MSAEn
        // Vector registers
        vregs: Array.from({ length: VECTOR_CONSTANTS.VECTOR_REGISTER_COUNT }, () => new Int32Array(4)),
        vl: 4 //vector length 
    },

    // Controle de execução
    control: {
        running: false,           // se tá em run contínuo ou não
        halted: false,            // se encontrou HLT / break / fim do programa
        stepCount: 0,             // número de instruções já executadas
    },

    // Estatísticas de desempenho
    perf: {
        cycles: 0,
        instructions: 0,
        msaInstructions: 0,
        loads: 0,
        stores: 0,
        branches: 0,
    },

    // Debug/UI
    debug: {
        breakpoints: new Set(),   // PCs com breakpoint
        lastInstr: null,          // último decode (pra mostrar no UI)
        trace: [],                //  histórico resumido de execuções, para eventualmente poder voltar uma instrução, mostrar no UI "mudou de $t0 de 5 para 9", etc...
    },

    // Contadores de estatísticas
    lastTrace: '',
    

    // Caches (set-associative)
    iCache: createCache(CONSTANTS.I_CACHE_SIZE_BYTES, CONSTANTS.I_CACHE_BLOCK_SIZE, CONSTANTS.I_CACHE_ASSOCIATIVITY),
    dCache: createCache(CONSTANTS.D_CACHE_SIZE_BYTES, CONSTANTS.D_CACHE_BLOCK_SIZE, CONSTANTS.D_CACHE_ASSOCIATIVITY)
};
