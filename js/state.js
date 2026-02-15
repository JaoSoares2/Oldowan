import { CONSTANTS } from './constants.js?v=4';
import { createCache } from './cache.js?v=4';
import { VECTOR_CONSTANTS } from './constantsMSAExtension.js?v=4';

// Função auxiliar para criar um estado de controle vazio (evita undefined)
const emptyCtrl = () => ({
    regDst: 0, regWrite: 0, aluSrc: 0, shiftSrc: 0,
    branch: 0, jump: 0, jumpReg: 0, link: 0,
    memRead: 0, memWrite: 0, memToReg: 0,
    aluCode: 0,
    memSize: CONSTANTS.MEM_SIZE.WORD,
    memSign: true,
    branchCond: 'eq'
});

export const state = {

    // Memória Principal
    memory: new Uint8Array(CONSTANTS.MEMORY_SIZE),

    // CPU core
    pc: 0,
    regs: new Int32Array(CONSTANTS.REGISTER_COUNT),
    // Registradores Especiais
    hi: 0,
    lo: 0,

    // Estado de Controle de Fluxo
    branchState: {
        pending: false,
        target: 0,
        delaySlotHold: false
    },


    // Estado de Pipeline
    pipeline: {
        cycle: 0,
        // Estes objetos representam os registradores físicos entre os estágios
        registers: {
            // Fetch -> Decode
            IF_ID: {
                pc: 0,      // PC+4 da instrução
                instr: 0,   // A palavra da instrução (32 bits)
                valid: false // Indica se há uma instrução válida aqui (Bubble/Stall)
            },

            // Decode -> Execute
            ID_EX: {
                pc: 0,
                rsVal: 0,   // Valor lido de RS
                rtVal: 0,   // Valor lido de RT
                imm: 0,     // Imediato extendido
                shamt: 0,   // Shift amount
                rs: 0, rt: 0, rd: 0, // Endereços dos registradores (para Hazard Unit)
                ctrl: emptyCtrl(),   // Sinais de Controle propagados
                valid: false,
                name: '', // Nome da Instrução (para UI)
                asm: '' // Full Assembly string
            },

            // Execute -> Memory
            EX_MEM: {
                aluResult: 0, // Resultado da ALU ou Endereço de Memória
                writeData: 0, // Valor de RT para escrita na memória (Store)
                destReg: 0,   // Registrador de destino final (já escolhido entre rt/rd/$ra)
                ctrl: emptyCtrl(), // Sinais (apenas MemRead, MemWrite, RegWrite, MemToReg importam aqui)
                valid: false,
                name: '',
                asm: ''
            },

            // Memory -> WriteBack
            MEM_WB: {
                memData: 0,   // Dado lido da memória
                aluResult: 0, // Pass-through do resultado da ALU
                destReg: 0,   // Registrador de destino
                ctrl: emptyCtrl(), // Sinais (apenas RegWrite, MemToReg)
                valid: false,
                name: '',
                asm: ''
            }
        }
    },
    // Extensão MSA
    msa: {
        enabled: false,
        vregs: Array.from({ length: VECTOR_CONSTANTS.VECTOR_REGISTER_COUNT }, () => new Int32Array(4)),
        vl: 4
    },

    // Controle de execução/Debug
    control: {
        running: false,
        halted: false,
        stepCount: 0,
    },

    perf: { cycles: 0, instructions: 0, flushes: 0, stalls: 0 },

    // Caches
    iCache: createCache(CONSTANTS.I_CACHE_SIZE_BYTES, CONSTANTS.I_CACHE_BLOCK_SIZE, CONSTANTS.I_CACHE_ASSOCIATIVITY),
    dCache: createCache(CONSTANTS.D_CACHE_SIZE_BYTES, CONSTANTS.D_CACHE_BLOCK_SIZE, CONSTANTS.D_CACHE_ASSOCIATIVITY),

    // Configurações de Hardware (Jumpers virtuais)
    config: {
        msaEnabled: false,      // Ativa extensão MSA
        delaySlot: true,        // TRUE: Comportamento MIPS Clássico (Executa instr após branch). FALSE: Flush imediato (Mars/Spim default)
        forwarding: true,       // TRUE: Ativa Data Forwarding Unit. FALSE: Pipeline precisa de stalls manuais (bolhas)
        hazardDetection: true   // TRUE: Interlocks de Load-Use. FALSE: Responsabilidade do programador (NOPs)
    },

    lastTrace: ''
};
