/**
 * MIPSweb - Execution Engine (Datapath)
 * Conecta Registradores -> MUXes -> ALU -> Memória -> WriteBack.
 * Baseado inteiramente em sinais de controle, sem handlers específicos por instrução.
 */

import { CONSTANTS } from './constants.js?v=5';
import { state } from './state.js?v=5';
import { registry } from './instructions.js?v=5';
import { alu } from './alu.js?v=5';
import { mdu } from './mdu.js?v=5';
import { ALU_FLAGS } from './constantsALU.js?v=5';
import {
    cacheLoadByte,
    resetCache
} from './cache.js';
import {
    loadWord, storeWord,
    loadByte, loadByteUnsigned,
    loadHalfword, loadHalfwordUnsigned,
    storeByte, storeHalfword,
    storeWordRaw
} from './memory.js';

const SP = 29;
const RA = 31;
const LOAD_DISPATCH = {
    '1:1': loadByte,
    '1:0': loadByteUnsigned,
    '2:1': loadHalfword,
    '2:0': loadHalfwordUnsigned,
    '4:1': loadWord,
    '4:0': loadWord
};
const STORE_DISPATCH = {
    1: storeByte,
    2: storeHalfword,
    4: storeWord
};

// Controle interno para stalls do pipeline (load-use)
let stallIF = false;

// --- Inicialização ---

export function initCpu() {
    state.pc = 0;
    state.regs.fill(0);
    state.regs[0] = 0;
    state.hi = 0;
    state.lo = 0;

    state.branchState.pending = false;
    state.branchState.target = 0;
    state.branchState.delaySlotHold = false;

    // Reset Pipeline State
    state.pipeline.cycle = 0;
    state.pipeline.stallIF = false;

    // Função auxiliar para zerar um latch
    const clearLatch = (latch) => {
        for (let key in latch) {
            if (key === 'ctrl') latch[key] = { ...latch[key], regWrite: 0, memWrite: 0 }; // Zera sinais críticos
            else if (typeof latch[key] === 'number') latch[key] = 0;
            else if (key === 'valid') latch[key] = false;
            else latch[key] = undefined;
        }
    };

    clearLatch(state.pipeline.registers.IF_ID);
    clearLatch(state.pipeline.registers.ID_EX);
    clearLatch(state.pipeline.registers.EX_MEM);
    clearLatch(state.pipeline.registers.MEM_WB);

    resetCache(state.iCache);
    resetCache(state.dCache);

    const topOfStack = CONSTANTS.MEMORY_SIZE & ~3;
    state.regs[SP] = topOfStack;
    stallIF = false;
}

function regVal(i) { return state.regs[i] | 0; }

function writeRegister(index, value) {
    if (index === 0) return;
    state.regs[index] = value | 0;
}


// --- DATAPATH: EXECUÇÃO GENÉRICA ---

/**
 * Executa um ciclo completo (Fetch -> Decode -> Execute -> Memory -> WriteBack)
 * Simulando um processador Monociclo (para o modo 'Step').
 */
