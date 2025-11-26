import { VECTOR_CONSTANTS } from "./constantsMSAExtension";


export const ISA = {

    //Aritmética e Lógica

    ADD:  { type: "R", opcode: 0, funct: 32 }, // rd = rs + rt (com overflow)
    ADDU: { type: "R", opcode: 0, funct: 33 }, // rd = rs + rt (sem overflow)
    SUB:  { type: "R", opcode: 0, funct: 34 }, // rd = rs - rt (com overflow)
    SUBU: { type: "R", opcode: 0, funct: 35 }, // rd = rs - rt (sem overflow)
    AND:  { type: "R", opcode: 0, funct: 36 }, // rd = rs & rt
    OR:   { type: "R", opcode: 0, funct: 37 }, // rd = rs | rt
    XOR:  { type: "R", opcode: 0, funct: 38 }, // rd = rs ^ rt
    NOR:  { type: "R", opcode: 0, funct: 39 }, // rd = ~(rs|rt)
    SLT:  { type: "R", opcode: 0, funct: 42 }, // rd = (rs < rt) ? 1 : 0 signed
    SLTU: { type: "R", opcode: 0, funct: 43 }, // rd = (rs < rt) ? 1 : 0 unsigned
    
    // shifts

    SLL:  { type: "R", opcode: 0, funct: 0 }, // rd = rt << shamt
    SRL:  { type: "R", opcode: 0, funct: 2 }, // rd = rt >> shamt (logical)
    SRA:  { type: "R", opcode: 0, funct: 3 }, // rd = rt >> shamt (arithmetic)   
    SLLV: { type: "R", opcode: 0, funct: 4 }, // rd = rt << rs
    SRLV: { type: "R", opcode: 0, funct: 6 }, // rd = rt >> rs (logical)
    SRAV: { type: "R", opcode: 0, funct: 7 }, // rd = rt >> rs (arithmetic)    

    // Movimentacao / jumps

    JR:   { type: "R", opcode: 0, funct: 8  },  // pc = rs
    JALR: { type: "R", opcode: 0, funct: 9  },  // rd = pc + 4; pc = rs
    MFHI: { type: "R", opcode: 0, funct: 16 }, // rd = HI
    MTHI: { type: "R", opcode: 0, funct: 17 }, // HI = rs
    MFLO: { type: "R", opcode: 0, funct: 18 }, // rd = LO
    MTLO: { type: "R", opcode: 0, funct: 19 }, // LO = rs
    MULT: { type: "R", opcode: 0, funct: 24 }, // {HI, LO} = rs * rt (signed)
    MULTU:{ type: "R", opcode: 0, funct: 25 }, // {HI, LO} = rs * rt (unsigned)
    DIV:  { type: "R", opcode: 0, funct: 26 }, // LO = rs / rt; HI = rs % rt (signed)
    DIVU: { type: "R", opcode: 0, funct: 27 }, // LO = rs / rt; HI = rs % rt (unsigned)

    // SYSCALL para chamadas de sistema
    
    SYSCALL: { type: "R", opcode: 0, funct: 12 }, // chamada de sistema

    // Imediatos

    ADDI: { type: "I", opcode: 8  },  // rt = rs + imm16 (signed)
    ADDIU:{ type: "I", opcode: 9  }, // unsingned version
    SLTI: { type: "I", opcode: 10 },   // signed
    SLTIU:{ type: "I", opcode: 11 },  // unsigned
    ANDI: { type: "I", opcode: 12 },   // zero-extended imediato
    ORI:  { type: "I", opcode: 13 }, // zero-extended imediato
    XORI: { type: "I", opcode: 14 }, // zero-extended imediato
    LUI:  { type: "I", opcode: 15 },  // rt = imm16 << 16

    // Load / Store

    LW:  { type: "I", opcode: 35 }, // rt = Mem[rs + offset]
    SW:  { type: "I", opcode: 43 }, // Mem[rs + offset] = rt
    LB:  { type: "I", opcode: 32 },  // load byte
    LBU: { type: "I", opcode: 36 },    // load byte unsigned
    LH:  { type: "I", opcode: 33 },     // load halfword
    LHU: { type: "I", opcode: 37 },    // unsigned
    SB:  { type: "I", opcode: 40 },     // store byte
    SH:  { type: "I", opcode: 41 },     // store halfword

    // Branches
    
    BEQ:  { type: "I", opcode: 4 },  // branch if equal
    BNE:  { type: "I", opcode: 5 },  // branch not equal
    BLEZ: { type: "I", opcode: 6 }, // branch <= 0
    BGTZ: { type: "I", opcode: 7 }, // branch > 0

    // J-type

    J:    { type: "J", opcode: 2 }, // salto direto
    JAL:  { type: "J", opcode: 3 }  // salto com link
};

export const REGISTER_ALIAS = {
    "$0": 0,  "$1": 1,  "$2": 2,  "$3": 3,
    "$4": 4,  "$5": 5,  "$6": 6,  "$7": 7,
    "$8": 8,  "$9": 9,  "$10": 10, "$11": 11,
    "$12": 12,"$13": 13,"$14": 14,"$15": 15,
    "$16": 16,"$17": 17,"$18": 18,"$19": 19,
    "$20": 20,"$21": 21,"$22": 22,"$23": 23,
    "$24": 24,"$25": 25,"$26": 26,"$27": 27,
    "$28": 28,"$29": 29,"$30": 30,"$31": 31,

    "$zero": 0, "$at": 1,
    "$v0": 2, "$v1": 3,
    "$a0": 4, "$a1": 5, "$a2": 6, "$a3": 7,
    "$t0": 8, "$t1": 9, "$t2": 10, "$t3": 11,
    "$t4": 12, "$t5": 13, "$t6": 14, "$t7": 15,
    "$s0": 16, "$s1": 17, "$s2": 18, "$s3": 19,
    "$s4": 20, "$s5": 21, "$s6": 22, "$s7": 23,
    "$t8": 24, "$t9": 25,
    "$k0": 26, "$k1": 27,
    "$gp": 28, "$sp": 29, "$fp": 30, "$s8": 30,
    "$ra": 31,
};

export const CONSTANTS = {
    MEMORY_SIZE: 1024, // em bytes (1 KB)
    REGISTER_COUNT: 32,
    REGISTER_NAMES: [
        "$zero", "$at", "$v0", "$v1",
        "$a0", "$a1", "$a2", "$a3",
        "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
        "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
        "$t8", "$t9",
        "$k0", "$k1",
        "$gp", "$sp", "$fp", "$ra"
    ],
   
    ISA, // conjunto de instruções

    // Limite de ciclos para detectar loops infinitos
    INFINITE_LOOP_THRESHOLD: 10000, 

    // Parâmetros de cache (bytes)
    I_CACHE_SIZE_BYTES: 256,
    I_CACHE_BLOCK_SIZE: 16,
    I_CACHE_ASSOCIATIVITY: 2,
    D_CACHE_SIZE_BYTES: 512,
    D_CACHE_BLOCK_SIZE: 16,
    D_CACHE_ASSOCIATIVITY: 2,

    // NOP 
    NOP: 0x00000000,


};

