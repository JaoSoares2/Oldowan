/**
 * MIPSweb - Instruction Registry & Control Unit (Hardware-First)
 * * Simula as tabelas de verdade do hardware (Main Control e ALU Control).
 * Decodifica puramente baseada em Opcode e Funct (Bits), não em nomes.
 */

import { ISA, BASE_FORMAT, CONSTANTS } from './constants.js?v=5';
import { ALU_CODES } from './constantsALU.js?v=5';
import { getALUControl, ALU_OP } from './controlALU.js?v=5';
import { MDU_OPS } from './mdu.js?v=5';

const signExtend16 = (v) => (v << 16) >> 16;
const zeroExtend16 = (v) => v & 0xFFFF;

// MAIN CONTROL UNIT (Tabela de Verdade por OPCODE)
// Mapeia Opcode (0-63) -> Sinais de Controle
// Se um opcode não estiver aqui, assume-se sinais zerados (NOP/Illegal)
const MAIN_CONTROL_ROM = {
    // R-Type (Opcode 0)
    0: { regDst: 1, regWrite: 1, aluSrc: 0, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.R_TYPE },

    // Load/Store (todos os tamanhos)
    35: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 1, memWrite: 0, memToReg: 1, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.WORD, memSign: true }, // LW
    32: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 1, memWrite: 0, memToReg: 1, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.BYTE, memSign: true }, // LB
    33: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 1, memWrite: 0, memToReg: 1, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.HALF, memSign: true }, // LH
    36: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 1, memWrite: 0, memToReg: 1, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.BYTE, memSign: false }, // LBU
    37: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 1, memWrite: 0, memToReg: 1, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.HALF, memSign: false }, // LHU
    43: { regDst: 0, regWrite: 0, aluSrc: 1, branch: 0, memRead: 0, memWrite: 1, memToReg: 0, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.WORD, memSign: true }, // SW
    40: { regDst: 0, regWrite: 0, aluSrc: 1, branch: 0, memRead: 0, memWrite: 1, memToReg: 0, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.BYTE, memSign: true }, // SB
    41: { regDst: 0, regWrite: 0, aluSrc: 1, branch: 0, memRead: 0, memWrite: 1, memToReg: 0, aluOp: ALU_OP.MEM_ADD, memSize: CONSTANTS.MEM_SIZE.HALF, memSign: true }, // SH

    // I-Type Arithmetic (Opcode define a operação)
    8: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.ADD },  // ADDI
    9: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.ADDU }, // ADDIU
    10: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.SLT },  // SLTI
    11: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.SLTU }, // SLTIU
    12: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.AND, immType: 'zero' },  // ANDI
    13: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.OR, immType: 'zero' },   // ORI
    14: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.XOR, immType: 'zero' },  // XORI
    15: { regDst: 0, regWrite: 1, aluSrc: 1, branch: 0, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.I_TYPE, specificAlu: ALU_CODES.LUI_OP, immType: 'shift16' },// LUI

    // Branches
    4: { regDst: 0, regWrite: 0, aluSrc: 0, branch: 1, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.BRANCH, branchCond: 'eq' }, // BEQ
    5: { regDst: 0, regWrite: 0, aluSrc: 0, branch: 1, memRead: 0, memWrite: 0, memToReg: 0, aluOp: ALU_OP.BRANCH, branchCond: 'ne' }, // BNE

    // Jumps
    2: { jump: 1, regWrite: 0 }, // J
    3: { jump: 1, link: 1, regWrite: 1, regDst: 0 } // JAL (Dst fixo em 31 tratado no execution)
};

// --- CLASSE DO REGISTRADOR ---

class InstructionRegistry {
    constructor() {
        this.instructions = new Map(); // Mapa reverso (Mnemonic -> Info) para Assembler
        this.handlers = new Map();

        // Lookup Tables para decodificação rápida (simulando cache de decodificação)
        this.lookupTable = new Array(64).fill(null);
    }

    init() {
        console.log("[Registry] Initializing Hardware Control Units...");
        this.registerISA(ISA, BASE_FORMAT);
    }

    /**
     * O "Boot" da CPU. Lê a especificação ISA e preenche as tabelas.
     */
    registerISA(isaDefinitions, formats) {
        for (const [mnemonic, def] of Object.entries(isaDefinitions)) {
            const fmtDef = formats[def.format];
            if (!fmtDef) continue;

            const { mask, match } = this._computeMaskAndMatch(def.base, fmtDef.fields);

            // Armazena metadados para o Assembler e Debugger
            const entry = {
                mnemonic,
                format: def.format,
                syntax: def.syntax,
                fields: fmtDef.fields,
                match,
                mask,
                // Opcodes base para referência rápida
                opcode: def.base >>> 26,
                funct: def.base & 0x3F
            };

            this.instructions.set(mnemonic, entry);
            this._addToDecodeTable(entry);
        }
    }

