/**
 * Exercises.js - Catálogo Completo de Exercícios & Biomecânica (Shape Mestre)
 * Mecanismo de Busca Inteligente Aprimorada (Tolerância a Erros de Digitação, Sinônimos e Acentuação)
 */

let allExercises = [];
let currentMuscleGroup = 'todos';
let currentDisplayLimit = 60;
let searchDebounceTimer = null;

// Normalização de texto: remove acentos, pontuação e converte para minúsculas
function normalizeText(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Algoritmo de Levenshtein rápido para tolerância a erros de digitação (typos)
function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 2) return 99;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substituição
                    matrix[i][j - 1] + 1,     // inserção
                    matrix[i - 1][j] + 1      // deleção
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Dicionário ampliado de sinônimos, termos de academia e variações fonéticas comuns
const MUSCLE_SYNONYMS = {
    triceps: ['triceps', 'tricep', 'triseps', 'trisepe', 'tricps', 'tricepis', 'tricepes', 'trceps', 'braquial posterior', 'extensao cotovelo'],
    biceps: ['biceps', 'bicep', 'biseps', 'bisepe', 'bicps', 'bicepis', 'bicepes', 'rosca', 'braquial', 'braquiorradial'],
    peito: ['peito', 'peitoral', 'peitorais', 'supino', 'crucifixo', 'crossover', 'cross-over', 'voador', 'peck deck', 'flexao peito'],
    costas: ['costas', 'costa', 'dorsal', 'dorsais', 'latissimo', 'remada', 'puxada', 'pulldown', 'pulley', 'barra fixa', 'cavalinho'],
    ombros: ['ombro', 'ombros', 'deltoide', 'deltoides', 'desenvolvimento', 'elevacao lateral', 'elevacao frontal', 'crucifixo invertido', 'manguito', 'arnold'],
    pernas: ['perna', 'pernas', 'quadriceps', 'quadricepis', 'coxa', 'coxas', 'isquiotibial', 'isquiotibiais', 'femoral', 'agachamento', 'legpress', 'leg press', 'extensora', 'flexora', 'adutor', 'abdutor', 'hack', 'passada', 'afundo', 'sumo', 'stiff'],
    gluteos: ['gluteo', 'gluteos', 'bumbum', 'glute', 'glutes', 'elevacao pelvica', 'bunda', 'quatro apoios', 'abducao', 'caneleira'],
    panturrilha: ['panturrilha', 'panturrilhas', 'panturilha', 'panturilha em pe', 'batata', 'batata da perna', 'soleo', 'gastrocnemio', 'gemeos'],
    abdomen: ['abdomen', 'abdomem', 'abdominal', 'abdominais', 'core', 'barriga', 'prancha', 'infra', 'supra', 'obliquo', 'obliquos', 'crunch'],
    trapezio: ['trapezio', 'trapezios', 'encolhimento'],
    antebraco: ['antebraco', 'antebracos', 'punho', 'flexao de punho', 'extensao de punho'],
    calistenia: ['calistenia', 'peso do corpo', 'bodyweight', 'paralela', 'flexao', 'barra fixa'],
    alongamento: ['alongamento', 'alongar', 'flexibilidade', 'mobilidade'],
    funcional: ['funcional', 'hiit', 'circuito', 'agilidade', 'corda naval'],
    cardio: ['cardio', 'aerobico', 'esteira', 'bike', 'bicicleta', 'corrida', 'eliptico'],
    crossfit: ['crossfit', 'wod', 'snatch', 'clean', 'burpee', 'kettlebell', 'thruster']
};

// Pré-indexa os exercícios para performance máxima em tempo real (60 FPS)
function indexExercises(list) {
    list.forEach(ex => {
        ex._nameNorm = normalizeText(ex.name);
        ex._groupNorm = normalizeText(ex.group || '');
        ex._musclesNorm = normalizeText(ex.muscles || '');
        ex._whyNorm = normalizeText(ex.why || '');
        ex._howNorm = normalizeText(ex.how || '');
        ex._allTextNorm = (ex._nameNorm + ' ' + ex._groupNorm + ' ' + ex._musclesNorm + ' ' + ex._whyNorm + ' ' + ex._howNorm);
        ex._nameWords = ex._nameNorm.split(' ').filter(w => w.length >= 3);
        ex._allWords = ex._allTextNorm.split(' ').filter(w => w.length >= 3);
    });
}

async function loadExercises() {
    const grid = document.getElementById('exercises-grid');
    try {
        const response = await fetch('/api/exercises');
        allExercises = await response.json();
        window.allExercises = allExercises;
        
        // Pré-indexar para busca aprimorada instantânea
        indexExercises(allExercises);

        // Atualizar contadores
        const badge = document.querySelector('[data-group="todos"]');
        if (badge) badge.textContent = `Todos (${allExercises.length})`;

        renderExercisesList();
    } catch (error) {
        console.error('Erro ao carregar exercícios:', error);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-400">Erro ao carregar catálogo de exercícios.</div>';
    }
}

