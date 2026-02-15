/**
 * MIPSweb - MDU (Multiply Divide Unit)
 * Unidade separada da ALU para operações de multiplicação e divisão (Hi/Lo).
 */

export const MDU_OPS = {
    MULT: 1,
    MULTU: 2,
    DIV: 3,
    DIVU: 4
};

const mult = (a, b) => {
    const res = BigInt(a) * BigInt(b);
    const lo = Number(res & 0xFFFFFFFFn) | 0;
    const hi = Number((res >> 32n) & 0xFFFFFFFFn) | 0;
    return { hi, lo };
};

const multu = (a, b) => {
    const uA = BigInt(a >>> 0);
    const uB = BigInt(b >>> 0);
    const res = uA * uB;
    const lo = Number(res & 0xFFFFFFFFn) | 0;
    const hi = Number((res >> 32n) & 0xFFFFFFFFn) | 0;
    return { hi, lo };
};

const div = (a, b) => {
    if (b === 0) return { hi: 0, lo: 0 }; // Undefined behavior in MIPS, safe fallback
    const lo = (a / b) | 0;
    const hi = (a % b) | 0;
    return { hi, lo };
};

const divu = (a, b) => {
    if (b === 0) return { hi: 0, lo: 0 };
    const uA = a >>> 0;
    const uB = b >>> 0;
    const lo = (uA / uB) | 0;
    const hi = (uA % uB) | 0;
    return { hi, lo };
};

export function mdu(op, a, b) {
    switch (op) {
        case MDU_OPS.MULT: return mult(a, b);
        case MDU_OPS.MULTU: return multu(a, b);
        case MDU_OPS.DIV: return div(a, b);
        case MDU_OPS.DIVU: return divu(a, b);
        default: return { hi: undefined, lo: undefined };
    }
}