export function step() {
    // 1. Lógica de Salto Pendente (Delay Slot do ciclo anterior)
    const jumpingNow = state.branchState.pending;
    const jumpTarget = state.branchState.target;
    const pcOfInstruction = state.pc;

    // 2. FETCH
    let instrWord;
    try {
        instrWord = fetchInstruction(); // Incrementa state.pc para PC+4
    } catch (e) {
        throw e;
    }

    // 3. DECODE & CONTROL UNIT
    const decoded = registry.decode(instrWord);
    if (!decoded) throw new Error(`Instrução ilegal em 0x${pcOfInstruction.toString(16)}`);

    const { ctrl, rs, rt, rd, shamt, imm, target } = decoded;

    // --- LEITURA DE REGISTRADORES (Register Fetch) ---
    const rsVal = regVal(rs);
    const rtVal = regVal(rt);

    // --- EXECUTE (EX) STAGE ---

    // MUX A: Shift Source
    // Se shiftSrc=1, entrada A é o campo shamt. Senão, é RS.
    // (Fidelidade: No hardware, shamt é extendido para 32 bits antes de entrar)
    const aluInA = ctrl.shiftSrc ? shamt : rsVal;

    // MUX B: ALU Source
    // Se aluSrc=1 (I-Type, Load/Store), entrada B é o Imediato. Senão, é RT.
    const aluInB = ctrl.aluSrc ? imm : rtVal;

    // ALU OPERATION
    let aluResult = 0;
    let flags = 0;

    if (ctrl.aluOp !== undefined) {
        const aluRes = alu(ctrl.aluCode, aluInA, aluInB, state.hi, state.lo);
        aluResult = aluRes.result;
        flags = aluRes.flags;
        if (aluRes.newHi !== undefined) state.hi = aluRes.newHi;
        if (aluRes.newLo !== undefined) state.lo = aluRes.newLo;
    }

    // MDU (Multiply Divide Unit)
    if (ctrl.mduOp) {
        const { hi, lo } = mdu(ctrl.mduOp, aluInA, aluInB);
        state.hi = hi;
        state.lo = lo;
    }

    // Bypass para MFHI/MFLO
    if (ctrl.isMFHI) aluResult = state.hi;
    if (ctrl.isMFLO) aluResult = state.lo;

    // BRANCH UNIT (Resolução de Desvios)
    // No MIPS clássico, decisão pode ser no ID ou EX. Aqui é feito no EX.
    let takeBranch = false;

    if (ctrl.branch) {
        // A ALU fez a subtração (aluCode=SUB). Verificamos as flags.
        // BEQ (Opcode 4): Branch se Zero=1
        // BNE (Opcode 5): Branch se Zero=0
        // BLEZ/BGTZ: Lógica baseada em flags NEG e ZERO

        // *Nota*: Para fidelidade total, a Control Unit deveria dizer qual condição testar.
        // Como simplificação, é pelo nome ou opcode neste bloco específico,
        // mas a comparação aritmética foi feita pela ALU real.
        if (decoded.name === 'BEQ' && (flags & ALU_FLAGS.ZERO)) takeBranch = true;
        if (decoded.name === 'BNE' && !(flags & ALU_FLAGS.ZERO)) takeBranch = true;
        if (decoded.name === 'BLEZ' && ((flags & ALU_FLAGS.NEG) || (flags & ALU_FLAGS.ZERO))) takeBranch = true;
        if (decoded.name === 'BGTZ' && !((flags & ALU_FLAGS.NEG) || (flags & ALU_FLAGS.ZERO))) takeBranch = true;
    }

    // CÁLCULO DE ENDEREÇO DE BRANCH/JUMP
    if (takeBranch) {
        // PC relativo: PC_atual (que já é PC+4) + (offset << 2)
        const branchAddr = state.pc + (imm << 2);
        if (state.config.delaySlot) {
            scheduleBranch(branchAddr);
        } else {
            state.pc = branchAddr; // Pula imediatamente (sem delay slot)
        }
    }
    else if (ctrl.jump) {
        let targetAddr;
        if (ctrl.jumpReg) { // JR, JALR
            targetAddr = rsVal; // Pula para valor de RS
        } else { // J, JAL
            // Região de 256MB: (PC+4)[31:28] | target << 2
            targetAddr = (state.pc & 0xF0000000) | (target << 2);
        }
        if (state.config.delaySlot) {
            scheduleBranch(targetAddr);
        } else {
            state.pc = targetAddr;
        }
    }

    // --- MEMORY (MEM) STAGE ---
    let memData = 0;

    if (ctrl.memRead) {
        const key = `${ctrl.memSize}:${ctrl.memSign ? 1 : 0}`;
        const loadFn = LOAD_DISPATCH[key] || loadWord;
        try {
            memData = loadFn(aluResult);
        } catch (e) { console.error("Mem Read Error", e); }
    }

    if (ctrl.memWrite) {
        const storeFn = STORE_DISPATCH[ctrl.memSize] || storeWord;
        try {
            storeFn(aluResult, rtVal);
        } catch (e) { console.error("Mem Write Error", e); }
    }

    // --- WRITE BACK (WB) STAGE ---

    if (ctrl.regWrite || ctrl.link) {
        // MUX de Dados de Escrita (MemToReg)
        // Se memToReg=1, escreve dado da memória.
        // Se link=1, escreve PC+4 (state.pc atual já é PC+4 se não houve salto imediato? 
        // Cuidado: state.pc já incrementou no Fetch. Para JAL, link é PC_Instrução + 8.
        // Ajuste fino: state.pc aqui é PC+4. Link deve ser state.pc + 4 (próxima da próxima).

        let writeData;
        if (ctrl.link) {
            writeData = state.pc + 4; // Link Address (Delay Slot + 4)
        } else if (ctrl.memToReg) {
            writeData = memData;
        } else {
            writeData = aluResult;
        }

        // MUX de Registrador de Destino (RegDst)
        // Se link=1 (JAL), dest é 31 ($ra).
        // Se regDst=1 (R-Type), dest é RD.
        // Se regDst=0 (I-Type), dest é RT.
        let destReg;
        if (ctrl.link) destReg = RA;
        else if (ctrl.regDst) destReg = rd;
        else destReg = rt;

        writeRegister(destReg, writeData);
    }

    // Trace Atualizado
    state.lastTrace = `PC=${formatHex(pcOfInstruction)} ${decoded.name}`;
    if (jumpingNow) state.lastTrace += ` (Delay Slot)`;

    // Efetiva o Salto (Commit do Branch State)
    if (jumpingNow) {
        state.pc = jumpTarget;
        state.branchState.pending = false;
        state.branchState.target = 0;
    }
}

