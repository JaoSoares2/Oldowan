
// Funções para codificação de instruções R-type
export function encodeR(opcode, rs, rt, rd, shamt, funct) {
    return ((opcode & 0x3F) << 26) |
           ((rs     & 0x1F) << 21) |
           ((rt     & 0x1F) << 16) |
           ((rd     & 0x1F) << 11) |
           ((shamt  & 0x1F) <<  6) |
           ((funct  & 0x3F) <<  0);
}

// Codificação de instruções I-type
export function encodeI(opcode, rs, rt, imm16) {
    return ((opcode & 0x3F) << 26) |
           ((rs     & 0x1F) << 21) |
           ((rt     & 0x1F) << 16) |
           (imm16   & 0xFFFF);
}

// Codificação de instruções J-type
export function encodeJ(opcode, target26) {
    return ((opcode & 0x3F) << 26) |
           (target26 & 0x03FFFFFF);
}