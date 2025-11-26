import { CONSTANTS } from './constants.js';
import { state } from './state.js';
import { assemble } from './assembler.js';
import { cacheLoadByte, cacheStoreByte, resetCache } from './cache.js';

const SP = 29; // índice do registrador $sp

// Inicialização da CPU / zera tudo
export function initCpu() {
    // Zera tudo
    state.pc = 0;
    state.regs.fill(0);
    state.regs[0] = 0; // $zero sempre 0
    state.hi = 0;
    state.lo = 0;
    state.pipeline.cycle = 0;
    state.pipeline.IF_ID = { pc: CONSTANTS.NOP, instr: 0, decoded: CONSTANTS.NOP };
    state.pipeline.ID_EX = { pc: CONSTANTS.NOP, decoded: CONSTANTS.NOP, rsVal: 0, rtVal: 0, imm: 0, writeReg: null, ctrl: {} };
    state.pipeline.EX_MEM = { pc: CONSTANTS.NOP, decoded: CONSTANTS.NOP, aluRes: 0, rtVal: 0, writeReg: null, ctrl: {} };
    state.pipeline.MEM_WB = { pc: CONSTANTS.NOP, decoded: CONSTANTS.NOP, aluRes: 0, memData: 0, writeReg: null, ctrl: {} };
    resetCache(state.iCache);
    resetCache(state.dCache);

    // Topo da stack = final da memória, alinhado a 4 bytes
    const topOfStack = CONSTANTS.MEMORY_SIZE & ~3; // limpa os 2 últimos bits
    state.regs[SP] = topOfStack;
}

// Construção das tabelas de decodificação 
const R_TABLE = {};        // R_TABLE[opcode][funct] = { name, info }
const OPCODE_TABLE = {};   // OPCODE_TABLE[opcode] = { name, info }

// Preenche as tabelas
for (const [name, info] of Object.entries(CONSTANTS.ISA)) {
    if (info.type === "R") {
        if (!R_TABLE[info.opcode]) {
            R_TABLE[info.opcode] = {};
        }
        R_TABLE[info.opcode][info.funct] = { name, ...info };
    } else {
        // I ou J: mapeia pelo opcode
        OPCODE_TABLE[info.opcode] = { name, ...info };
    }
}

// Função auxiliar para escrever em um registrador (com proteção do $zero)
function writeRegister(index, value) {
    if (index === 0) return; // $zero não pode ser modificado
    state.regs[index] = value | 0; // força 32 bits signed
}

function regVal(i) {
    const v = state.regs[i];
    return v == null ? 0 : v | 0;
}

function regName(i) {
    return CONSTANTS.REGISTER_NAMES[i] || `$${i}`;
}

