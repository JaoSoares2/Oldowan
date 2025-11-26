export const ISA_MSA = {
    /* Os opcodes das instruções MSA são um pouco complicados, está aqui uma explicação:

    PARA OS FORMATOS ELM (acesso a elemento):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão
    - Os bits 25-22  - 4 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (INSERT, SPLATI, etc.)
    - Os bits 21-16  - 6 bits (df/n) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.) e o índice do elemento
    - Os bits 15-11  - 5 bits (ws) são o registrador fonte (vector write source), registrador vetor fonte
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    ----------------------------------------------------------------------------------------------------------------

    PARA OS FORMATOS 2R:
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-18  - 8 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (ADD/SUB, compare, pack, etc.)
    - Os bits 17-16  - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.) 
    - os bits 15-11  - 5 bits (ws) são o registrador fonte 2 (vector write source), registrador vetor fonte 2
    - os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    --------------------------------------------------------------------------------------------------------------


    PARA OS FORMATOS 3R:
    - Os bits 31-26   - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-23   - 3 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (ADD/SUB, compare, pack, etc.)
    - Os bits 22-21   - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.) 
            - 00: .B (byte)
            - 01: .H (halfword)
            - 10: .W (word)
            - 11: .D (doubleword)
     - Os bits 20-16  - 5 bits (wt) são o registrador de destino (vector write target), registrador vetor fonte 1     
     - Os bits 15-11  - 5 bits (ws) são o registrador fonte 2 (vector write source), registrador vetor fonte 2
     - Os bits 10-6   - 5 bits (wd) são o registrador fonte 3 (vector write destination), registrador vetor destino
     - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    -------------------------------------------------------------------------------------------------------------

    PARA OS FORMATOS I5 (imediato 5 bits):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-23  - 3 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (shift, etc.)
    - Os bits 22-21  - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.)
            - 00: .B (byte)
            - 01: .H (halfword)
            - 10: .W (word)
            - 11: .D (doubleword)
    - Os bits 20-16  - 5 bits (s5) ou u5 são o valor imediato de 5 bits (signed ou unsigned dependendo da instrução)
    - Os bits 15-11  - 5 bits (ws) são o registrador fonte 2 (vector write source), registrador vetor fonte
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    -------------------------------------------------------------------------------------------------------------
 registrador destino (vector write target), registrador vetor destino

    PARA OS FORMATOS I8 (imediato 8 bits):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-24  - 2 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" 
    - Os bits 23-16  - 8 bits (u8) são o valor imediato de 8 bits //!(é unsigned?)
    - Os bits 15-11  - 5 bits (ws) são o registrador fonte (vector write source), registrador vetor fonte
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.
    
    Percebe que aqui não há o campo df (data format), ele é implícito pelo mnemônico (.B, .H, .W, .D)
    -------------------------------------------------------------------------------------------------------------
    PARA OS FORMATOS I10 (imediato 10 bits):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-23  - 3 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" 
    - Os bits 22-21  - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.)
    - Os bits 20-11  - 10 bits (s10) são o valor imediato de 10 bits
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.
    -------------------------------------------------------------------------------------------------------------
    PARA OS FORMATOS BIT (bit immediate):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-23  - 3 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (bitwise, etc.)
    - Os bits 22-16  - 7 bits (df/m) são usados para df + posição do bit/misc 
    - Os bits 15-11  - 5 bits (ws) são o registrador fonte (vector write source), registrador vetor fonte
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    --------------------------------------------------------------------------------------------------------------

    PARA OS FORMATOS MI10 (Memomry + immediate 10 bits):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-16  - 10 bits (s10) são o valor imediato de 10 bits (signed) em unidades de elemento
    - Os bits 15-11  - 5 bits (rs) são o GPR base (general purpose register), registrador inteiro base
    - Os bits 10-6   - 5 bits (wd) são o registrador destino (vector write destination), registrador vetor destino
    - Os bits 5-2    - 4 bits (sub opcode) são usados para definir a operação específica dentro do grupo.
    - Os bits 1-0    - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.)

    LD usa um valor nesses 4 bits, ST usa outro
    --------------------------------------------------------------------------------------------------------------

    PARA OS FORMATOS VEC (operacoes vetoriais bitwise):
    - Os bits 31-26  - 6 bits (opcode) são todos 0b011110 (0x1E em Hexa e 30 em decimal), é reservado a extensão MSA.
    - Os bits 25-21  - 5 bits (grupo) definem o tipo de operação MSA. -> "grupo da operação" (AND, OR, etc.)
    - Os bits 20-16  - 5 bits (wt) são o registrador destino (vector write target), registrador vetor destino
    - Os bits 15-11  - 5 bits (ws) são o registrador fonte 2 (vector write source), registrador vetor fonte 2
    - Os bits 10-6   - 5 bits (rs) são o registrador fonte 1 (vector read source), registrador vetor fonte 1
    - Os bits 5-0    - 6 bits (minor opcode) são usados para definir a operação específica dentro do grupo.

    Note que não há campo df (data format) aqui, tratam WR inteiro como vetor de bits e não como elementos
    --------------------------------------------------------------------------------------------------------------

    PARA OS FORMATOS BRANCH_MSA:
    - Os bits 31-26  - 6 bits (opcode) são 0b010001 (0x11 em Hexa e 17 em decimal), é o opcode de branch
    - Os bits 25-23  - 3 bits (operation) definem o tipo de operação MSA. -> "grupo da operação" (BZ, BNZ, etc.)
    - Os bits 22-21  - 2 bits (df) são usados para definir o formato dos dados (por exemplo, 8-bit, 16-bit, 32-bit, etc.)
    - Os bits 20-16  - 5 bits (ws) são o registrador fonte (vector write source), registrador vetor fonte
    - Os bits 15-0   - 16 bits (offset) são o offset de branch (signed)

    */


    // Formato 3R (três registradores de vetor) 
    ADDV:   { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0E, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs + vetor rt 
    SUBV:   { type: "3R", opcode: 0x1E, operation: 1, minor: 0x0E, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs - vetor rt 
    CEQ :   { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0F, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = (vetor rs == vetor rt) 
    SLL:    { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0D, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs << vetor rt
    ILVL:   { type: "3R", opcode: 0x1E, operation: 4, minor: 0x14, df: {B: 0, H: 1, W: 2, D: 3} }, // interleave lower halves
    SPLAT:  { type: "3R", opcode: 0x1E, operation: 1, minor: 0x14, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = splat(rs)

    // Formato I5 (imediato 5 bits)
    ADDVI:  { type: "I5", opcode: 0x1E, operation: 0, minor: 0x06, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs + imediato_s5
    SUBVI:  { type: "I5", opcode: 0x1E, operation: 1, minor: 0x06, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs - imediato_s5
    CEQI :  { type: "I5", opcode: 0x1E, operation: 0, minor: 0x07, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = (vetor rs == imediato_s5)

    // Formato VEC 
    AND_V:  { type: "VEC", opcode: 0x1E, operation: 0, minor: 0x1E, df: null }, // vetor rd = vetor rs & vetor rt
    
    // FORMATO I8 (imediato 8 bits)
    ANDI_B: { type: "I8", opcode: 0x1E, operation: 0, minor: 0x00, df: {B: 0} }, // vetor rd = vetor rs & imediato_u8 (.B)

    
    // FORMATO BIT (bit immediate)
    SLLI:   { type: "BIT", opcode: 0x1E, operation: 1, minor: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs << imediato_m7
    BSETI:  { type: "BIT", opcode: 0x1E, operation: 4, minor: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs com bit imediato_m7 setado


    // FORMATO MI10 (Memory + immediate 10 bits)
    LD:     { type: "MI10", opcode: 0x1E, sub_opcode: 0x08, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = Mem[rs + imediato_s10 * tamanho_elemento] 
    ST:     { type: "MI10", opcode: 0x1E, sub_opcode: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // Mem[rs + imediato_s10 * tamanho_elemento] = vetor rd

    // Branches MSA (BV/BF)
    BZ:     { type: "BRANCH_MSA", opcode: 0x11, rs_base: 0b11000, df: {B: 0, H: 1, W: 2, D: 3} },   // branch if zero
    BNZ:    { type: "BRANCH_MSA", opcode: 0x11, rs_base: 0b11100, df: {B: 0, H: 1, W: 2, D: 3} },  // branch if not zero
    BZ_V:   { type: "BRANCH_MSA", opcode: 0x11, rs_value: null /* valor de rs específico de BZ.V */, df: null }, // branch if zero (vector, no df)

};


// Registradores de vetores
export const MSA_VECTOR_REGISTERS = {
    // Cada registrador é um Int32Array com 4 elementos (lanes) totalizando 128 bits 
    "$w0":  new Int32Array(4), "$w1":  new Int32Array(4), "$w2":  new Int32Array(4), "$w3":  new Int32Array(4), 
    "$w4":  new Int32Array(4), "$w5":  new Int32Array(4), "$w6":  new Int32Array(4), "$w7":  new Int32Array(4),
    "$w8":  new Int32Array(4), "$w9":  new Int32Array(4), "$w10": new Int32Array(4), "$w11": new Int32Array(4), 
    "$w12": new Int32Array(4), "$w13": new Int32Array(4), "$w14": new Int32Array(4), "$w15": new Int32Array(4),
    "$w16": new Int32Array(4), "$w17": new Int32Array(4), "$w18": new Int32Array(4), "$w19": new Int32Array(4), 
    "$w20": new Int32Array(4), "$w21": new Int32Array(4), "$w22": new Int32Array(4), "$w23": new Int32Array(4),
    "$w24": new Int32Array(4), "$w25": new Int32Array(4), "$w26": new Int32Array(4), "$w27": new Int32Array(4),
    "$w28": new Int32Array(4), "$w29": new Int32Array(4), "$w30": new Int32Array(4), "$w31": new Int32Array(4)
};


export const VECTOR_CONSTANTS = {
    VECTOR_REG_COUNT: 32, // número de registradores vetoriais MSA

    VECTOR_LANES: 4, // número de lanes em registradores vetoriais MSA
    VECTOR_LANE_SIZE_BITS: 32, // tamanho de cada lane em bits
    VECTOR_REGISTER_SIZE_BITS: 128, // tamanho total de cada registrador vetorial MSA
    MSA_VECTOR_REGISTERS, // registradores vetoriais MSA
};