function setMuscleGroup(group) {
    currentMuscleGroup = group;
    currentDisplayLimit = 60;

    document.querySelectorAll('.group-btn').forEach(btn => {
        if (btn.dataset.group === group) {
            btn.className = 'group-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-neoncyan text-black shadow-lg shadow-neoncyan/20';
        } else {
            btn.className = 'group-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-gray-900 text-gray-300 hover:text-white border border-gray-800';
        }
    });

    renderExercisesList();
}

function filterExercises() {
    currentDisplayLimit = 60;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        renderExercisesList();
    }, 60);
}

function clearExerciseSearch() {
    const input = document.getElementById('search-exercises');
    if (input) {
        input.value = '';
        renderExercisesList();
        input.focus();
    }
}

function loadMoreExercises() {
    currentDisplayLimit += 60;
    renderExercisesList();
}

// Motor de Busca Inteligente Aprimorada
function performEnhancedSearch(rawQuery, groupFilter) {
    const queryNorm = normalizeText(rawQuery);
    if (!queryNorm) {
        const list = groupFilter === 'todos' ? allExercises : allExercises.filter(e => e.group === groupFilter);
        return { results: list, searchedGlobally: false, totalFound: list.length };
    }

    const tokens = queryNorm.split(' ').filter(Boolean);
    const expandedTokens = tokens.map(token => {
        const alts = new Set([token]);
        for (const [groupKey, synList] of Object.entries(MUSCLE_SYNONYMS)) {
            for (const syn of synList) {
                const normSyn = normalizeText(syn);
                if (normSyn === token || (token.length >= 4 && levenshteinDistance(normSyn, token) <= 1)) {
                    alts.add(groupKey);
                    synList.forEach(s => alts.add(normalizeText(s)));
                    break;
                }
            }
        }
        return { token, alternatives: [...alts] };
    });

    function scoreExercise(ex) {
        let totalScore = 0;

        for (const { token, alternatives } of expandedTokens) {
            let tokenScore = 0;

            // 1. Match exato de nome ou prefixo
            if (ex._nameNorm === token) {
                tokenScore = Math.max(tokenScore, 200);
            } else if (ex._nameNorm.startsWith(token + ' ')) {
                tokenScore = Math.max(tokenScore, 180);
            } else if (ex._nameNorm.includes(token)) {
                tokenScore = Math.max(tokenScore, 150);
            }

            // 2. Match no grupo muscular
            if (ex._groupNorm === token) {
                tokenScore = Math.max(tokenScore, 140);
            }

            // 3. Match via sinônimos
            for (const alt of alternatives) {
                if (ex._groupNorm === alt) {
                    tokenScore = Math.max(tokenScore, 130);
                } else if (ex._nameNorm.includes(alt)) {
                    tokenScore = Math.max(tokenScore, 120);
                } else if (ex._musclesNorm.includes(alt)) {
                    tokenScore = Math.max(tokenScore, 100);
                }
            }

            // 4. Match nos músculos ativados
            if (ex._musclesNorm.includes(token)) {
                tokenScore = Math.max(tokenScore, 90);
            }

            // 5. Match em explicações e biomecânica
            if (ex._whyNorm.includes(token) || ex._howNorm.includes(token)) {
                tokenScore = Math.max(tokenScore, 50);
            }

            // 6. Tolerância a erros de digitação (Fuzzy / Levenshtein nas palavras do Nome)
            if (tokenScore === 0 && token.length >= 4) {
                const maxDist = token.length <= 5 ? 1 : 2;
                for (const word of ex._nameWords) {
                    const dist = levenshteinDistance(token, word);
                    if (dist <= maxDist) {
                        tokenScore = Math.max(tokenScore, 80 - dist * 15);
                        break;
                    }
                }
            }

            // 7. Tolerância a erros em qualquer palavra
            if (tokenScore === 0 && token.length >= 4) {
                const maxDist = token.length <= 5 ? 1 : 2;
                for (const word of ex._allWords) {
                    const dist = levenshteinDistance(token, word);
                    if (dist <= maxDist) {
                        tokenScore = Math.max(tokenScore, 50 - dist * 15);
                        break;
                    }
                }
            }

            if (tokenScore === 0) return 0; // Precisa atender a todos os tokens (busca multi-palavra)
            totalScore += tokenScore;
        }

        return totalScore;
    }

    let candidates = groupFilter === 'todos' ? allExercises : allExercises.filter(e => e.group === groupFilter);
    let scored = [];

    for (const ex of candidates) {
        const score = scoreExercise(ex);
        if (score > 0) scored.push({ ex, score });
    }

    let searchedGlobally = false;
    // Fallback Inteligente: Se o aluno estava numa aba específica (ex: Peitoral) e buscou "triceps", busca em todos os grupos
    if (scored.length === 0 && groupFilter !== 'todos') {
        searchedGlobally = true;
        for (const ex of allExercises) {
            const score = scoreExercise(ex);
            if (score > 0) scored.push({ ex, score });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return {
        results: scored.map(s => s.ex),
        searchedGlobally,
        totalFound: scored.length
    };
}

function renderExercisesList() {
    const grid = document.getElementById('exercises-grid');
    const searchInput = document.getElementById('search-exercises');
    const searchVal = searchInput?.value || '';
    const clearBtn = document.getElementById('clear-search-exercises');
    const feedbackEl = document.getElementById('search-feedback');

    // Controle do botão de limpar busca
    if (clearBtn) {
        if (searchVal.trim().length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }

    const { results: filtered, searchedGlobally, totalFound } = performEnhancedSearch(searchVal, currentMuscleGroup);

    // Feedback visual da busca aprimorada
    if (feedbackEl) {
        if (searchVal.trim().length > 0) {
            feedbackEl.classList.remove('hidden');
            if (totalFound > 0) {
                if (searchedGlobally) {
                    feedbackEl.innerHTML = `✨ Encontrados <strong class="text-neoncyan">${totalFound}</strong> exercícios para "<strong>${escapeHtml(searchVal)}</strong>" (mostrando em <em>todos os grupos</em>).`;
                } else {
                    feedbackEl.innerHTML = `✨ Encontrados <strong class="text-neoncyan">${totalFound}</strong> exercícios para "<strong>${escapeHtml(searchVal)}</strong>".`;
                }
            } else {
                feedbackEl.innerHTML = `❌ Nenhum exercício encontrado para "<strong>${escapeHtml(searchVal)}</strong>". Tente buscar por músculo (ex: bíceps, costas, pernas, abdômen).`;
            }
        } else {
            feedbackEl.classList.add('hidden');
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                    <i data-lucide="search-x" class="w-8 h-8"></i>
                </div>
                <h4 class="text-white font-bold text-base mb-1">Nenhum exercício encontrado</h4>
                <p class="text-gray-400 text-xs max-w-sm mx-auto mb-4">Não encontramos resultados para "${escapeHtml(searchVal)}". Verifique a grafia ou tente buscar pelo grupo muscular principal.</p>
                <button onclick="clearExerciseSearch()" class="px-4 py-2 rounded-xl text-xs font-bold bg-neoncyan text-black hover:bg-cyan-400 transition">
                    Limpar Busca e Ver Todos
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Limitar renderização para performance com paginação progressiva
    const displayList = filtered.slice(0, currentDisplayLimit);

    grid.innerHTML = displayList.map(ex => {
        let gifSrc = ex.gif || '';
        if (gifSrc.startsWith('images/')) {
            gifSrc = `/assets/gifs/${gifSrc.replace('images/', '')}`;
        }

        return `
            <div class="glass-card p-4 flex flex-col justify-between hover:border-neoncyan transition">
                <div>
                    <!-- Imagem / GIF do Exercício -->
                    <div class="relative w-full h-44 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 mb-3 flex items-center justify-center">
                        <img 
                            src="${gifSrc || 'https://placehold.co/400x250/111827/00FFFF?text=Shape+Mestre'}" 
                            alt="${escapeHtml(ex.name)}" 
                            loading="lazy" 
                            onerror="this.src='https://placehold.co/400x250/111827/00FFFF?text=${encodeURIComponent(ex.name)}'"
                            class="w-full h-full object-contain"
                        />
                        <span class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/70 text-neoncyan border border-neoncyan/40">
                            ${ex.group}
                        </span>
                    </div>

                    <h3 class="text-base font-bold text-white mb-1.5 leading-snug">${escapeHtml(ex.name)}</h3>
                    <p class="text-xs text-neoncyan/90 font-medium mb-3">${escapeHtml(ex.muscles || 'Músculos principais')}</p>

                    <!-- Detalhes do Exercício -->
                    <div class="space-y-2 text-xs text-gray-300">
                        <div class="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800/80">
                            <span class="font-bold text-neonpink block mb-0.5">Como Executar:</span>
                            <p class="text-gray-300 leading-relaxed">${escapeHtml(ex.how || 'Execute com postura alinhada e movimento controlado.')}</p>
                        </div>
                        ${ex.why ? `
                            <div class="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800/80">
                                <span class="font-bold text-neongreen block mb-0.5">Por que fazer:</span>
                                <p class="text-gray-400 leading-relaxed">${escapeHtml(ex.why)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                    <span>${escapeHtml(ex.when || 'Geral')}</span>
                    <button onclick="askAIAbaoutExercise('${escapeJsString(ex.name)}')" class="text-neoncyan hover:underline font-bold flex items-center space-x-1">
                        <i data-lucide="sparkles" class="w-3 h-3"></i>
                        <span>Dúvida com a IA</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (filtered.length > currentDisplayLimit) {
        grid.innerHTML += `
            <div class="col-span-full text-center py-6">
                <button onclick="loadMoreExercises()" class="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neoncyan text-black hover:bg-cyan-400 transition shadow-lg shadow-neoncyan/20">
                    Carregar Mais Exercícios (${filtered.length - currentDisplayLimit} restantes)
                </button>
            </div>
        `;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsString(str) {
    if (!str) return '';
    return str.toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Botão de perguntar sobre o exercício diretamente para a IA
function askAIAbaoutExercise(exerciseName) {
    switchTab('chat');
    setChatAgent('personal');
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = `Como faço para executar perfeitamente o exercício "${exerciseName}" e quais são os erros mais comuns?`;
        input.focus();
    }
}
