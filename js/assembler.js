import { registry } from './instructions.js?v=5';
import { parseRegister, parseImmediate } from './parse.js?v=5';

// --- Helpers de Parsing de Texto ---

function stripComment(line) {
    return line.split(';')[0].split('#')[0].split('//')[0];
}

function splitLabelAndInstr(line) {
    const idx = line.indexOf(':');
    if (idx === -1) return { label: null, instr: line.trim() };
    return {
        label: line.slice(0, idx).trim() || null,
        instr: line.slice(idx + 1).trim()
    };
}

function tokenizeInstr(instr) {
    // Quebra por vírgulas, parênteses e espaços, removendo vazios
    // Ex: "LW $t0, 4($sp)" -> ["LW", "$t0", "4", "$sp"]
    return instr.split(/[\s,()]+/).filter(t => t.length > 0);
}

// --- Estratégias de Sintaxe (Syntax Parsers) ---
// Define como mapear os tokens para os campos da instrução

const SYNTAX_PARSERS = {
    // Padrões Base
    'STD_3REG': (args) => ({ rd: parseRegister(args[0]), rs: parseRegister(args[1]), rt: parseRegister(args[2]) }),
    'SHIFT': (args) => ({ rd: parseRegister(args[0]), rt: parseRegister(args[1]), shamt: parseImmediate(args[2]) & 0x1F }),
    'SHIFT_V': (args) => ({ rd: parseRegister(args[0]), rt: parseRegister(args[1]), rs: parseRegister(args[2]) }), // rd, rt, rs
    'JUMP_REG': (args) => ({ rs: parseRegister(args[0]) }),
    'RD_ONLY': (args) => ({ rd: parseRegister(args[0]) }),
    'RS_RT': (args) => ({ rs: parseRegister(args[0]), rt: parseRegister(args[1]) }),
    'IMM_ARITH': (args) => ({ rt: parseRegister(args[0]), rs: parseRegister(args[1]), imm: parseImmediate(args[2]) }),
    'MEM_OFFSET': (args) => ({ rt: parseRegister(args[0]), imm: parseImmediate(args[1]), rs: parseRegister(args[2]) }), // rt, imm(rs)
    'LOAD_UPPER': (args) => ({ rt: parseRegister(args[0]), imm: parseImmediate(args[1]) }),
    'JUMP_LABEL': (args, pc, labels) => {
        const target = labels[args[0]];
        if (target === undefined) throw new Error(`Label not found: ${args[0]}`);
        return { target: (target >>> 2) & 0x03FFFFFF };
    },
    'BRANCH': (args, pc, labels) => { // BEQ rs, rt, label
        const target = labels[args[2]];
        if (target === undefined) throw new Error(`Label not found: ${args[2]}`);
        return { rs: parseRegister(args[0]), rt: parseRegister(args[1]), imm: (target - (pc + 4)) >> 2 };
    },
    'BRANCH_Z': (args, pc, labels) => { // BLEZ rs, label
        const target = labels[args[1]];
        if (target === undefined) throw new Error(`Label not found: ${args[1]}`);
        return { rs: parseRegister(args[0]), rt: 0, imm: (target - (pc + 4)) >> 2 };
    },
    'NO_ARGS': () => ({}),

    // Padrões MSA (Novos!)
    'MSA_I8': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), i8: parseImmediate(args[2]) }), // ANDI.B wd, ws, imm_u8
    'MSA_I5': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), i5: parseImmediate(args[2]) }), // ADDVI wd, ws, imm_s5
    'MSA_BIT': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), i7: parseImmediate(args[2]) }), // SLLI wd, ws, imm_m7
    'MSA_VEC': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), wt: parseRegister(args[2]) }), // AND.V wd, ws, wt
    'MSA_3R': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), wt: parseRegister(args[2]) }), // ADDV.W wd, ws, wt
    'MSA_2R': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]) }),
    'MSA_ELM': (args) => ({ wd: parseRegister(args[0]), ws: parseRegister(args[1]), n: parseImmediate(args[2]) }), // SPLATI.W wd, ws[n] (Simplificado)
    'MSA_MI10': (args) => ({ wd: parseRegister(args[0]), s10: parseImmediate(args[1]), rs: parseRegister(args[2]) }), // LD.W wd, off(rs)
    //!  'MSA_BRANCH': tem que ver como fazer esse 
    // ... Adicionar outros conforme necessidade
};


// --- Core Encoding Logic ---

