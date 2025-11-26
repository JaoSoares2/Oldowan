import { CONSTANTS } from './constants.js';
import { encodeR, encodeI, encodeJ } from './encode.js';
import { parseRegister, parseImmediate } from './parse.js';



// Remove comentários de uma linha
function stripComment(line) {
    // suporta ;  #  //
    return line.split(';')[0].split('#')[0].split('//')[0];
}

// Separa label e instrução em uma linha
function splitLabelAndInstr(line) {
    const idx = line.indexOf(':');
    if (idx === -1) {
        return { label: null, instr: line.trim() };
    }
    const label = line.slice(0, idx).trim();
    const instr = line.slice(idx + 1).trim();
    return { label: label || null, instr };
}

// Primeira passagem do assembler: coleta labels e calcula tamanho do código
export function firstPass(source) {
    const lines = source.split('\n');
    const labels = {};
    let pc = 0; 

    for (const rawLine of lines) {
        let line = stripComment(rawLine).trim();
        if (!line) continue;

        const { label, instr } = splitLabelAndInstr(line);

        if (label) {
            if (labels[label] !== undefined) {
                throw new Error(`Label duplicado: ${label}`);
            }
            labels[label] = pc; // endereço em bytes
        }

        if (instr) {
            // conta uma instrução = 4 bytes
            pc += 4;
        }
    }

    return { labels, codeSize: pc };
}

// Tokeniza uma instrução em seus componentes
function tokenizeInstr(instr) {
    // separa por espaços, vírgulas e parênteses (pra LW rt, offset(rs))
    return instr.split(/[\s,()]+/).filter(t => t.length > 0);
}