function formatHex(v) {
    return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// Decodificação de instruções
function decodeRawFields(instr) {
    const opcode = (instr >>> 26) & 0x3F; // 6 bits

    if (opcode === 0) {
        // R-type
        const rs    = (instr >>> 21) & 0x1F;
        const rt    = (instr >>> 16) & 0x1F;
        const rd    = (instr >>> 11) & 0x1F;
        const shamt = (instr >>>  6) & 0x1F;
        const funct = (instr       ) & 0x3F;

        return { format: "R", opcode, rs, rt, rd, shamt, funct };
    } else if (opcode === 2 || opcode === 3) {
        // J-type
        const target = instr & 0x03FFFFFF;
        return { format: "J", opcode, target };
    } else {
        // I-type
        const rs   = (instr >>> 21) & 0x1F;
        const rt   = (instr >>> 16) & 0x1F;
        let imm16  = instr & 0xFFFF;
        // sign-extend
        if (imm16 & 0x8000) imm16 |= 0xFFFF0000;
        return { format: "I", opcode, rs, rt, imm16 };
    }
}

// Decodificação completa da instrução
function decodeInstruction(instr) {
    const raw = decodeRawFields(instr);

    if (raw.format === "R") {
        const entry = R_TABLE[raw.opcode]?.[raw.funct];
        if (!entry) throw new Error(`R-type desconhecida: opcode=${raw.opcode}, funct=${raw.funct}`);

        return {
            ...raw,
            name: entry.name,
            type: entry.type  // "R"
        };
    } else {
        const entry = OPCODE_TABLE[raw.opcode];
        if (!entry) throw new Error(`Instr desconhecida: opcode=${raw.opcode}`);

        return {
            ...raw,
            name: entry.name,
            type: entry.type  // "I" ou "J"
        };
    }
}


// Carrega um programa na memória a partir de um array de palavras (32 bits)
export function loadProgram(words) { // words = array de instruções de 32 bits
    let addr = 0;
    for (const w of words) {
        storeWordRaw(addr, w);
        addr += 4;
    }
    state.pc = 0;
    resetCache(state.iCache);
    resetCache(state.dCache);
    state.lastTrace = '';
}


// Busca a próxima instrução na I-cache
function fetchInstruction() {
    const pc = state.pc;
    if (pc & 3) throw new Error('Unaligned PC');

    const b0 = cacheLoadByte(state.iCache, state.memory, pc) | 0;
    const b1 = cacheLoadByte(state.iCache, state.memory, pc + 1) | 0;
    const b2 = cacheLoadByte(state.iCache, state.memory, pc + 2) | 0;
    const b3 = cacheLoadByte(state.iCache, state.memory, pc + 3) | 0;
    const instr = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) | 0;

    console.log('FETCH PC', pc, 'instr', instr.toString(16), 'I$', state.iCache.lastAccess);
    state.pc = (pc + 4) | 0;
    return instr;
}

function loadByte(addr) {
    const b = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    return (b << 24) >> 24;
}

function loadByteUnsigned(addr) {
    return cacheLoadByte(state.dCache, state.memory, addr) | 0;
}

function storeByte(addr, value) {
    cacheStoreByte(state.dCache, state.memory, addr, value, true);
}

function loadHalfword(addr) {
    if (addr & 1) throw new Error("Unaligned halfword load");
    const b0 = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    const b1 = cacheLoadByte(state.dCache, state.memory, addr + 1) | 0;
    let hw = (b0 << 8) | b1;
    hw = (hw << 16) >> 16;
    return hw;
}

function loadHalfwordUnsigned(addr) {
    if (addr & 1) throw new Error("Unaligned halfword load");
    const b0 = cacheLoadByte(state.dCache, state.memory, addr) | 0;
    const b1 = cacheLoadByte(state.dCache, state.memory, addr + 1) | 0;
    return ((b0 << 8) | b1) & 0xFFFF;
}

function storeHalfword(addr, value) {
    if (addr & 1) throw new Error("Unaligned halfword store");
    cacheStoreByte(state.dCache, state.memory, addr,     (value >> 8) & 0xFF, true);
    cacheStoreByte(state.dCache, state.memory, addr + 1, (value >> 0) & 0xFF, true);
}

