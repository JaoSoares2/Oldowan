/**
 * MIPSweb - Main Controller
 * Conecta UI, Assembler e Execution Engine.
 */
import { assemble } from './assembler.js?v=5';
import { state } from './state.js?v=5';
import { CONSTANTS } from './constants.js?v=5';
// Importa o novo motor de execução
import { step, stepPipeline, initCpu } from './execution.js?v=5';
// Importa o registro de instruções para inicializá-lo
import { registry } from './instructions.js?v=5';

const fmtHex = (v) => '0x' + ((v >>> 0).toString(16).toUpperCase().padStart(8, '0'));
const fmtByte = (v) => ((v & 0xFF).toString(16).toUpperCase().padStart(2, '0'));

// Elementos da UI
const txtAsm = document.getElementById('asmInput');
const btnAssemble = document.getElementById('btnAssemble');
const btnStep = document.getElementById('btnStep');
const btnStepPipeline = document.getElementById('btnStepPipeline');
const btnReset = document.getElementById('btnReset');
const btnDelaySlot = document.getElementById('btnDelaySlot');
const outputDiv = document.getElementById('output');

// Inicialização do Sistema
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Inicializando MIPSweb...");

        // 1. Carrega a tabela de instruções
        registry.init();

        // 2. Reseta a CPU
        initCpu();

        // 3. Atualiza a tela
        updateUI();

        console.log("Sistema pronto.");
    } catch (e) {
        console.error("Erro fatal na inicialização:", e);
        log(`Erro Fatal: ${e.message}`, "error");
    }
});

// Event Listeners
btnAssemble.addEventListener('click', () => {
    try {
        // 1. Resetar a CPU (Limpa PC, Regs e Caches)
        initCpu();

        // 2. Montar o Código
        const { words } = assemble(txtAsm.value);

        // 3. O LOADER: Escrever byte-a-byte na Memória (Big-Endian)
        let addr = 0;
        for (const word of words) {
            // Proteção contra estouro de memória
            if (addr + 4 > state.memory.length) {
                throw new Error("Programa muito grande para a memória (1KB).");
            }

            // Escreve 4 bytes: MSB no endereço menor
            state.memory[addr] = (word >>> 24) & 0xFF;
            state.memory[addr + 1] = (word >>> 16) & 0xFF;
            state.memory[addr + 2] = (word >>> 8) & 0xFF;
            state.memory[addr + 3] = (word >>> 0) & 0xFF;

            addr += 4;
        }

        // 4. Limpar o resto da memória
        // Preenche com zeros do final do programa até o fim da RAM
        if (addr < state.memory.length) {
            state.memory.fill(0, addr);
        }

        // 5. Invalida Caches (Importante!)
        // O initCpu() já fez isso, mas para garantir:
        initCpu();

        log(`Sucesso: ${words.length} instruções carregadas na memória.`, "success");
        updateUI();

    } catch (e) {
        log(`Erro de Montagem: ${e.message}`, "error");
        console.error(e);
    }
});

btnReset.addEventListener('click', () => {
    initCpu();
    log("CPU Resetada.", "info");
    updateUI();
});

btnStep.addEventListener('click', () => {
    try {
        step();          // Executa um ciclo completo (monociclo)
        updateUI();      // Reflete PC/regs na interface
    } catch (e) {
        log(`Erro no Step: ${e.message}`, 'error');
        console.error(e);
    }
});

btnStepPipeline.addEventListener('click', () => {
    try {
        stepPipeline();  // Executa um ciclo do pipeline
        updateUI();
    } catch (e) {
        log(`Erro no Pipeline Step: ${e.message}`, 'error');
        console.error(e);
    }
});

btnDelaySlot.addEventListener('click', () => {
    state.config.delaySlot = !state.config.delaySlot;
    updateDelaySlotUI();
    log(`Delay Slot ${state.config.delaySlot ? 'ativado' : 'desativado'}.`, 'info');
});

