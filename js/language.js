export let currentLanguage = "en";

export function setLanguage(language) {
        currentLanguage = language;
}

export const translations = {
        pt: {
                btnAssemble: "Montar",
                btnReset: "Reiniciar",
                title: "Oldowan - Simulador MIPS32",
                btnStep: "Passo",
                btnStepPipeline: "Pipeline",
                btnDelaySlot: "Delay Slot: ON",
                btnDelaySlotOff: "Delay Slot: OFF",
                codeTitle: "Código",
                pcLine: "PC: ",
                pipelineTitle: "Pipeline (IF/ID/EX/MEM/WB)",
                regsTitle: "Registradores (GPR)",
                cacheTitle: "Caches (I/D)",
                consoleTitle: "Console",
                ramTitle: "RAM (dump parcial)",
                asmInputPlaceholder: `Escreva seu código MIPS Assembly aqui...
Exemplo:
ADDI $t0, $zero, 10
ADDI $t1, $zero, 20
ADD  $t2, $t0, $t1`,
                asmInput: `# Exemplo de Teste MIPS32
ADDI $t0, $zero, 5   # A = 5
ADDI $t1, $zero, 8   # B = 8
ADD  $t2, $t0, $t1   # C = A + B (Deve ser 13)
SLL  $t3, $t1, 2     # Shift Left: 8 << 2 = 32`,
                subtitlte: "Simulador MIPS32 focado em fidelidade arquitetural (Datapath & Control)",
                languageSelector: "Selecione um Idioma",
                name: "Oldowan (Simulador MIPS32 Web)",
                msgFatalError: (e) => `Erro Fatal: ${e}`,
                msgMemoryOverflow: "Programa muito grande para a memória (1KB).",
                msgAssembleSuccess: (n) => `Sucesso: ${n} instruções carregadas na memória.`,
                msgAssembleError: (e) => `Erro de Montagem: ${e}`,
                msgCpuReset: "CPU Reiniciada.",
                msgStepError: (e) => `Erro no Step: ${e}`,
                msgPipelineError: (e) => `Erro no Pipeline Step: ${e}`,
                msgDelaySlotOn: "Delay Slot ativado.",
                msgDelaySlotOff: "Delay Slot desativado."
        },

        en: {
                btnAssemble: "Assemble",
                btnReset: "Reset",
                title: "Oldowan - MIPS32 Simulator",
                btnStep: "Step",
                btnStepPipeline: "Pipeline",
                btnDelaySlot: "Delay Slot: ON",
                btnDelaySlotOff: "Delay Slot: OFF",
                codeTitle: "Code",
                pcLine: "PC: ",
                pipelineTitle: "Pipeline (IF/ID/EX/MEM/WB)",
                regsTitle: "Registers (GPR)",
                cacheTitle: "Caches (I/D)",
                consoleTitle: "Console",
                ramTitle: "RAM (partial dump)",
                asmInputPlaceholder: `Write your MIPS Assembly code here...
Example:
ADDI $t0, $zero, 10
ADDI $t1, $zero, 20
ADD  $t2, $t0, $t1`,
                asmInput: `# Example of MIPS32 Test
ADDI $t0, $zero, 5   # A = 5
ADDI $t1, $zero, 8   # B = 8
ADD  $t2, $t0, $t1   # C = A + B (Should be 13)
SLL  $t3, $t1, 2     # Shift Left: 8 << 2 = 32`,
                subtitlte: "MIPS32 Simulator focused on architectural fidelity (Datapath & Control)",
                languageSelector: "Select a language",
                name: "Oldowan (MIPS32 Web Simulator)",
                msgFatalError: (e) => `Fatal Error: ${e}`,
                msgMemoryOverflow: "Program too large for memory (1KB).",
                msgAssembleSuccess: (n) => `Success: ${n} instructions loaded into memory.`,
                msgAssembleError: (e) => `Assembly Error: ${e}`,
                msgCpuReset: "CPU Reset.",
                msgStepError: (e) => `Step Error: ${e}`,
                msgPipelineError: (e) => `Pipeline Step Error: ${e}`,
                msgDelaySlotOn: "Delay Slot enabled.",
                msgDelaySlotOff: "Delay Slot disabled."
        }
};