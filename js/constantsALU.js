/**
 * MIPSweb - Constantes da ALU (Arithmetic Logic Unit)
 */

export const ALU_CODES = {
    // Lógica Básica
    AND: 0b0000, // 0
    OR: 0b0001, // 1
    ADD: 0b0010, // 2 (Soma com Overflow check)
    ADDU: 0b0011, // 3 (Soma sem Overflow check - extensão ao padrão 4-bit clássico para facilitar simulação)

    // Subtração e Comparações
    SUB: 0b0110, // 6 (Subtração com Overflow check)
    SUBU: 0b0100, // 4 (Subtração sem Overflow - reusando bit livre)
    SLT: 0b0111, // 7 (Set Less Than - Signed)
    SLTU: 0b0101, // 5 (Set Less Than - Unsigned - extensão)

    // Lógica Inversa e XOR
    NOR: 0b1100, // 12
    XOR: 0b1101, // 13

    // Shifts (Operam no 'B' usando 'shamt' como quantidade)
    // No hardware real, isto poderia ser uma unidade separada (Barrel Shifter), ainda será feito o barrel shifter
    SLL: 0b1000, // 8
    SRL: 0b1001, // 9
    SRA: 0b1010, // 10

    // Passthrough (Útil para MOVs ou LUI)
    LUI_OP: 0b1110, // 14 (Carrega B << 16)
    OP_B: 0b1111, // 15 (Passa B direto)
};

export const ALU_FLAGS = {
    ZERO: 0x1, // Z: Resultado é zero
    OVERFLOW: 0x2, // V (Complemento de dois)
    NEG: 0x4, // N: Negativo (MSB é 1)
    CARRY: 0x8  // C: Carry Out (Para operações unsigned)
};