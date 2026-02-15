// helper para converter strings de bits em inteiros
const bits = s => parseInt(s.replace(/\s+/g, ''), 2) >>> 0;

// Layouts descrevem onde cada campo entra na instrução binária
const FORMATS = {
    I8: {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            top2: { pos: 25, len: 2 }, // df ou op dependendo da instrução
            i8:   { pos: 23, len: 8 }, 
            ws:   { pos: 15, len: 5 }, 
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }
        } 
    },
    I5: {
        fields:{ 
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 3 },
            df:   { pos: 22, len: 2 },
            i5:   { pos: 20, len: 5 },
            ws:   { pos: 15, len: 5 }, 
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }
        } 
    },
    BIT: {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 3 },
            df_m: { pos: 22, len: 7 },
            ws:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }
        } 
    },
    I10: {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 3 },
            df:   { pos: 22, len: 2 },
            i10:  { pos: 20, len: 10},
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }  
        }
    },
    "3R": {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 3 },
            df:   { pos: 22, len: 2 },
            wt:   { pos: 20, len: 5 },
            ws:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }  
        }
    },
    ELM: {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 4 },
            df_n: { pos: 21, len: 6 },
            ws:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }
        }
    },
    VEC: {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 5 },
            wt:   { pos: 20, len: 5 },
            ws:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }  
        }
    },
    "2R": {
        fields:{
            MSA:  { pos: 31, len: 6 }, 
            op:   { pos: 25, len: 8 },
            df:   { pos: 17, len: 2 },
            ws:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 6 }  
        }
    },
    MI10: { 
        fields:{
            MSA:  { pos: 31, len: 6 },
            s10:  { pos: 25, len: 10},
            rs:   { pos: 15, len: 5 },
            wd:   { pos: 10, len: 5 },
            minor:{ pos: 5 , len: 4 },
            df:   { pos: 1 , len: 2 }
        },
   
    },
    BRANCH_MSA: {
        fields:{
            COP1: { pos: 31, len: 6 },
            op:   { pos: 25, len: 3 },
            df:   { pos: 21, len: 2 },
            wt:   { pos: 19, len: 5 },
            s16:  { pos: 0 , len: 16}
        }
    }

};



