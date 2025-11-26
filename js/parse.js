
import { REGISTER_ALIAS } from './constants.js';


// Funções auxiliares para parsing
export function parseRegister(token) {
    if (typeof token !== 'string') {
        if(token === null || token === undefined){
            throw new Error(`Token inválido para registrador: ${token} \n Verifique se há vírgulas ou parênteses faltando na instrução.`);
        }else{
            throw new Error(`Token deve ser uma string: ${token}`);
        }
    }
    const r = REGISTER_ALIAS[token.toLowerCase()];
    if (r === undefined) {
        throw new Error(`Registrador inválido: ${token}`);
    }
    return r;
}

// Função auxiliar para parsing de imediatos
export function parseImmediate(token) {
    const t = token.trim();
    if (t.startsWith('0x') || t.startsWith('0X')) {
        return parseInt(t, 16) | 0;
    }
    return parseInt(t, 10) | 0;
}