// Atualização da Interface
function updateUI() {
    let regHTML = '<table><tr><th>#</th><th>Reg</th><th>Val (Hex)</th><th>Val (Dec)</th></tr>';
    for (let i = 0; i < 32; i++) {
        const hex = fmtHex(state.regs[i]);
        const name = CONSTANTS.REGISTER_NAMES[i] || `$${i}`;
        regHTML += `<tr><td>${i}</td><td>${name}</td><td>${hex}</td><td>${state.regs[i]}</td></tr>`;
    }
    regHTML += `<tr><td colspan="2">PC</td><td>${fmtHex(state.pc)}</td><td>${state.pc}</td></tr>`;
    regHTML += '</table>';

    const regDiv = document.getElementById('registers');
    if (regDiv) regDiv.innerHTML = regHTML;

    const pcDisp = document.getElementById('pcDisplay');
    if (pcDisp) pcDisp.textContent = fmtHex(state.pc);
    updateDelaySlotUI();

    // Pipeline View
    const pipeDiv = document.getElementById('pipeline');
    if (pipeDiv) {
        const l = state.pipeline.registers;
        const stages = [
            { name: 'IF/ID', latch: l.IF_ID, decodeWord: true },
            { name: 'ID/EX', latch: l.ID_EX },
            { name: 'EX/MEM', latch: l.EX_MEM },
            { name: 'MEM/WB', latch: l.MEM_WB }
        ];

        let pipeHTML = '<table><tr><th>Stage</th><th>Instr</th><th>PC</th><th>Ctrl</th><th>Data</th></tr>';
        for (const st of stages) {
            const lt = st.latch || {};
            let instrName = lt.asm || lt.name || '';
            if (st.decodeWord && lt.valid && lt.instr !== undefined) {
                const dec = registry.decode(lt.instr >>> 0);
                instrName = dec ? (dec.asm || dec.name) : '(???)';
            }
            const pcCell = lt.pc !== undefined ? fmtHex(lt.pc) : '-';
            const ctrl = lt.ctrl || {};
            const ctrlBits = [
                ctrl.regWrite ? 'RegW' : null,
                ctrl.memRead ? `MemR${ctrl.memSize || ''}${ctrl.memSign === false ? 'U' : ''}` : null,
                ctrl.memWrite ? `MemW${ctrl.memSize || ''}` : null,
                ctrl.memToReg ? 'M2R' : null,
                ctrl.branch ? `Br:${ctrl.branchCond || ''}` : null,
                ctrl.jump ? 'J' : null,
                ctrl.link ? 'L' : null
            ].filter(Boolean).join(' ');

            const dataBits = [];
            if (lt.destReg !== undefined) dataBits.push(`dest=$${lt.destReg}`);
            if (lt.aluResult !== undefined) dataBits.push(`ALU=${fmtHex(lt.aluResult)}`);
            if (lt.memData !== undefined) dataBits.push(`Mem=${fmtHex(lt.memData)}`);
            if (lt.rsVal !== undefined) dataBits.push(`rsVal=${fmtHex(lt.rsVal)}`);
            if (lt.rtVal !== undefined) dataBits.push(`rtVal=${fmtHex(lt.rtVal)}`);

            pipeHTML += `<tr><td>${st.name}</td><td>${lt.valid ? instrName : '-'}</td><td>${lt.valid ? pcCell : '-'}</td><td>${lt.valid ? ctrlBits : '-'}</td><td>${lt.valid ? dataBits.join(' ') : '-'}</td></tr>`;
        }
        pipeHTML += '</table>';
        pipeDiv.innerHTML = pipeHTML;
    }

    // Cache panels
    const renderCache = (cache, title) => {
        if (!cache) return '';
        let html = `<div class="cache-stats"><strong>${title}</strong> - Hits: ${cache.hits} | Misses: ${cache.misses} | Sets: ${cache.sets} | Ways: ${cache.associativity} | Block: ${cache.blockSize}B</div>`;
        html += '<table><tr><th>Set</th><th>Way</th><th>Valid</th><th>Tag</th><th>LRU</th><th>Data (8B)</th></tr>';
        for (let si = 0; si < cache.data.length; si++) {
            const set = cache.data[si];
            for (let wi = 0; wi < set.length; wi++) {
                const way = set[wi];
                const dataPreview = Array.from(way.data.slice(0, 8)).map(fmtByte).join(' ');
                html += `<tr><td>${si}</td><td>${wi}</td><td>${way.valid ? '1' : '0'}</td><td>${way.tag}</td><td>${way.lru}</td><td>${dataPreview}</td></tr>`;
            }
        }
        html += '</table>';
        return html;
    };
    const cacheI = document.getElementById('cacheI');
    if (cacheI) cacheI.innerHTML = renderCache(state.iCache, 'I-Cache');
    const cacheD = document.getElementById('cacheD');
    if (cacheD) cacheD.innerHTML = renderCache(state.dCache, 'D-Cache');

    // RAM dump (primeiros 256 bytes)
    const ramDiv = document.getElementById('ramView');
    if (ramDiv) {
        const maxBytes = Math.min(CONSTANTS.MEMORY_SIZE, 256);
        let ramHTML = '<table><tr><th>Addr</th>';
        for (let o = 0; o < 16; o++) ramHTML += `<th>+${o.toString(16).toUpperCase()}</th>`;
        ramHTML += '</tr>';
        for (let addr = 0; addr < maxBytes; addr += 16) {
            let row = `<tr><td>${fmtHex(addr)}</td>`;
            for (let o = 0; o < 16; o++) {
                row += `<td>${fmtByte(state.memory[addr + o])}</td>`;
            }
            row += '</tr>';
            ramHTML += row;
        }
        ramHTML += '</table>';
        ramDiv.innerHTML = ramHTML;
    }

    if (state.lastTrace) {
        outputDiv.innerHTML += `<div>${state.lastTrace}</div>`;
        outputDiv.scrollTop = outputDiv.scrollHeight;
    }
}

function log(msg, type = 'info') {
    const color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'black');
    outputDiv.innerHTML += `<div style="color:${color}">> ${msg}</div>`;
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function updateDelaySlotUI() {
    if (!btnDelaySlot) return;
    btnDelaySlot.textContent = `Delay Slot: ${state.config.delaySlot ? 'ON' : 'OFF'}`;
}