export const ISA_MSA = {
    // I8                                                  MSA   OP    i8      WS   WD    MINOR
    ANDI_B: { format: 'I8', syntax: 'MSA_I8', base: bits('011110 00 00000000 00000 00000 000000') }, // vetor rd = vetor rs & imediato_u8 (.B)
    OR_B :  { format: 'I8', syntax: 'MSA_I8', base: bits('011110 01 00000000 00000 00000 000000') }, // vetor rd = vetor rs | imediato_u8 (.B)
    NORI_B :{ format: 'I8', syntax: 'MSA_I8', base: bits('011110 10 00000000 00000 00000 000000') }, // vetor rd = ~(vetor rs | imediato_u8 (.B)
    XORI_B :{ format: 'I8', syntax: 'MSA_I8', base: bits('011110 11 00000000 00000 00000 000000') }, // vetor rd = vetor rs ^ imediato_u8 (.B)


    // I5                                                  MSA    OP DF   i5    WS    WD   MINOR
    ADDVI:  { format: 'I5', syntax: 'MSA_I5', base: bits('011110 000 00 00000 00000 00000 000110') }, // vetor rd = vetor rs + imediato_s5
    SUBVI:  { format: 'I5', syntax: 'MSA_I5', base: bits('011110 001 00 00000 00000 00000 000110') }, // vetor rd = vetor rs - imediato_s5

    CEQI:   { format: 'I5', syntax: 'MSA_I5', base: bits('011110 000 00 00000 00000 00000 000111') }, // vetor rd = (vetor rs == imediato_s5)

    // BIT                                                   MSA   OP   DF/M    WS    WD   MINOR    
    SLLI:   { format: 'BIT', syntax: 'MSA_BIT', base: bits('011110 000 0000000 00000 00000 001001')}, // vetor rd = vetor rs << imediato_m7
    BSETI:  { format: 'BIT', syntax: 'MSA_BIT', base: bits('011110 100 0000000 00000 00000 001001')}, // vetor rd = vetor rs com bit imediato_m7 setado

    // 3R                                                MSA   OP  DF   WT    WS    WD   MINOR
    SLL:    { format: '3R',syntax: 'MSA_3R', base: bits('011110 000 00 00000 00000 00000 001101')}, // vetor rd = vetor rs << vetor rt
    SRA:    { format: '3R',syntax: 'MSA_3R', base: bits('011110 001 00 00000 00000 00000 001101')}, // vetor rd = vetor rs >> vetor rt (aritmético)
    SRL:    { format: '3R',syntax: 'MSA_3R', base: bits('011110 010 00 00000 00000 00000 001101')}, // vetor rd = vetor rs >> vetor rt (lógico)
    BSET:   { format: '3R',syntax: 'MSA_3R', base: bits('011110 100 00 00000 00000 00000 001101')}, // vetor rd = vetor rs com bit de vetor rt setado
    
    ADDV:   { format: '3R',syntax: 'MSA_3R', base: bits('011110 000 00 00000 00000 00000 001110')}, // vetor rd = vetor rs + vetor rt 
    SUBV:   { format: '3R',syntax: 'MSA_3R', base: bits('011110 001 00 00000 00000 00000 001110')}, // vetor rd = vetor rs - vetor rt 
    CEQ:    { format: '3R',syntax: 'MSA_3R', base: bits('011110 000 00 00000 00000 00000 001111')}, // vetor rd = (vetor rs == vetor rt) 
    MULV:   { format: '3R',syntax: 'MSA_3R', base: bits('011110 000 00 00000 00000 00000 010010')}, // vetor rd = vetor rs * vetor rt
    DIV_S:  { format: '3R',syntax: 'MSA_3R', base: bits('011110 100 00 00000 00000 00000 010010')}, // vetor rd = vetor rs / vetor rt (float single)
    DIV_U:  { format: '3R',syntax: 'MSA_3R', base: bits('011110 101 00 00000 00000 00000 010010')}, // vetor rd = vetor rs / vetor rt (unsigned int)

    ILVL:   { format: '3R',syntax: 'MSA_3R', base: bits('011110 100 00 00000 00000 00000 010100')}, // interleave lower halves
    SPLAT:  { format: '3R',syntax: 'MSA_3R', base: bits('011110 001 00 00000 00000 00000 010100')}, // vetor rd = splat(rs)

    // ELM                                                   MSA     OP   DF/N   WS    WD   MINOR
    SPLATI: { format: 'ELM', syntax: 'MSA_ELM', base: bits('011110 0001 000000 00000 00000 011001')}, // vetor rd = splat elemento n de rs
    COPY_S: { format: 'ELM', syntax: 'MSA_ELM', base: bits('011110 0010 000000 00000 00000 011001')}, // vetor rd = copy elemento_s de rs
    MOVE_V: { format: 'ELM', syntax: 'MSA_ELM', base: bits('011110 0010 111110 00000 00000 011001')}, // vetor rd = vetor rs (move)
    COPY_U: { format: 'ELM', syntax: 'MSA_ELM', base: bits('011110 0011 000000 00000 00000 011001')}, // vetor rd = copy elemento_u de rs
    INSERT: { format: 'ELM', syntax: 'MSA_ELM', base: bits('011110 0100 000000 00000 00000 011001')}, // vetor rd = insert elemento de rt em rs
    // VEC                                                   MSA     OP     WT    WS    WD   MINOR
    AND_V:  { format: 'VEC', syntax: 'MSA_VEC', base: bits('011110 00000 00000 00000 00000 011110')}, // vetor rd = vetor rs & vetor rt
    OR_V:   { format: 'VEC', syntax: 'MSA_VEC', base: bits('011110 00001 00000 00000 00000 011110')}, // vetor rd = vetor rs | vetor rt
    NOR_V:  { format: 'VEC', syntax: 'MSA_VEC', base: bits('011110 00010 00000 00000 00000 011110')}, // vetor rd = ~(vetor rs | vetor rt)
    XOR_V:  { format: 'VEC', syntax: 'MSA_VEC', base: bits('011110 00011 00000 00000 00000 011110')}, // vetor rd = vetor rs ^ vetor rt
    
    // 2R                                                  MSA      OP    DF   WS    WD   MINOR
    FILL:   { format: '2R', syntax: 'MSA_2R', base: bits('011110 11000000 00 00000 00000 011110' )}, // vetor rd = splat valor de rt

    // MI10                                                    MSA      S10      RS     WD  MINOR DF
    LD:     { format: 'MI10', syntax: 'MSA_MI10', base: bits('011110 0000000000 00000 00000 1000 00')}, // vetor rd = Mem[rs + imediato_s10 * tamanho_elemento]
    ST:     { format: 'MI10', syntax: 'MSA_MI10', base: bits('011110 0000000000 00000 00000 1001 00')}, // Mem[rs + imediato_s10 * tamanho_elemento] = vetor rd

    // BRANCH_MSA                                                     COP1   OP DF   WT         S16
    BZ_V:  { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 010 11 00000 0000000000000000') },
    BZ_B:  { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 110 00 00000 0000000000000000') },
    BZ_H:  { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 110 01 00000 0000000000000000') },
    BZ_W:  { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 110 10 00000 0000000000000000') },
    BZ_D:  { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 110 11 00000 0000000000000000') },
    BNZ_V: { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 011 11 00000 0000000000000000') },
    BNZ_B: { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 111 00 00000 0000000000000000') },
    BNZ_H: { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 111 01 00000 0000000000000000') },
    BNZ_W: { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 111 10 00000 0000000000000000') },
    BNZ_D: { format: 'BRANCH_MSA', syntax: 'MSA_BRANCH', base: bits('010001 111 11 00000 0000000000000000') },
}


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
    MSA_MAJOR_OPCODE: 0x1E, // opcode principal para instruções MSA
    MSA_BRANCH_OPCODE: 0x11, // opcode para instruções de branch MSA
    DF_BITS: { B: 0b00, H: 0b01, W: 0b10, D: 0b11 }, // tipos de dados (byte, halfword, word, doubleword)
    VECTOR_REGISTER_COUNT: 32, // número de registradores vetoriais MSA
    MSA_VECTOR_NAMES: [
        "$w0",  "$w1",  "$w2",  "$w3",  "$w4",  "$w5",  "$w6",  "$w7",
        "$w8",  "$w9",  "$w10", "$w11", "$w12", "$w13", "$w14", "$w15",
        "$w16", "$w17", "$w18", "$w19", "$w20", "$w21", "$w22", "$w23",
        "$w24", "$w25", "$w26", "$w27", "$w28", "$w29", "$w30", "$w31"
    ],
    VECTOR_LANES: 4, // número de lanes em registradores vetoriais MSA
    VECTOR_LANE_SIZE_BITS: 32, // tamanho de cada lane em bits
    MSA_VECTOR_ALIGNMENT_BYTES: 16, // alinhamento de memória para dados vetoriais MSA
    VECTOR_REGISTER_SIZE_BITS: 128, // tamanho total de cada registrador vetorial MSA
    INSTRUCTION_MEMORY_SIZE_BITS: 32, // tamanho de cada instrução MSA em bits
    FORMATS: FORMATS, // layouts de formatos de instrução MSA
    ISA_MSA: ISA_MSA, // conjunto de instruções MSA
    MSA_VECTOR_REGISTERS: MSA_VECTOR_REGISTERS, // registradores vetoriais MSA
};




/* Código antigo comentado para referência futura
export const ISA_MSA = {

   // FORMATO I8 (imediato 8 bits), minor de 0b000000 até 0b000010
   ANDI_B: { type: "I8", opcode: 0x1E, operation: 0, minor: 0x00, df: {B: 0} }, // vetor rd = vetor rs & imediato_u8 (.B)
   ORI_B:  { type: "I8", opcode: 0x1E, operation: 1, minor: 0x00, df: {B: 0} }, // vetor rd = vetor rs | imediato_u8 (.B)
   NORI_B: { type: "I8", opcode: 0x1E, operation: 2, minor: 0x00, df: {B: 0} }, // vetor rd = ~(vetor rs | imediato_u8 (.B)
   XORI_B: { type: "I8", opcode: 0x1E, operation: 3, minor: 0x00, df: {B: 0} }, // vetor rd = vetor rs ^ imediato_u8 (.B)


   // Formato I5 (imediato 5 bits), minor de 0b000110 até 0b000111
   ADDVI:  { type: "I5", opcode: 0x1E, operation: 0, minor: 0x06, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs + imediato_s5
   SUBVI:  { type: "I5", opcode: 0x1E, operation: 1, minor: 0x06, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs - imediato_s5
   CEQI :  { type: "I5", opcode: 0x1E, operation: 0, minor: 0x07, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = (vetor rs == imediato_s5)

    // FORMATO BIT (bit immediate), minor de 0b001000 até 0b001010
    SLLI:   { type: "BIT", opcode: 0x1E, operation: 1, minor: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs << imediato_m7
    BSETI:  { type: "BIT", opcode: 0x1E, operation: 4, minor: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs com bit imediato_m7 setado

    // Formato 3R (três registradores de vetor), minor de 0b001101 até 0b010101
    ADDV:   { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0E, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs + vetor rt 
    SUBV:   { type: "3R", opcode: 0x1E, operation: 1, minor: 0x0E, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs - vetor rt 
    SLL:    { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0D, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs << vetor rt
    CEQ :   { type: "3R", opcode: 0x1E, operation: 0, minor: 0x0F, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = (vetor rs == vetor rt) 
    MULV:   { type: "3R", opcode: 0x1E, operation: 0, minor: 0x12, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = vetor rs * vetor rt
    ILVL:   { type: "3R", opcode: 0x1E, operation: 4, minor: 0x14, df: {B: 0, H: 1, W: 2, D: 3} }, // interleave lower halves
    SPLAT:  { type: "3R", opcode: 0x1E, operation: 1, minor: 0x14, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = splat(rs)

    // Formatmo ELM (acesso a elemento), minor sempre 0b011001
    SPLATI: { type: "ELM", opcode: 0x1E, operation: 1, minor: 0x19,df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = splat elemento n de rs

    
    // Formato VEC, minor sepre 0b011110
    AND_V:  { type: "VEC", opcode: 0x1E, operation: 0, minor: 0x1E, df: null }, // vetor rd = vetor rs & vetor rt
    OR_V:   { type: "VEC", opcode: 0x1E, operation: 1, minor: 0x1E, df: null }, // vetor rd = vetor rs | vetor rt
    NOR_V:  { type: "VEC", opcode: 0x1E, operation: 2, minor: 0x1E, df: null }, // vetor rd = ~(vetor rs | vetor rt)
    XOR_V:  { type: "VEC", opcode: 0x1E, operation: 3, minor: 0x1E, df: null }, // vetor rd = vetor rs ^ vetor rt
    // Formato 2R

    // FORMATO MI10 (Memory + immediate 10 bits), minor de 0b100000 até 0b100111
    LD:     { type: "MI10", opcode: 0x1E, sub_opcode: 0x08, df: {B: 0, H: 1, W: 2, D: 3} }, // vetor rd = Mem[rs + imediato_s10 * tamanho_elemento] 
    ST:     { type: "MI10", opcode: 0x1E, sub_opcode: 0x09, df: {B: 0, H: 1, W: 2, D: 3} }, // Mem[rs + imediato_s10 * tamanho_elemento] = vetor rd


    // Branches MSA (BV/BF)
    BZ:     { type: "BRANCH_MSA", opcode: 0x11, rs_base: 0b11000, df: {B: 0, H: 1, W: 2, D: 3} },   // branch if zero
    BNZ:    { type: "BRANCH_MSA", opcode: 0x11, rs_base: 0b11100, df: {B: 0, H: 1, W: 2, D: 3} },  // branch if not zero
    BZ_V:   { type: "BRANCH_MSA", opcode: 0x11, rs_value: null  valor de rs específico de BZ.V , df: null }, // branch if zero (vector, no df)

};
*/