// --- Helpers Internos ---

function fetchInstruction() {
    const pc = state.pc;
    if (pc & 3) throw new Error(`Unaligned PC: 0x${pc.toString(16)}`);
    // Cache Load encapsula a leitura da memória
    const b0 = cacheLoadByte(state.iCache, state.memory, pc);
    const b1 = cacheLoadByte(state.iCache, state.memory, pc + 1);
    const b2 = cacheLoadByte(state.iCache, state.memory, pc + 2);
    const b3 = cacheLoadByte(state.iCache, state.memory, pc + 3);
    const instr = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;

    state.pc = (pc + 4) | 0; // Incremento padrão
    return instr;
}

function scheduleBranch(target) {
    state.branchState.pending = true;
    state.branchState.target = target;
    state.branchState.delaySlotHold = false;
}

function formatHex(v) { return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0'); }


// ============================================================================
// PIPELINE ENGINE
// ============================================================================

/**
 * Executa um ciclo de clock no modo Pipeline (5 estágios).
 * Ordem de execução: WB <- MEM <- EX <- ID <- IF
 * Isso simula a atualização simultânea dos latches na borda do clock.
 */
function snapshotLatch(l) {
    if (!l) return {};
    const snap = { ...l };
    if (l.ctrl) snap.ctrl = { ...l.ctrl };
    return snap;
}

export function stepPipeline() {
    // Tira snapshots antes de modificar latches (fidelidade de forwarding)
    const snapEX_MEM = snapshotLatch(state.pipeline.registers.EX_MEM);
    const snapMEM_WB = snapshotLatch(state.pipeline.registers.MEM_WB);

    // 1. Write Back (Escreve no Register File)
    stageWB();

    // 2. Memory Access (Acessa RAM e atualiza MEM/WB)
    stageMEM();

    // 3. Execution (Calcula ALU, resolve Branches, atualiza EX/MEM)
    stageEX({ memFwd: snapEX_MEM, wbFwd: snapMEM_WB });

    // 4. Instruction Decode (Decodifica, lê Regs, Hazard Unit, atualiza ID/EX)
    stageID();

    // 5. Instruction Fetch (Busca instrução, atualiza PC, atualiza IF/ID)
    stageIF();

    state.pipeline.cycle++;
}

// --- Estágios do Pipeline ---

function stageWB() {
    const latch = state.pipeline.registers.MEM_WB;
    if (!latch.valid) return;

    // Sinais de Controle: RegWrite, MemToReg
    if (latch.ctrl.regWrite || latch.ctrl.link) {
        let writeData;

        if (latch.ctrl.link) {
            // JAL/JALR: Link Address já veio calculado (PC+8 ou similar, dependendo da lógica do EX)
            // Simplificação: Vamos assumir que o dado de link viajou pelo aluResult ou um campo próprio
            writeData = latch.aluResult;
        } else if (latch.ctrl.memToReg) {
            writeData = latch.memData;
        } else {
            writeData = latch.aluResult;
        }

        // Escreve no Registrador de Destino ($rd, $rt ou $ra)
        writeRegister(latch.destReg, writeData);
    }
}

function stageMEM() {
    const inLatch = state.pipeline.registers.EX_MEM;
    const outLatch = state.pipeline.registers.MEM_WB;

    // Bolha (Bubble) se inválido
    if (!inLatch.valid) {
        outLatch.valid = false;
        return;
    }

    // Copia dados pass-through
    outLatch.valid = true;
    outLatch.ctrl = { ...inLatch.ctrl }; // Clona sinais
    outLatch.name = inLatch.name;
    outLatch.asm = inLatch.asm;
    outLatch.format = inLatch.format;
    outLatch.destReg = inLatch.destReg;
    outLatch.aluResult = inLatch.aluResult;

    // Acesso à Memória
    if (inLatch.ctrl.memRead) {
        const key = `${inLatch.ctrl.memSize}:${inLatch.ctrl.memSign ? 1 : 0}`;
        const loadFn = LOAD_DISPATCH[key] || loadWord;
        try {
            outLatch.memData = loadFn(inLatch.aluResult);
        } catch (e) {
            console.error("Pipeline MEM Read Error:", e);
            outLatch.memData = 0;
        }
    } else {
        outLatch.memData = 0;
    }

    if (inLatch.ctrl.memWrite) {
        const storeFn = STORE_DISPATCH[inLatch.ctrl.memSize] || storeWord;
        try {
            storeFn(inLatch.aluResult, inLatch.writeData);
        } catch (e) {
            console.error("Pipeline MEM Write Error:", e);
        }
    }
}

function stageEX(fwdSnapshots = {}) {
    // 1. Acesso aos Latches (Registradores de Pipeline)
    const inLatch = state.pipeline.registers.ID_EX;   // Quem está entrando no EX
    const outLatch = state.pipeline.registers.EX_MEM; // Quem está saindo do EX

    // Snapshots para Forwarding (do início do ciclo)
    const memFwd = fwdSnapshots.memFwd || { valid: false, ctrl: {}, destReg: 0 };
    const wbFwd = fwdSnapshots.wbFwd || { valid: false, ctrl: {}, destReg: 0 };

    // Se a instrução atual é inválida (bolha), propaga bolha e sai
    if (!inLatch.valid) {
        outLatch.valid = false;
        return;
    }

    // Copia dados básicos para o latch de saída
    outLatch.valid = true;
    outLatch.ctrl = { ...inLatch.ctrl };
    outLatch.name = inLatch.name;
    outLatch.asm = inLatch.asm;
    outLatch.format = inLatch.format;

    // ========================================================================
    // FORWARDING UNIT (Unidade de Adiantamento)
    // ========================================================================
    // Resolve Hazards de Dados (RAW - Read After Write) sem precisar de Stalls.

    // Valores padrão: Lidos do Register File no estágio ID
    let valA = inLatch.rsVal;
    let valB = inLatch.rtVal;

    // --- FORWARDING PARA OPERANDO A (RS) ---

    // Caso 1: EX Hazard (O dado está no pipeline logo à frente, indo para MEM)
    // Condição: Instrução no MEM escreve em Reg? RD != 0? RD == RS atual?
    if (memFwd.valid && memFwd.ctrl.regWrite && memFwd.destReg !== 0 &&
        memFwd.destReg === inLatch.rs) {

        // resultado da ALU do estágio anterior
        valA = memFwd.aluResult;
    }
    // Caso 2: MEM Hazard (O dado está 2 estágios à frente, indo para WB)
    // Condição: Instrução no WB escreve? RD != 0? RD == RS?
    // NOTA: Só é feito isso se o Caso 1 (mais recente) NÃO tiver ocorrido.
    else if (wbFwd.valid && wbFwd.ctrl.regWrite && wbFwd.destReg !== 0 &&
        wbFwd.destReg === inLatch.rs) {

        // Aqui o dado pode vir da Memória (Load) ou da ALU.
        // O estágio WB já preparou os dados, mas precisa decidir qual pegar.
        if (wbFwd.ctrl.memToReg) {
            valA = wbFwd.memData; // Forwarding de um Load (após MEM stage)
        } else {
            valA = wbFwd.aluResult; // Forwarding de ALU ou Link Address
        }
    }

    // --- FORWARDING PARA OPERANDO B (RT) ---
    // Mesma lógica aplicada ao segundo operando

    if (memFwd.valid && memFwd.ctrl.regWrite && memFwd.destReg !== 0 &&
        memFwd.destReg === inLatch.rt) {
        valB = memFwd.aluResult;
    }
    else if (wbFwd.valid && wbFwd.ctrl.regWrite && wbFwd.destReg !== 0 &&
        wbFwd.destReg === inLatch.rt) {
        if (wbFwd.ctrl.memToReg) {
            valB = wbFwd.memData;
        } else {
            valB = wbFwd.aluResult;
        }
    }

    // ========================================================================
    // ALU EXECUTION (Com valores adiantados)
    // ========================================================================

    // --- MUX A (Shift Source) ---
    // Se for shift c/ imediato (SLL), usa shamt. Senão usa RS (já com forwarding aplicado).
    const aluInA = inLatch.ctrl.shiftSrc ? inLatch.shamt : valA;

    // --- MUX B (ALU Source) ---
    // Se for I-Type (ADDI, LW), usa Imediato. Senão usa RT (já com forwarding aplicado).
    const aluInB = inLatch.ctrl.aluSrc ? inLatch.imm : valB;



    // ... (inside stageEX)

    // Executa a ALU Principal (Se houver aluOp definido)
    let result = 0;
    let flags = 0;

    if (inLatch.ctrl.aluOp !== undefined) {
        const aluRes = alu(inLatch.ctrl.aluCode, aluInA, aluInB);
        result = aluRes.result;
        flags = aluRes.flags;
    }

    // Executa MDU (Multiply Divide Unit) - Paralelo à ALU
    if (inLatch.ctrl.mduOp) {

        // MDU lê RS e RT (valA e valB já com forwarding)
        const { hi, lo } = mdu(inLatch.ctrl.mduOp, valA, valB);
        state.hi = hi;
        state.lo = lo;
    }

    // Lógica de Bypass para MFHI/MFLO (Move From HI/LO)
    // Elas não usam a ALU, o dado vem direto dos registradores especiais
    if (inLatch.ctrl.isMFHI) {
        result = state.hi;
    } else if (inLatch.ctrl.isMFLO) {
        result = state.lo;
    }

    // Salva resultados no Latch de saída (EX/MEM)
    outLatch.aluResult = result;

    // O valor a ser escrito na memória (para SW) é o valB (RT),
    // que pode ter vindo via Forwarding! (Ex: ADD $t0, ...; SW $t0, ...)
    outLatch.writeData = valB;

    // --- Definição do Registrador de Destino (MUX RegDst) ---
    // Em JAL/JALR (Link), destino é 31 ($ra). Em R-Type é rd. Em I-Type é rt.
    if (inLatch.ctrl.link) {
        outLatch.destReg = 31; // $ra
        // No caso de Link, o dado a salvar é PC+8 (Delay Slot + 4)
        // Sobrescreve o aluResult com o Link Address para fluir pelo pipeline
        outLatch.aluResult = inLatch.pc + 8;
    } else {
        outLatch.destReg = inLatch.ctrl.regDst ? inLatch.rd : inLatch.rt;
    }

    // --- BRANCH UNIT (Resolução no EX) ---
    const BRANCH_EVAL = {
        eq: (f) => !!(f & ALU_FLAGS.ZERO),
        ne: (f) => !(f & ALU_FLAGS.ZERO),
        lez: (f) => !!(f & ALU_FLAGS.ZERO) || !!(f & ALU_FLAGS.NEG),
        gtz: (f) => !((f & ALU_FLAGS.ZERO) || (f & ALU_FLAGS.NEG))
    };

    let takeBranch = false;
    if (inLatch.ctrl.branch) {
        const cond = inLatch.ctrl.branchCond || 'eq';
        const evalFn = BRANCH_EVAL[cond] || BRANCH_EVAL.eq;
        takeBranch = evalFn(flags);
    }

    if (takeBranch || inLatch.ctrl.jump) {
        let target = 0;
        if (inLatch.ctrl.jump) {
            // Jumps Absolutos (J, JAL) ou Registrador (JR, JALR)
            target = inLatch.ctrl.jumpReg ? valA : ((inLatch.pc & 0xF0000000) | (inLatch.target << 2));
        } else {
            // Branch Relativo
            target = inLatch.pc + 4 + (inLatch.imm << 2);
        }

        if (state.config.delaySlot) {
            // Executa delay slot: agenda o salto para o próximo ciclo de IF
            state.branchState.pending = true;
            state.branchState.target = target;
            state.branchState.delaySlotHold = true;

            // CORREÇÃO: Não mata a instrução em IF_ID aqui!
            // Ela é a "Delay Slot Instruction" que já foi buscada e está esperando em IF_ID.
            // Ao não fazer nada, ela fluirá para ID_EX normalmente no próximo ciclo.

            // Não flusha IF/ID: a instrução já buscada é o delay slot
        } else {
            // Flush Pipeline (Zera instruções em IF e ID que foram buscadas erroneamente)
            flushPipeline();
            // Redireciona PC imediatamente
            state.pc = target;
        }
    }
}

function stageID() {
    const inLatch = state.pipeline.registers.IF_ID;
    const outLatch = state.pipeline.registers.ID_EX;

    if (!inLatch.valid) {
        outLatch.valid = false;
        return;
    }

    // Decodificação
    const decoded = registry.decode(inLatch.instr);
    if (!decoded) {
        outLatch.valid = false; // Instrução inválida vira bolha
        return;
    }

    // Determina quais operandos são lidos (evita stalls falsos)
    let usesRs = true;
    let usesRt = true;
    if (decoded.ctrl.shiftSrc) usesRs = false; // shifts imediatos não usam rs
    if (decoded.ctrl.jump && decoded.ctrl.jumpReg) usesRt = false; // JR/JALR só usam rs
    if (decoded.format === 'I') {
        if (decoded.ctrl.branch) {
            // Branch zero usa só rs; BEQ/BNE usam rs e rt
            usesRt = !(decoded.ctrl.branchCond === 'lez' || decoded.ctrl.branchCond === 'gtz');
        } else if (decoded.ctrl.memRead) {
            usesRt = false; // load: rt é destino
        } else if (decoded.ctrl.memWrite) {
            usesRt = true;  // store usa rt como dado
        } else {
            usesRt = false; // ADDI/SLTI/ANDI/ORI/XORI/LUI: rt é destino
        }
        if (decoded.name === 'LUI') usesRs = false;
    }

    // Hazard Detection Unit (Load-Use): se a instrução à frente é um load e o destino coincide
    const memLatch = state.pipeline.registers.EX_MEM;
    if (memLatch.valid && memLatch.ctrl.memRead && memLatch.destReg !== 0) {
        const hazard = (usesRs && memLatch.destReg === decoded.rs) || (usesRt && memLatch.destReg === decoded.rt);
        if (hazard && state.config.hazardDetection) {
            // Inserir bolha e pedir stall de IF (repete a mesma instrução na próxima rodada)
            stallIF = true;
            outLatch.valid = false;
            return;
        }
    }

    outLatch.valid = true;
    outLatch.pc = inLatch.pc;
    outLatch.ctrl = decoded.ctrl;
    outLatch.name = decoded.name;
    outLatch.asm = decoded.asm;
    outLatch.format = decoded.format;

    // Extração de Operandos
    outLatch.rs = decoded.rs;
    outLatch.rt = decoded.rt;
    outLatch.rd = decoded.rd;
    outLatch.shamt = decoded.shamt;
    outLatch.imm = decoded.imm;
    outLatch.target = decoded.target;

    // Leitura do Register File
    // Nota: Hazard de Leitura/Escrita no mesmo ciclo (WB escreve, ID lê)
    // Em hardware, o write acontece na primeira metade, read na segunda.
    // Roda WB antes de ID na função, o ID já lê o valor novo! (Fidelidade automática)
    outLatch.rsVal = regVal(decoded.rs);
    outLatch.rtVal = regVal(decoded.rt);
}

function stageIF() {
    const outLatch = state.pipeline.registers.IF_ID;

    // Stall Check (Hazard Unit pode impedir update do PC e IF/ID)
    if (stallIF) {
        stallIF = false; // limpa pedido de stall de load-use
        return;
    }

    // Se um branch/jump tomou e está preservando o delay slot, não buscamos nova instr agora
    if (state.branchState.pending && state.branchState.delaySlotHold) {
        outLatch.valid = false;
        // Consume o ciclo do delay slot; próximo IF aplicará o salto
        state.branchState.delaySlotHold = false;
        return;
    }

    // Aplica salto pendente (delay slot) antes do fetch, mas só depois de 1 ciclo
    if (state.branchState.pending && !state.branchState.delaySlotHold) {
        state.pc = state.branchState.target;
        state.branchState.pending = false;
        state.branchState.target = 0;
        state.branchState.delaySlotHold = false;
    } else if (state.branchState.delaySlotHold) {
        // Consume o delay slot neste ciclo; próximo IF fará o salto
        state.branchState.delaySlotHold = false;
    }

    const pc = state.pc;

    // Fetch
    let instr = 0;
    try {
        const b0 = cacheLoadByte(state.iCache, state.memory, pc);
        const b1 = cacheLoadByte(state.iCache, state.memory, pc + 1);
        const b2 = cacheLoadByte(state.iCache, state.memory, pc + 2);
        const b3 = cacheLoadByte(state.iCache, state.memory, pc + 3);
        instr = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;

        outLatch.valid = true;
        outLatch.instr = instr;
        outLatch.pc = pc; // Salva o PC desta instrução

        state.pc = (pc + 4) | 0; // Próximo PC
    } catch (e) {
        outLatch.valid = false; // Erro de fetch (fim de memória?)
    }
}

// Auxiliar para Jumps/Branches
function flushPipeline() {
    state.pipeline.registers.IF_ID.valid = false;
    state.pipeline.registers.ID_EX.valid = false;
    // Não flush EX_MEM ou MEM_WB pois são instruções anteriores válidas
}