//! Fazer pseudo li instrução aqui 
// Codifica uma instrução MIPS em uma palavra de 32 bits
 export function encodeOneInstruction(instrLine, pc, labels) {
    const tokens = tokenizeInstr(instrLine);
    if (tokens.length === 0) {
        return null;
    }

    let mnemonic = tokens[0].toUpperCase();
    const args = tokens.slice(1);


    const info = CONSTANTS.ISA[mnemonic];
    if (!info) {
        throw new Error(`Instrução desconhecida: ${mnemonic}`);
    }

    // R-TYPE
    if (info.type === 'R') {
        const opcode = info.opcode;
        const funct  = info.funct;

        switch (mnemonic) {
            case 'ADD':
            case 'ADDU':
            case 'SUB':
            case 'SUBU':
            case 'AND':
            case 'OR':
            case 'XOR':
            case 'NOR':
            case 'SLT':
            case 'SLTU': {
           
                const rd = parseRegister(args[0]);
                const rs = parseRegister(args[1]);
                const rt = parseRegister(args[2]);
                return encodeR(opcode, rs, rt, rd, 0, funct);
            }

            case 'SLL':
            case 'SRL':
            case 'SRA': {
             
                const rd = parseRegister(args[0]);
                const rt = parseRegister(args[1]);
                const shamt = parseImmediate(args[2]) & 0x1F;
                // rs = 0
                return encodeR(opcode, 0, rt, rd, shamt, funct);
            }

            case 'SLLV':
            case 'SRLV':
            case 'SRAV': {
              
                const rd = parseRegister(args[0]);
                const rt = parseRegister(args[1]);
                const rs = parseRegister(args[2]);
                return encodeR(opcode, rs, rt, rd, 0, funct);
            }

            case 'JR': {
                
                const rs = parseRegister(args[0]);
                return encodeR(opcode, rs, 0, 0, 0, funct);
            }

            case 'JALR': {
                
                const rd = parseRegister(args[0]);
                const rs = parseRegister(args[1]);
                return encodeR(opcode, rs, 0, rd, 0, funct);
            }

            case 'MFHI':
            case 'MFLO': {
            
                const rd = parseRegister(args[0]);
                return encodeR(opcode, 0, 0, rd, 0, funct);
            }

            case 'MTHI':
            case 'MTLO': {

                const rs = parseRegister(args[0]);
                return encodeR(opcode, rs, 0, 0, 0, funct);
            }

            case 'MULT':
            case 'MULTU':
            case 'DIV':
            case 'DIVU': {

                const rs = parseRegister(args[0]);
                const rt = parseRegister(args[1]);
                return encodeR(opcode, rs, rt, 0, 0, funct);
            }

            case 'SYSCALL': {
                return encodeR(0, 0, 0, 0, 0, info.funct);
            }

            
            default:
                throw new Error(`R-type ainda não tratado no assembler: ${mnemonic}`);
        }
    }

    // I-TYPE
    if (info.type === 'I') {
        const opcode = info.opcode;

        switch (mnemonic) {
            case 'ADDI':
            case 'ADDIU':
            case 'SLTI':
            case 'SLTIU':
            case 'ANDI':
            case 'ORI':
            case 'XORI': {
         
                const rt   = parseRegister(args[0]);
                const rs   = parseRegister(args[1]);
                const imm  = parseImmediate(args[2]) & 0xFFFF;
                return encodeI(opcode, rs, rt, imm);
            }

            case 'LI':
            case 'LUI':{
                const rt   = parseRegister(args[0]);
                const imm  = parseImmediate(args[1]);
                return encodeI(15, 0, rt, (imm >>> 16) & 0xFFFF) << 16 | encodeI(15, 0, rt, imm & 0xFFFF); // 
            }


            case 'LW':
            case 'SW':
            case 'LB':
            case 'LBU':
            case 'LH':
            case 'LHU':
            case 'SB':
            case 'SH': {
          
                const rt     = parseRegister(args[0]);
                const offset = parseImmediate(args[1]);
                const rs     = parseRegister(args[2]);
                return encodeI(opcode, rs, rt, offset & 0xFFFF);
            }

            case 'BEQ':
            case 'BNE': {
         
                const rs = parseRegister(args[0]);
                const rt = parseRegister(args[1]);
                const label = args[2];
                const targetAddr = labels[label];
                if (targetAddr === undefined) {
                    throw new Error(`Label não encontrado: ${label}`);
                }

                // offset = (target - (pc + 4)) / 4
                const offset = ((targetAddr - (pc + 4)) >> 2);
                return encodeI(opcode, rs, rt, offset & 0xFFFF);
            }

            case 'BLEZ':
            case 'BGTZ':
            
                const rs = parseRegister(args[0]);
                const label = args[1];
                const targetAddr = labels[label];
                if (targetAddr === undefined) {
                    throw new Error(`Label não encontrado: ${label}`);
                }

                // offset = (target - (pc + 4)) / 4
                const offset = ((targetAddr - (pc + 4)) >> 2);
                return encodeI(opcode, rs, 0, offset & 0xFFFF);

            default:
                throw new Error(`I-type ainda não tratado no assembler: ${mnemonic}`);

        }
    }

    // J-TYPE
    if (info.type === 'J') {
        const opcode = info.opcode;

        // j label
        const label = args[0];
        const targetAddr = labels[label];
        if (targetAddr === undefined) {
            throw new Error(`Label não encontrado: ${label}`);
        }

        // target = endereço em words (bits 27..2 da word)
        const target26 = (targetAddr >> 2) & 0x03FFFFFF;
        return encodeJ(opcode, target26);
    }

    throw new Error(`Tipo de instrução desconhecido: ${info.type}`);
}

// Monta o código fonte MIPS em um array de palavras (32 bits)
export function assemble(source) {
    const lines = source.split('\n');

    // 1ª passada: labels
    const { labels, codeSize } = firstPass(source);

    const words = [];
    let pc = 0;

    for (const rawLine of lines) {
        let line = stripComment(rawLine).trim();
        if (!line) continue;

        const { label, instr } = splitLabelAndInstr(line);
        if (!instr) continue; 
        const word = encodeOneInstruction(instr, pc, labels);
        if (word !== null) {
            words.push(word >>> 0);
            pc += 4;
        }
    }

    return { words, labels, codeSize };
}