    registerHandler(mnemonic, handlerFn) {
        this.handlers.set(mnemonic, handlerFn);
    }

    getSyntaxStrategy(mnemonic) {
        const entry = this.instructions.get(mnemonic);
        return entry ? entry.syntax : null;
    }
    /**
     * DECODIFICAÇÃO DINÂMICA (Por Ciclo)
     * * Simula o fluxo elétrico: Instruction Word -> Opcode -> Main Ctrl -> ALU Ctrl
     */
    decode(word) {
        word = word >>> 0;

        // 1. Splitter de Campos (Extração de bits)
        // Precisa saber o formato? No hardware real, extrai tudo em paralelo.
        // Aqui, faz o lookup para identificar a instrução base.
        const majorOp = (word >>> 26) & 0x3F;
        const potentialMatches = this.lookupTable[majorOp];
        if (!potentialMatches) return null;

        let instr = null;
        for (const candidate of potentialMatches) {
            if ((word & candidate.mask) === candidate.match) {
                instr = candidate;
                break;
            }
        }
        if (!instr) return null;

        // Extrai campos
        const decoded = {
            name: instr.mnemonic,
            format: instr.format,
            handler: this.handlers.get(instr.mnemonic) // Legado para execução JS
        };
        for (const [fName, info] of Object.entries(instr.fields)) {
            decoded[fName] = (word >>> info.pos) & ((1 << info.len) - 1);
        }

        // --- LÓGICA DE CONTROLE GENÉRICA (CONTROL UNIT) ---

        // A. Main Control (Lookup na ROM pelo Opcode)
        // Se opcode não está na ROM (ex: JALR, SPECIAL2), usa defaults ou lógica específica
        // Para JALR (Opcode 0, funct 9), o Main Control vê Opcode 0 (R-Type)
        // Mas JALR precisa de lógica de Jump. 
        // *Nota de Fidelidade*: No MIPS real, JALR é R-Type mas o Main Control lida diferente ou o Funct dispara sinais extras.
        // Para simplificar, assume que a ROM cobre os casos principais.

        let ctrl = { ...(MAIN_CONTROL_ROM[decoded.opcode] || {}) };

        // Tratamento especial para casos que o Opcode 0 não cobre sozinho (como JALR)
        if (decoded.opcode === 0 && decoded.funct === 9) {
            ctrl = { regDst: 1, regWrite: 1, aluSrc: 0, jump: 1, jumpReg: 1, link: 1, aluOp: ALU_OP.R_TYPE };
        }


        // Override para MULT/DIV (Não usam ALU, usam MDU)
        if (decoded.opcode === 0) {
            if (decoded.funct === 24) ctrl.mduOp = MDU_OPS.MULT;
            if (decoded.funct === 25) ctrl.mduOp = MDU_OPS.MULTU;
            if (decoded.funct === 26) ctrl.mduOp = MDU_OPS.DIV;
            if (decoded.funct === 27) ctrl.mduOp = MDU_OPS.DIVU;

            // MFHI/MFLO não usam ALU, são Move Instructions
            // Usa um sinal 'isHiLo' para o Execution Stage saber
            if (decoded.funct === 16) ctrl.isMFHI = true;
            if (decoded.funct === 18) ctrl.isMFLO = true;

            // Limpa sinais de ALU para essas instruções
            if (ctrl.mduOp || ctrl.isMFHI || ctrl.isMFLO) {
                ctrl.regWrite = (ctrl.mduOp) ? 0 : 1; // MULT não escreve em Reg, MFHI escreve
                ctrl.aluOp = undefined; // Desconecta da ALU
            }
        }

        // B. ALU Control Logic
        if (ctrl.aluOp !== undefined) {
            // Decodifica a operação da ALU
            ctrl.aluCode = getALUControl(ctrl.aluOp, decoded.funct, ctrl.specificAlu);

            // --- LÓGICA DO MUX DE SHIFT (shiftSrc) ---
            // Detecta se precisa usar 'shamt' como entrada A.
            // Regra: É R-Type? É operação de Shift (SLL/SRL/SRA)? O bit 2 do funct é 0 (Fixo)?

            const isShiftOp = (ctrl.aluCode === ALU_CODES.SLL ||
                ctrl.aluCode === ALU_CODES.SRL ||
                ctrl.aluCode === ALU_CODES.SRA);

            if (ctrl.aluOp === ALU_OP.R_TYPE && isShiftOp) {
                // Funct bit 2: 0=Fixo (SLL), 1=Variável (SLLV)
                if ((decoded.funct & 0x04) === 0) {
                    ctrl.shiftSrc = 1; // Ativa MUX para ler Shamt (Input A = Shamt)
                }
            }
        }

        // --- Extensão de Imediatos (fidelidade de sinal / zero-extend) ---
        if (decoded.imm !== undefined) {
            let extender = signExtend16;
            if (ctrl.immType === 'zero') extender = zeroExtend16;
            else if (ctrl.immType === 'shift16') extender = (v) => (v << 16) >> 0;
            decoded.imm = extender(decoded.imm);
        }

        // Condição de branch explícita (evita heurística no EX do pipeline)
        if (ctrl.branch) ctrl.branchCond = ctrl.branchCond || 'eq';
        if (ctrl.memRead || ctrl.memWrite) {
            ctrl.memSize = ctrl.memSize !== undefined ? ctrl.memSize : CONSTANTS.MEM_SIZE.WORD;
            ctrl.memSign = ctrl.memSign !== undefined ? ctrl.memSign : true;
        }

        decoded.ctrl = ctrl;
        decoded.asm = this.disassemble(decoded);
        return decoded;
    }

