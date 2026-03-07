import { assemble } from './assembler.js?v=6';
import { state } from './state.js?v=6';
import { CONSTANTS } from './constants.js?v=6';
import { step, stepPipeline, initCpu } from './execution.js?v=6';
import { registry } from './instructions.js?v=6';
import { translations, setLanguage, currentLanguage } from './language.js';

const fmtHex = (v) => '0x' + ((v >>> 0).toString(16).toUpperCase().padStart(8, '0'));
const fmtByte = (v) => ((v & 0xFF).toString(16).toUpperCase().padStart(2, '0'));

function t(key, ...args) {
    const entry = translations[currentLanguage][key];
    return typeof entry === 'function' ? entry(...args) : entry;
}

// Elementos da UI
const txtAsm = document.getElementById('asmInput');
const btnAssemble = document.getElementById('btnAssemble');
const btnStep = document.getElementById('btnStep');
const btnStepPipeline = document.getElementById('btnStepPipeline');
const btnReset = document.getElementById('btnReset');
const btnDelaySlot = document.getElementById('btnDelaySlot');
const outputDiv = document.getElementById('output');
const lineNumbers = document.getElementById('line-numbers')

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
        log(t('msgFatalError', e.message), "error");
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
                throw new Error(t('msgMemoryOverflow'));
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

        log(t('msgAssembleSuccess', words.length), "success");
        updateUI();

    } catch (e) {
        log(t('msgAssembleError', e.message), "error");
        console.error(e);
    }
});

btnReset.addEventListener('click', () => {
    initCpu();
    log(t('msgCpuReset'), "info");
    updateUI();
});

btnStep.addEventListener('click', () => {
    try {
        step();          // Executa um ciclo completo (monociclo)
        updateUI();      // Reflete PC/regs na interface
    } catch (e) {
        log(t('msgStepError', e.message), 'error');
        console.error(e);
    }
});

btnStepPipeline.addEventListener('click', () => {
    try {
        stepPipeline();  // Executa um ciclo do pipeline
        updateUI();
    } catch (e) {
        log(t('msgPipelineError', e.message), 'error');
        console.error(e);
    }
});

btnDelaySlot.addEventListener('click', () => {
    state.config.delaySlot = !state.config.delaySlot;
    updateDelaySlotUI();
    log(state.config.delaySlot ? t('msgDelaySlotOn') : t('msgDelaySlotOff'), 'info');
});

txtAsm.addEventListener('scroll', () => {
    lineNumbers.scrollTop = txtAsm.scrollTop;
})
txtAsm.addEventListener('input', updateLineNumbers);
updateLineNumbers();

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

    // RAM dump (primeiros 256 bytes) — 8 bytes per row for drawer readability
    const ramDiv = document.getElementById('ramView');
    if (ramDiv) {
        const maxBytes = Math.min(CONSTANTS.MEMORY_SIZE, 256);
        let ramHTML = '<table><tr><th>Addr</th>';
        for (let o = 0; o < 8; o++) ramHTML += `<th>+${o.toString(16).toUpperCase()}</th>`;
        ramHTML += '</tr>';
        for (let addr = 0; addr < maxBytes; addr += 8) {
            let row = `<tr><td>${fmtHex(addr)}</td>`;
            for (let o = 0; o < 8; o++) {
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
    outputDiv.innerHTML += `<div style="color:${color}"> ${msg}</div>`;
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function updateDelaySlotUI() {
    const label = document.getElementById('delaySlotLabel');
    if (!label) return;
    label.textContent = `Delay Slot: ${state.config.delaySlot ? 'ON' : 'OFF'}`;
}

function applyTranslation(language) {
    setLanguage(language);

    document.querySelectorAll("[language]").forEach(element => {
        const key = element.getAttribute("language");
        element.textContent = translations[language][key];
    });
    document.querySelectorAll("[language-placeholder]").forEach(element => {
        const key = element.getAttribute("language-placeholder");
        element.placeholder = translations[language][key];
    })
    updateLineNumbers();
}
window.applyTranslation = applyTranslation;

let drawerDocked = false;

function toggleDrawer(section) {
    const panel = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    const sectionEl = document.getElementById(section === 'cache' ? 'drawerCache' : 'drawerRam');
    const tabEl = document.getElementById(section === 'cache' ? 'drawerTabCache' : 'drawerTabRam');

    if (!sectionEl || !panel) return;

    sectionEl.classList.toggle('visible');
    tabEl?.classList.toggle('active');

    // Check if any section is still visible
    const anyVisible = panel.querySelector('.drawer-section.visible');
    if (anyVisible) {
        panel.classList.add('open');
        if (!drawerDocked) overlay?.classList.add('visible');
    } else {
        panel.classList.remove('open');
        overlay?.classList.remove('visible');
        // Undock if nothing is visible
        if (drawerDocked) {
            drawerDocked = false;
            document.body.classList.remove('drawer-docked');
            document.getElementById('drawerPinBtn')?.classList.remove('active');
        }
    }
}
window.toggleDrawer = toggleDrawer;

function closeAllDrawers() {
    const panel = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    panel?.classList.remove('open');
    overlay?.classList.remove('visible');
    panel?.querySelectorAll('.drawer-section').forEach(s => s.classList.remove('visible'));
    document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
    // Undock
    drawerDocked = false;
    document.body.classList.remove('drawer-docked');
    document.getElementById('drawerPinBtn')?.classList.remove('active');
}
window.closeAllDrawers = closeAllDrawers;

function toggleDrawerPin() {
    const panel = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    const pinBtn = document.getElementById('drawerPinBtn');

    drawerDocked = !drawerDocked;
    document.body.classList.toggle('drawer-docked', drawerDocked);
    pinBtn?.classList.toggle('active', drawerDocked);

    if (drawerDocked) {
        overlay?.classList.remove('visible');
    } else if (panel?.classList.contains('open')) {
        overlay?.classList.add('visible');
    }
}
window.toggleDrawerPin = toggleDrawerPin;
applyTranslation(currentLanguage);

function updateLineNumbers() {
    const Lines = txtAsm.value.split('\n').length;
    lineNumbers.innerText = Array.from({ length: Lines }, (_, i) => i + 1).join('\n')
}
updateLineNumbers()
