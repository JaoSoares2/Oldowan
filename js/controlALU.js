/**
 * MIPSweb - ALU Control Unit
 * Simula a unidade de controle secundária dedicada à ALU.
 * Responsabilidade: Traduzir (ALUOp + Funct) -> ALU Control Lines (4 bits)
 */

import { ALU_CODES } from './constantsALU.js?v=5';

// Constantes de Interface (sinais de entrada vindos da Main Control)
export const ALU_OP = {
    MEM_ADD: 0,  // LW/SW -> Soma
    BRANCH: 1,  // BEQ   -> Subtração
    R_TYPE: 2,  // R-Type -> Olha o Funct
    I_TYPE: 3   // I-Type -> O Main Control já sabe o código específico
};

// Tabela de Verdade (Lookup Table) para R-Types
// Entrada: Funct (6 bits) -> Saída: ALU Code (4 bits)
const FUNCT_ROM = {
    // Arithmetic
    32: ALU_CODES.ADD,  // 0x20
    33: ALU_CODES.ADDU, // 0x21
    34: ALU_CODES.SUB,  // 0x22
    35: ALU_CODES.SUBU, // 0x23
    42: ALU_CODES.SLT,  // 0x2A
    43: ALU_CODES.SLTU, // 0x2B

    // Logical
    36: ALU_CODES.AND,  // 0x24
    37: ALU_CODES.OR,   // 0x25
    38: ALU_CODES.XOR,  // 0x26
    39: ALU_CODES.NOR,  // 0x27

    // Shifts
    0: ALU_CODES.SLL,  // 0x00
    2: ALU_CODES.SRL,  // 0x02
    3: ALU_CODES.SRA,  // 0x03
    4: ALU_CODES.SLL,  // 0x04 (Variable shifts usam a mesma op na ALU, inputs mudam)
    6: ALU_CODES.SRL,  // 0x06
    7: ALU_CODES.SRA,   // 0x07
};

/**
 * Circuito Decodificador da ALU
 * @param {number} aluOp - Sinal de 2 bits vindo da Main Control
 * @param {number} funct - Campo funct da instrução (bits 5-0)
 * @param {number} specificCode - (Opcional) Código pré-definido para I-Types
 * @returns {number} Sinal de controle final de 4 bits (ALU_CODES)
 */
export function getALUControl(aluOp, funct, specificCode = 0) {
    if (aluOp === ALU_OP.R_TYPE) {
        // R-Type: O campo 'funct' decide a operação
        // Se o funct não existir na tabela (ex: JR), retorna (AND/NOP)
        return FUNCT_ROM[funct] !== undefined ? FUNCT_ROM[funct] : ALU_CODES.AND;
    }

    if (aluOp === ALU_OP.I_TYPE) {
        // I-Type Aritmético: O Main Control passa o código direto
        return specificCode;
    }

    if (aluOp === ALU_OP.BRANCH) {
        // Branch: Sempre subtração para comparar
        return ALU_CODES.SUB;
    }

    // Default (MEM_ADD e outros): Soma (cálculo de endereço)
    return ALU_CODES.ADD;
}