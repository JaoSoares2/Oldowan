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