    disassemble(decoded) {
        const { name, format, rs, rt, rd, shamt, imm, target } = decoded;
        const rName = (i) => CONSTANTS.REGISTER_NAMES[i] || `$${i}`;
        const hex = (v) => '0x' + (v >>> 0).toString(16).toUpperCase();

        if (format === 'R') {
            if (name === 'SLL' || name === 'SRL' || name === 'SRA') {
                return `${name} ${rName(rd)}, ${rName(rt)}, ${shamt}`;
            }
            if (name === 'JR' || name === 'MTHI' || name === 'MTLO') {
                return `${name} ${rName(rs)}`;
            }
            if (name === 'MFHI' || name === 'MFLO') {
                return `${name} ${rName(rd)}`;
            }
            if (name === 'MULT' || name === 'MULTU' || name === 'DIV' || name === 'DIVU') {
                return `${name} ${rName(rs)}, ${rName(rt)}`;
            }
            if (name === 'SYSCALL') return name;
            // Standard R: ADD rd, rs, rt
            return `${name} ${rName(rd)}, ${rName(rs)}, ${rName(rt)}`;
        }
        if (format === 'I') {
            if (name === 'LUI') return `${name} ${rName(rt)}, ${hex(imm)}`;
            if (['LW', 'SW', 'LB', 'SB', 'LH', 'SH', 'LBU', 'LHU'].includes(name)) {
                return `${name} ${rName(rt)}, ${imm}(${rName(rs)})`;
            }
            if (name === 'BEQ' || name === 'BNE') {
                // Branch target is mostly relative in asm, but here we have immediate offset
                return `${name} ${rName(rs)}, ${rName(rt)}, ${imm}`;
            }
            if (name === 'BLEZ' || name === 'BGTZ') {
                return `${name} ${rName(rs)}, ${imm}`;
            }
            // Standard I: ADDI rt, rs, imm
            return `${name} ${rName(rt)}, ${rName(rs)}, ${imm}`;
        }
        if (format === 'J') {
            return `${name} ${hex(target)}`;
        }
        return name;
    }


    // --- Helpers de Inicialização ---
    _computeMaskAndMatch(base, fields) {
        let mask = 0;
        let match = base >>> 0;
        // Campos variáveis não entram no mask; opcode permanece para preservar bits fixos no match.
        const OP_FIELDS = new Set(['rs', 'rt', 'rd', 'shamt', 'imm', 'target']);
        for (const [name, info] of Object.entries(fields)) {
            if (!OP_FIELDS.has(name)) {
                mask |= (((1 << info.len) - 1) << info.pos);
            }
        }
        return { mask: mask >>> 0, match: (match & mask) >>> 0 };
    }

    _addToDecodeTable(instr) {
        const op = instr.opcode; // Já extraído no init
        if (!this.lookupTable[op]) this.lookupTable[op] = [];
        this.lookupTable[op].push(instr);
    }
}

export const registry = new InstructionRegistry();
try {
    registry.init();
    console.log("[InstructionRegistry] Auto-initialized successfully.");
} catch (e) {
    console.error("[InstructionRegistry] Auto-initialization failed:", e);
}