function loadWord(addr) {
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



function storeWordRaw(addr, value) {
    if (addr & 3) throw new Error("Unaligned word store");
    const m = state.memory;
    m[addr]     = (value >>> 24) & 0xFF;
    m[addr + 1] = (value >>> 16) & 0xFF;
    m[addr + 2] = (value >>> 8)  & 0xFF;
    m[addr + 3] = (value >>> 0)  & 0xFF;
}

export function loadProgramFromSource(source) {
    const { words } = assemble(source);

    let addr = 0;
    for (const w of words) {
        storeWordRaw(addr, w);
        addr += 4;
    }

    state.pc = 0;
    resetCache(state.iCache);
    resetCache(state.dCache);
    state.lastTrace = '';
}

const HANDLERS = {
    ADD(decoded, state) {
        const { rs, rt, rd } = decoded;
        const result = (state.regs[rs] + state.regs[rt]) | 0;
        writeRegister(rd, result);
    },

    ADDU(decoded, state) {
        const { rs, rt, rd } = decoded;
        const result = (state.regs[rs] + state.regs[rt]) >>> 0;
        writeRegister(rd, result);
    },

    SUB(decoded, state) {
        const { rs, rt, rd } = decoded;
        const result = (state.regs[rs] - state.regs[rt]) | 0;
        writeRegister(rd, result);
    },

    SUBU(decoded, state) {
        const { rs, rt, rd } = decoded;
        const result = (state.regs[rs] - state.regs[rt]) >>> 0;
        writeRegister(rd, result);
    },

    AND(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = state.regs[rs] & state.regs[rt];
        writeRegister(rd, result);
    },

    OR(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = state.regs[rs] | state.regs[rt];
        writeRegister(rd, result);
    },

    XOR(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = state.regs[rs] ^ state.regs[rt];
        writeRegister(rd, result);
    },

    NOR(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = ~(state.regs[rs] | state.regs[rt]);
        writeRegister(rd, result);
    },

    SLT(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = (state.regs[rs] < state.regs[rt]) ? 1 : 0;
        writeRegister(rd, result);
    },

    SLTU(decoded, state){
        const {rs ,rt, rd} = decoded;
        const result = ( (state.regs[rs]>>>0) < (state.regs[rt]>>>0) ) ? 1 : 0;
        writeRegister(rd, result);
    },  

    SLL(decoded, state) {
    const { rd, rt, shamt } = decoded;

    // Caso especial: NOP (SLL $zero,$zero,0)
    if (rd === 0 && rt === 0 && shamt === 0) {
        // NOP: não faz absolutamente nada
        return;
    }

    const value = state.regs[rt] << shamt;
    writeRegister(rd, value);
    },


    SRL(decoded, state){
        const {rt, rd, shamt} = decoded;
        const result = state.regs[rt] >>> shamt;
        writeRegister(rd, result);
    },

    SRA(decoded, state){
        const {rt, rd, shamt} = decoded;
        const result = state.regs[rt] >> shamt;
        writeRegister(rd, result);
    },

    SLLV(decoded, state){
        const {rs, rt, rd} = decoded;
        const shamt = state.regs[rs] & 0x1F;
        const result = state.regs[rt] << shamt;
        writeRegister(rd, result);
    },

    SRLV(decoded, state){
        const {rs, rt, rd} = decoded;
        const shamt = state.regs[rs] & 0x1F;
        const result = state.regs[rt] >>> shamt;
        writeRegister(rd, result);
    },

    SRAV(decoded, state){
        const {rs, rt, rd} = decoded;
        const shamt = state.regs[rs] & 0x1F;
        const result = state.regs[rt] >> shamt;
        writeRegister(rd, result);
    },

    JR(decoded, state) {
        const { rs } = decoded;
        state.pc = state.regs[rs];
    },

    JALR(decoded, state) {
        const { rs, rd } = decoded;
        const returnAddress = state.pc;
        state.pc = state.regs[rs];
        writeRegister(rd, returnAddress);
    },

    MFHI(decoded, state) {
        const { rd } = decoded;
        writeRegister(rd, state.hi);
    },

    MTHI(decoded, state) {
        const { rs } = decoded;
        state.hi = state.regs[rs];
    },

    MFLO(decoded, state) {
        const { rd } = decoded;
        writeRegister(rd, state.lo);
    },

    MTLO(decoded, state) {
        const { rs } = decoded;
        state.lo = state.regs[rs];
    },

    MULT(decoded, state) {
        const { rs, rt } = decoded;
        const result = (BigInt(state.regs[rs]) * BigInt(state.regs[rt])) & BigInt("0xFFFFFFFFFFFFFFFF");
        state.lo = Number(result & BigInt("0xFFFFFFFF"));
        state.hi = Number((result >> BigInt(32)) & BigInt("0xFFFFFFFF"));
    },

    MULTU(decoded, state) {
        const { rs, rt } = decoded;
        const result = (BigInt(state.regs[rs]>>>0) * BigInt(state.regs[rt]>>>0)) & BigInt("0xFFFFFFFFFFFFFFFF");
        state.lo = Number(result & BigInt("0xFFFFFFFF"));
        state.hi = Number((result >> BigInt(32)) & BigInt("0xFFFFFFFF"));
    },

    DIV(decoded, state) {
        const { rs, rt } = decoded;
        const divisor = state.regs[rt] | 0;
        if (divisor === 0) {
            throw new Error(`Divisão por zero (DIV): registrador rt (${rt}) contém 0`);
        }
        const dividend = state.regs[rs] | 0;
        state.lo = (dividend / divisor) | 0;    // quociente (32-bit signed)
        state.hi = (dividend % divisor) | 0;    // resto (32-bit signed)
    },

    DIVU(decoded, state) {
        const { rs, rt } = decoded;
        const divisor = (state.regs[rt] >>> 0);
        if (divisor === 0) {
            throw new Error(`Divisão por zero (DIVU): registrador rt (${rt}) contém 0`);
        }
        const dividend = (state.regs[rs] >>> 0);
        // usar Math.floor para garantir divisão sem sinal correta em ponto flutuante
        state.lo = (Math.floor(dividend / divisor) >>> 0); // quociente (32-bit unsigned)
        state.hi = (dividend % divisor) >>> 0; // resto (32-bit unsigned)
    },

    ADDI(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = (state.regs[rs] + imm16) | 0;
        writeRegister(rt, result);
    },

    ADDIU(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = (state.regs[rs] + imm16) >>> 0;
        writeRegister(rt, result);
    },

    SLTI(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = (state.regs[rs] < imm16) ? 1 : 0;
        writeRegister(rt, result);
    },

    SLTIU(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = ((state.regs[rs]>>>0) < (imm16>>>0)) ? 1 : 0;
        writeRegister(rt, result);
    }, 

    ANDI(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = state.regs[rs] & (imm16 & 0xFFFF);
        writeRegister(rt, result);
    },

    ORI(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = state.regs[rs] | (imm16 & 0xFFFF);
        writeRegister(rt, result);
    },

    XORI(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const result = state.regs[rs] ^ (imm16 & 0xFFFF);
        writeRegister(rt, result);
    },

    LUI(decoded, state) {
        const { rt, imm16 } = decoded;
        const result = imm16 << 16;
        writeRegister(rt, result);
    },

    LW(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = loadWord(addr);
        writeRegister(rt, value);
    },

    SW(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = state.regs[rt];
        storeWord(addr, value);
    },

    LB(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = loadByte(addr); // com sign-extend
        writeRegister(rt, value);
    },

    LBU(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = loadByteUnsigned(addr);
        writeRegister(rt, value);
    },

    LH(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = loadHalfword(addr);
        writeRegister(rt, value);
    },

    LHU(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = loadHalfwordUnsigned(addr);
        writeRegister(rt, value);
    },

    SB(decoded, state) {
        const {rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = state.regs[rt];
        storeByte(addr, value);
    },

    SH(decoded, state) {
        const {rs, rt, imm16 } = decoded;
        const addr = (state.regs[rs] + imm16) | 0;
        const value = state.regs[rt];
        storeHalfword(addr, value);
    },

    BEQ(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        if (state.regs[rs] === state.regs[rt]) {
            state.pc = (state.pc + (imm16 << 2)) | 0;
        }
    },

    BNE(decoded, state) {
        const { rs, rt, imm16 } = decoded;
        if (state.regs[rs] !== state.regs[rt]) {
            state.pc = (state.pc + (imm16 << 2)) | 0;
        };
    },

    BLEZ(decoded, state) {
        const { rs, imm16 } = decoded;
        if (state.regs[rs] <= 0) {
            state.pc = (state.pc + (imm16 << 2)) | 0;
        };
    },

    BGTZ(decoded, state) {
        const { rs, imm16 } = decoded;
        if (state.regs[rs] > 0) {
            state.pc = (state.pc + (imm16 << 2)) | 0;
        };
    },

    J(decoded, state) {
        const { target } = decoded;
        const pcUpper = state.pc & 0xF0000000;
        state.pc = pcUpper | (target << 2);
    },

    JAL(decoded, state) {
        const { target } = decoded;
        const returnAddress = state.pc;
        const pcUpper = state.pc & 0xF0000000;
        state.pc = pcUpper | (target << 2);
        writeRegister(31, returnAddress);
    },

    // SYSCALL handler: currently only supports 'exit' (v0=10).
    // To add more syscalls, extend the switch statement below with additional cases.
    SYSCALL(_decoded, state) {
        const v0 = state.regs[2]; // $v0
        switch (v0) {
            case 10: // exit
                throw new Error("Programa finalizado via syscall exit");
            default:
                throw new Error(`Syscall não implementada: ${v0}`);
        }   
    }
}

function execute(decoded, state) {
    const handler = HANDLERS[decoded.name];
    if (!handler) {
        throw new Error(`Handler não implementado para instrução: ${decoded.name}`);
    }
    handler(decoded, state);
}


function buildCtrl(decoded) {
  if (!decoded) return {};
  const n = decoded.name;

  // defaults
  const ctrl = {
    regWrite: false,
    memRead: false,
    memWrite: false,
    memToReg: false,   // WB escolhe ALU vs MEM
    aluSrcImm: false,  // ALU usa imm em vez de rtVal
    regDstRd: false,   // escreve em rd (R-type); senão escreve em rt
    branch: false,     // BEQ/BNE
    branchNe: false,   // true para BNE
    jump: false,       // J/JAL
    jumpReg: false,    // JR/JALR
    link: false        // grava $ra
  };

  switch (n) {
    case 'ADD':
    case 'ADDU':
    case 'SUB':
    case 'SUBU':
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'NOR':
    case 'SLT':
    case 'SLTU':
    case 'SLL':
    case 'SRL':
    case 'SRA':
    case 'SLLV':
    case 'SRLV':
    case 'SRAV':
      ctrl.regWrite = true; ctrl.regDstRd = true; break;

    case 'ADDI':
    case 'ADDIU':
    case 'SLTI':
    case 'SLTIU':
    case 'ANDI':
    case 'ORI':
    case 'XORI':
    case 'LUI':
      ctrl.regWrite = true; ctrl.aluSrcImm = true; break;

    case 'LW':
    case 'LB':
    case 'LBU':
    case 'LH':
    case 'LHU':
      ctrl.regWrite = true; ctrl.memRead = true; ctrl.memToReg = true; ctrl.aluSrcImm = true; break;

    case 'SW':
    case 'SB':
    case 'SH':
      ctrl.memWrite = true; ctrl.aluSrcImm = true; break;

    case 'BEQ':
      ctrl.branch = true; break;
    case 'BNE':
      ctrl.branch = true; ctrl.branchNe = true; break;

    case 'J':
      ctrl.jump = true; break;
    case 'JAL':
      ctrl.jump = true; ctrl.link = true; ctrl.regWrite = true; break;
    case 'JR':
      ctrl.jumpReg = true; break;
    case 'JALR':
      ctrl.jumpReg = true; ctrl.link = true; ctrl.regDstRd = true; ctrl.regWrite = true; break;

    case 'MFHI':
    case 'MFLO':
      ctrl.regWrite = true; ctrl.regDstRd = true; break;

    // SYSCALL, NOP etc.: ficam com defaults
  }
  return ctrl;
}


function makeNOPStage(){
    return {
        pc: null,
        instr: CONSTANTS.NOP,
        decoded: null
    };
}

function makeNOPIDEX(){
    return { pc: null, decoded: null, rsVal: 0, rtVal: 0, imm: 0, writeReg: null, ctrl: {} };
}


function flushFID(){
    state.pipeline.IF_ID = makeNOPStage();
}

function doAlu(decoded, a, b) {
  if (!decoded) return { res: 0, zero: false };
  switch (decoded.name) {
    // Aritmética lógico R
    case 'ADD':  return { res: (a + b) | 0, zero: (a + b) === 0 };
    case 'ADDU': return { res: (a + b) >>> 0, zero: ((a + b) >>> 0) === 0 };
    case 'SUB':  return { res: (a - b) | 0, zero: (a - b) === 0 };
    case 'SUBU': return { res: (a - b) >>> 0, zero: ((a - b) >>> 0) === 0 };
    case 'AND':  return { res: a & b, zero: (a & b) === 0 };
    case 'OR':   return { res: a | b, zero: (a | b) === 0 };
    case 'XOR':  return { res: a ^ b, zero: (a ^ b) === 0 };
    case 'NOR':  return { res: ~(a | b), zero: (~(a | b)) === 0 };
    case 'SLT':  return { res: (a < b) ? 1 : 0, zero: a === b };
    case 'SLTU': return { res: ((a >>> 0) < (b >>> 0)) ? 1 : 0, zero: a === b };

    // Shifts (use shamt do decoded)
    case 'SLL':  return { res: a << decoded.shamt, zero: (a << decoded.shamt) === 0 };
    case 'SRL':  return { res: a >>> decoded.shamt, zero: (a >>> decoded.shamt) === 0 };
    case 'SRA':  return { res: a >> decoded.shamt, zero: (a >> decoded.shamt) === 0 };

    // IMEDIATOS usam a/b já com imm em b
    case 'ADDI':
    case 'ADDIU':return { res: (a + b) | 0, zero: (a + b) === 0 };
    case 'SLTI': return { res: (a < b) ? 1 : 0, zero: a === b };
    case 'SLTIU':return { res: ((a >>> 0) < (b >>> 0)) ? 1 : 0, zero: a === b };
    case 'ANDI': return { res: a & (b & 0xFFFF), zero: (a & (b & 0xFFFF)) === 0 };
    case 'ORI':  return { res: a | (b & 0xFFFF), zero: (a | (b & 0xFFFF)) === 0 };
    case 'XORI': return { res: a ^ (b & 0xFFFF), zero: (a ^ (b & 0xFFFF)) === 0 };
    case 'LUI':  return { res: b << 16, zero: (b << 16) === 0 };

    // Para LW/SW/etc.: a = base, b = imm
    case 'LW': case 'SW':
    case 'LB': case 'LBU':
    case 'LH': case 'LHU':
    case 'SB': case 'SH':
      return { res: (a + b) | 0, zero: false };

    default:
      return { res: 0, zero: false }; // branches/jumps tratam fora
  }
}


// Funçao de passo único
export function step() {
    const pcBefore = state.pc;
    const instr   = fetchInstruction();        //  busca a word de 32 bits
    const decoded = decodeInstruction(instr);  //  extrai opcode/rs/rt/rd/...

    let trace = `PC=${formatHex(pcBefore)} ${decoded.name} `;
    switch (decoded.format) {
        case 'R': {
            const rsVal = regVal(decoded.rs);
            const rtVal = regVal(decoded.rt);
            trace += `rs=${regName(decoded.rs)}(${rsVal}) rt=${regName(decoded.rt)}(${rtVal}) rd=${regName(decoded.rd)}`;
            break;
        }
        case 'I': {
            const rsVal = regVal(decoded.rs);
            trace += `rs=${regName(decoded.rs)}(${rsVal}) rt=${regName(decoded.rt)} imm=${decoded.imm16}`;
            break;
        }
        case 'J': {
            trace += `target=${formatHex(decoded.target << 2)}`;
            break;
        }
    }
    state.lastTrace = trace;

    execute(decoded, state);                   
}

// Função para rodar em pipeline
export function stepPipeline() {
    const p = state.pipeline;
    p.cycle++;

    // Estágio WB
    const wb = p.MEM_WB;
    if (wb.decoded && wb.ctrl?.regWrite && wb.writeReg !== 0) {
        state.regs[wb.writeReg] = wb.memData ?? wb.aluRes;
    }

    // Estágio MEM
    const mem = p.EX_MEM;
    const memCtrl = mem?.ctrl || {};
    let memData = null;

    // Loads
    if (memCtrl.memRead && mem.decoded) {
        switch (mem.decoded.name) {
            case 'LW':  memData = loadWord(mem.aluRes); break;
            case 'LB':  memData = loadByte(mem.aluRes); break;
            case 'LBU': memData = loadByteUnsigned(mem.aluRes); break;
            case 'LH':  memData = loadHalfword(mem.aluRes); break;
            case 'LHU': memData = loadHalfwordUnsigned(mem.aluRes); break;
            default: memData = loadWord(mem.aluRes); // fallback
        }
    }

    // Stores
    if (memCtrl.memWrite && mem.decoded) {
        switch (mem.decoded.name) {
            case 'SW': storeWord(mem.aluRes, mem.rtVal); break;
            case 'SB': storeByte(mem.aluRes, mem.rtVal); break;
            case 'SH': storeHalfword(mem.aluRes, mem.rtVal); break;
        }
    }

    p.MEM_WB = {
        pc: mem.pc,
        decoded: mem.decoded,
        aluRes: mem.aluRes,
        writeReg: mem.writeReg,
        ctrl: memCtrl,
        memData: memData 
    };

    // Estágio EX (forwarding e cálculo ALU)
    const ex = p.ID_EX;
    const exCtrl = ex?.ctrl || {};
    let srcA = ex.rsVal;
    let srcB = exCtrl.aluSrcImm ? ex.imm : ex.rtVal;
    let rtForwardVal = ex.rtVal;
    let redirect = false;
    let redirectPC = 0;
    // forwarding da etapa MEM
    if (p.MEM_WB.ctrl?.regWrite && p.MEM_WB.writeReg === ex.decoded?.rs) srcA = p.MEM_WB.memData ?? p.MEM_WB.aluRes;
    if (p.MEM_WB.ctrl?.regWrite && p.MEM_WB.writeReg === ex.decoded?.rt && !exCtrl.aluSrcImm) srcB = p.MEM_WB.memData ?? p.MEM_WB.aluRes;
    if (p.MEM_WB.ctrl?.regWrite && p.MEM_WB.writeReg === ex.decoded?.rt) rtForwardVal = p.MEM_WB.memData ?? p.MEM_WB.aluRes;
    // forwarding da etapa EX
    if (p.EX_MEM.ctrl?.regWrite && p.EX_MEM.writeReg === ex.decoded?.rs) srcA = p.EX_MEM.aluRes;
    if (p.EX_MEM.ctrl?.regWrite && p.EX_MEM.writeReg === ex.decoded?.rt && !exCtrl.aluSrcImm) srcB = p.EX_MEM.aluRes;
    if (p.EX_MEM.ctrl?.regWrite && p.EX_MEM.writeReg === ex.decoded?.rt) rtForwardVal = p.EX_MEM.aluRes;
    let aluResVal = 0;
    let aluZero = false;
    if (ex.decoded) {
        switch (ex.decoded.name) {
            case 'MULT': {
                const result = (BigInt(srcA | 0) * BigInt(srcB | 0)) & BigInt('0xFFFFFFFFFFFFFFFF');
                state.lo = Number(result & BigInt('0xFFFFFFFF'));
                state.hi = Number((result >> BigInt(32)) & BigInt('0xFFFFFFFF'));
                break;
            }
            case 'MULTU': {
                const result = (BigInt(srcA >>> 0) * BigInt(srcB >>> 0)) & BigInt('0xFFFFFFFFFFFFFFFF');
                state.lo = Number(result & BigInt('0xFFFFFFFF'));
                state.hi = Number((result >> BigInt(32)) & BigInt('0xFFFFFFFF'));
                break;
            }
            case 'DIV': {
                const divisor = srcB | 0;
                if (divisor === 0) throw new Error(`Divisão por zero (DIV): rt=${ex.decoded.rt}`);
                const dividend = srcA | 0;
                state.lo = (dividend / divisor) | 0;
                state.hi = (dividend % divisor) | 0;
                break;
            }
            case 'DIVU': {
                const divisor = srcB >>> 0;
                if (divisor === 0) throw new Error(`Divisão por zero (DIVU): rt=${ex.decoded.rt}`);
                const dividend = srcA >>> 0;
                state.lo = (Math.floor(dividend / divisor) >>> 0);
                state.hi = (dividend % divisor) >>> 0;
                break;
            }
            case 'MTHI':
                state.hi = srcA;
                break;
            case 'MTLO':
                state.lo = srcA;
                break;
            case 'MFHI':
                aluResVal = state.hi | 0;
                aluZero = aluResVal === 0;
                break;
            case 'MFLO':
                aluResVal = state.lo | 0;
                aluZero = aluResVal === 0;
                break;
            default: {
                const { res, zero } = doAlu(ex.decoded, srcA, srcB);
                aluResVal = res;
                aluZero = zero;
            }
        }
    }

    // Branches/Jumps resolvidos no EX
    if (exCtrl.branch && ex.decoded) {
        const shouldTake = exCtrl.branchNe ? !aluZero : aluZero;
        if (shouldTake) {
            redirect = true;
            redirectPC = ((ex.pc + 4) | 0) + ((ex.decoded.imm16 << 2) | 0);
        }
    }
    if (exCtrl.jumpReg && ex.decoded) {
        redirect = true;
        redirectPC = srcA | 0; // JR/JALR
    }
    if (exCtrl.jump && ex.decoded) {
        redirect = true;
        const pcUpper = (ex.pc + 4) & 0xF0000000;
        redirectPC = pcUpper | (ex.decoded.target << 2);
    }

    const destReg = (exCtrl.link && !exCtrl.regDstRd) ? 31 : (exCtrl.regDstRd ? ex.decoded?.rd : ex.decoded?.rt);
    const aluRes = exCtrl.link ? ((ex.pc + 4) | 0) : aluResVal;
    p.EX_MEM = {
        pc: ex.pc,
        decoded: ex.decoded,
        aluRes: aluRes,
        rtVal: rtForwardVal,
        writeReg: destReg,
        ctrl: exCtrl
    };

    // Estágio ID (decode, hazards, stall/flush)
    const id = p.IF_ID;
    // Se houve redirecionamento (branch/jump), zera ID/IF atuais
    if (redirect) {
        p.ID_EX = makeNOPIDEX();
        p.IF_ID = makeNOPStage();
        state.pc = redirectPC | 0;
        const pc = state.pc;
        const instr = fetchInstruction();
        p.IF_ID = { pc, instr, decoded: null };
        return;
    }

    const decoded = id.decoded ?? (id.instr != null ? decodeInstruction(id.instr) : null);
    const ctrl = buildCtrl(decoded);
    // detecção de load-use stall
    const loadUse = p.ID_EX.ctrl?.memRead && (p.ID_EX.writeReg === decoded?.rs || p.ID_EX.writeReg === decoded?.rt);
    if (loadUse) {
        // insere um NOP no estágio ID_EX
        p.ID_EX = makeNOPIDEX();
    } else {
        const destRegID = (ctrl.link && !ctrl.regDstRd) ? 31 : (ctrl.regDstRd ? decoded?.rd : decoded?.rt);
        p.ID_EX = {
            pc: id.pc,
            decoded: decoded,
            rsVal: state.regs[decoded?.rs ?? 0] | 0,
            rtVal: state.regs[decoded?.rt ?? 0] | 0,
            imm: decoded?.imm16 ?? 0,
            ctrl: ctrl,
            writeReg: destRegID
        };

        // IF (busca próxima instrução, a menos que não tenha um stall)
        if (!loadUse) {
            const pc = state.pc;
            const instr = fetchInstruction();
            p.IF_ID = {
                pc: pc,
                instr: instr,
                decoded: null
            };
        }
    }
}

export function run(maxSteps = 100000) {
    for (let i = 0; i < maxSteps; i++) {
        step();
    }
    
}
