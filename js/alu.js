/**
 * MIPSweb - ALU (Arithmetic Logic Unit)
*/

import { ALU_CODES, ALU_FLAGS } from './constantsALU.js?v=5';

// ============================================================================
// CIRCUITOS INTERNOS
// ============================================================================

const circAND = (a, b) => ({ res: a & b, ovf: false });
const circOR = (a, b) => ({ res: a | b, ovf: false });
const circXOR = (a, b) => ({ res: a ^ b, ovf: false });
const circNOR = (a, b) => ({ res: ~(a | b), ovf: false });

// Aritmética
const circADD = (a, b) => {
    const res = (a + b) | 0;
    // Overflow: Sinais iguais na entrada E sinal diferente na saída
    const ovf = (~(a ^ b) & (a ^ res)) & 0x80000000;
    return { res, ovf: ovf !== 0 };
};

const circSUB = (a, b) => {
    const res = (a - b) | 0;
    // Overflow: Sinais diferentes na entrada E sinal invertido na saída
    const ovf = ((a ^ b) & (a ^ res)) & 0x80000000;
    return { res, ovf: ovf !== 0 };
};

const circADDU = (a, b) => ({ res: (a + b) | 0, ovf: false });
const circSUBU = (a, b) => ({ res: (a - b) | 0, ovf: false });

// Comparações
const circSLT = (a, b) => ({ res: (a < b) ? 1 : 0, ovf: false });
const circSLTU = (a, b) => ({ res: ((a >>> 0) < (b >>> 0)) ? 1 : 0, ovf: false });

// Shifts
const circSLL = (a, b) => ({ res: b << (a & 0x1F), ovf: false });
const circSRL = (a, b) => ({ res: b >>> (a & 0x1F), ovf: false });
const circSRA = (a, b) => ({ res: b >> (a & 0x1F), ovf: false });

// Utilitários
const circLUI = (a, b) => ({ res: (b & 0xFFFF) << 16, ovf: false });
const circPASS_B = (a, b) => ({ res: b, ovf: false }); // Passa B puro

// ============================================================================
// TABELA DE DESPACHO (MUX)
// ============================================================================
const OP_TABLE = new Array(32).fill(null);

OP_TABLE[ALU_CODES.AND] = circAND;
OP_TABLE[ALU_CODES.OR] = circOR;
OP_TABLE[ALU_CODES.NOR] = circNOR;
OP_TABLE[ALU_CODES.XOR] = circXOR;
OP_TABLE[ALU_CODES.ADD] = circADD;
OP_TABLE[ALU_CODES.ADDU] = circADDU;
OP_TABLE[ALU_CODES.SUB] = circSUB;
OP_TABLE[ALU_CODES.SUBU] = circSUBU;
OP_TABLE[ALU_CODES.SLT] = circSLT;
OP_TABLE[ALU_CODES.SLTU] = circSLTU;
OP_TABLE[ALU_CODES.SLL] = circSLL;
OP_TABLE[ALU_CODES.SRL] = circSRL;
OP_TABLE[ALU_CODES.SRA] = circSRA;
OP_TABLE[ALU_CODES.LUI_OP] = circLUI;
OP_TABLE[ALU_CODES.OP_B] = circPASS_B;

// ============================================================================
// ALU PRINCIPAL
// ============================================================================

/**
 * Executa operação da ALU (2 Operandos Estritos).
 * @param {number} ctrl - ALU_CODES
 * @param {number} opA  - Entrada A
 * @param {number} opB  - Entrada B
 */
export function alu(ctrl, opA, opB) {
    const a = opA | 0;
    const b = opB | 0;

    const operation = OP_TABLE[ctrl & 0x1F];

    // Fallback seguro (comporta-se como NOP/Zero)
    if (!operation) return { result: 0, flags: 0 };

    const { res, ovf } = operation(a, b);

    const finalResult = res | 0;

    // Geração de Flags
    let flags = 0;
    if (finalResult === 0) flags |= ALU_FLAGS.ZERO;
    if (finalResult < 0) flags |= ALU_FLAGS.NEG;
    if (ovf) flags |= ALU_FLAGS.OVERFLOW;

    return {
        result: finalResult,
        flags
    };
}