function packBits(instrDef, values) {
    let word = instrDef.match; // Começa com os bits de opcode/funct já setados

    for (const [field, info] of Object.entries(instrDef.fields)) {
        // Se o campo está nos valores extraídos (ex: rs, rt, imm)
        if (values[field] !== undefined) {
            const val = values[field];
            // Truncar para o tamanho do campo (mask)
            const mask = (1 << info.len) - 1;
            const bits = (val & mask) >>> 0;
            // Shift para a posição correta
            word |= (bits << info.pos);
        }
    }
    return word >>> 0; // Unsigned 32-bit return
}

export function encodeOneInstruction(line, pc, labels) {
    const tokens = tokenizeInstr(line);
    if (tokens.length === 0) return null;

    const mnemonic = tokens[0].toUpperCase();
    const args = tokens.slice(1);

    // 1. Tratamento de Pseudo-Instruções (Macro Expansion simplificada)
    if (mnemonic === 'MOVE') {
        // move rd, rs -> addu rd, rs, $zero
        return encodeOneInstruction(`ADDU ${args[0]}, ${args[1]}, $zero`, pc, labels);
    }
    // LI (Load Immediate) de 32 bits gera 2 instruções (LUI + ORI). 
    // O assembler atual retorna array de words? Não, retorna 1 word.
    // TODO: Implementar expansão de macro multilinhas.

    // 2. Busca no Registry
    const instrDef = registry.instructions.get(mnemonic);
    if (!instrDef) {
        throw new Error(`Unknown instruction: ${mnemonic}`);
    }

    // 3. Determinar Parser de Sintaxe
    const strategyKey = registry.getSyntaxStrategy(mnemonic);
    if (!strategyKey) {
        throw new Error(`No syntax strategy defined for ${mnemonic}`);
    }

    // 4. Parsear Argumentos
    const parser = typeof strategyKey === 'function' ? strategyKey : SYNTAX_PARSERS[strategyKey];
    const fieldValues = parser(args, pc, labels);

    // 5. Empacotar Bits
    return packBits(instrDef, fieldValues);
}


// --- API Pública ---

export function firstPass(source) {
    const lines = source.split('\n');
    const labels = {};
    let pc = 0;

    for (const rawLine of lines) {
        let line = stripComment(rawLine).trim();
        if (!line) continue;

        const { label, instr } = splitLabelAndInstr(line);

        if (label) {
            if (labels[label] !== undefined) throw new Error(`Duplicate label: ${label}`);
            labels[label] = pc;
        }

        if (instr) {
            const tokens = tokenizeInstr(instr);
            if (tokens.length > 0) {
                const mnemonic = tokens[0].toUpperCase();
                // Check Pseudo-Ops length
                if (mnemonic === 'LI' || mnemonic === 'LA') {
                    pc += 8; // Expande para 2 instruções (LUI + ORI)
                } else {
                    pc += 4;
                }
            }
        }
    }
    return { labels, codeSize: pc };
}

export function assemble(source) {
    const { labels, codeSize } = firstPass(source);
    const words = [];
    let pc = 0;
    const lines = source.split('\n');

    for (const rawLine of lines) {
        let line = stripComment(rawLine).trim();
        if (!line) continue;

        const { instr } = splitLabelAndInstr(line);
        if (!instr) continue;

        const tokens = tokenizeInstr(instr);
        const mnemonic = tokens[0].toUpperCase();

        // Tratamento especial para LI/LA (Pseudos de 2 linhas)
        // necessário até ter um pré-processador de macros real
        if (mnemonic === 'LI' || mnemonic === 'LA') {
            const rt = tokens[1];
            const immVal = (mnemonic === 'LI') ? parseImmediate(tokens[2]) : labels[tokens[2]];

            if (immVal === undefined) throw new Error(`Unresolved symbol for LA: ${tokens[2]}`);

            const upper = (immVal >>> 16) & 0xFFFF;
            const lower = immVal & 0xFFFF;

            // Gera LUI
            const luiWord = encodeOneInstruction(`LUI ${rt}, ${upper}`, pc, labels);
            words.push(luiWord);
            pc += 4;

            // Gera ORI
            const oriWord = encodeOneInstruction(`ORI ${rt}, ${rt}, ${lower}`, pc, labels);
            words.push(oriWord);
            pc += 4;
            continue;
        }

        // Instrução Padrão
        const word = encodeOneInstruction(instr, pc, labels);
        if (word !== null) {
            words.push(word >>> 0);
            pc += 4;
        }
    }

    return { words, labels, codeSize: pc };
}