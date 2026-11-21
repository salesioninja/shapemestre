/**
 * Exercises.js - Catálogo Completo de Exercícios & Biomecânica (Shape Mestre)
 * Mecanismo de Busca Inteligente Aprimorada (Tolerância a Erros de Digitação, Sinônimos e Acentuação)
 */

let allExercises = [];
let currentMuscleGroup = 'todos';
let currentDisplayLimit = 60;
let searchDebounceTimer = null;
let cinesiologiaData = [];
let cinesiologiaRules = [];
let cinesiologiaMap = {};
let currentBioZoomed = false;

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

// Carrega e indexa as fichas cinesiológicas e pranchas anatômicas (Raio-X Biomecânico)
async function loadCinesiologia() {
    try {
        let loaded = false;
        // Prioridade 1: Arquivo estático direto no PWA
        try {
            const resStatic = await fetch('/data/cinesiologia.json');
            if (resStatic.ok) {
                const text = await resStatic.text();
                if (text && text.trim().startsWith('[')) {
                    cinesiologiaData = JSON.parse(text);
                    loaded = true;
                }
            }
        } catch (e) {
            console.warn('Tentando rota de API para cinesiologia...');
        }

        // Prioridade 2: Endpoint de API
        if (!loaded) {
            const resApi = await fetch('/api/cinesiologia');
            if (resApi.ok) {
                const text = await resApi.text();
                if (text && text.trim().startsWith('[')) {
                    cinesiologiaData = JSON.parse(text);
                    loaded = true;
                }
            }
        }

        window.cinesiologiaData = cinesiologiaData || [];

        cinesiologiaRules = [];
        cinesiologiaMap = {};

        (cinesiologiaData || []).forEach(item => {
            cinesiologiaMap[item.id] = item;
            if (item.matching_keys && Array.isArray(item.matching_keys)) {
                item.matching_keys.forEach(k => {
                    const normK = normalizeText(k);
                    if (normK) {
                        cinesiologiaRules.push({ key: normK, item: item });
                    }
                });
            }
            const normName = normalizeText(item.name);
            if (normName) {
                cinesiologiaRules.push({ key: normName, item: item });
            }
        });

        // Ordena por especificidade (chaves mais longas primeiro)
        cinesiologiaRules.sort((a, b) => b.key.length - a.key.length);
    } catch (e) {
        console.warn('Fichas de cinesiologia não carregadas:', e);
    }
}

// Localiza a ficha de cinesiologia compatível com o exercício
function findCinesiologia(exerciseName) {
    if (!exerciseName || !cinesiologiaRules.length) return null;
    const norm = normalizeText(exerciseName);
    for (let i = 0; i < cinesiologiaRules.length; i++) {
        if (norm.includes(cinesiologiaRules[i].key)) {
            return cinesiologiaRules[i].item;
        }
    }
    return null;
}

async function loadExercises() {
    const grid = document.getElementById('exercises-grid');
    try {
        // Carrega base de cinesiologia antes de renderizar os cards
        await loadCinesiologia();

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
        const cleanName = (ex.name || '').replace(/\s*\(\d+\)$/, '').trim();
        const webpSrc = `/assets/webp/${encodeURIComponent(cleanName)}.webp`;
        const asciiName = normalizeText(cleanName);
        const asciiWebp = `/assets/webp/${encodeURIComponent(asciiName)}.webp`;
        let gifFallback = ex.gif || '';
        if (gifFallback.startsWith('images/')) {
            gifFallback = `/assets/gifs/${gifFallback.replace('images/', '')}`;
        } else if (!gifFallback.startsWith('http') && !gifFallback.startsWith('/assets/')) {
            gifFallback = `/assets/gifs/${encodeURIComponent(cleanName)}.gif`;
        }

        const bio = findCinesiologia(ex.name);

        return `
            <div class="glass-card p-4 flex flex-col justify-between hover:border-neoncyan transition relative group/card">
                <div>
                    <!-- Imagem / GIF do Exercício (Prioridade WebP Ultraleve com Fallback automático em 3 Níveis) -->
                    <div class="relative w-full h-44 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 mb-3 flex items-center justify-center">
                        <img 
                            src="${webpSrc}" 
                            alt="${escapeHtml(ex.name)}" 
                            loading="lazy" 
                            onerror="if (!this.dataset.step) { this.dataset.step = 'ascii'; this.src = '${asciiWebp}'; } else if (this.dataset.step === 'ascii') { this.dataset.step = 'gif'; this.src = '${gifFallback || ''}'; } else { this.src = 'https://placehold.co/400x250/111827/00FFFF?text=${encodeURIComponent(ex.name)}'; }"
                            class="w-full h-full object-contain"
                        />
                        <span class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/70 text-neoncyan border border-neoncyan/40">
                            ${ex.group}
                        </span>
                        ${bio ? `
                            <button onclick="openBiomechanicsModal('${bio.id}')" class="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-black/80 text-neoncyan border border-neoncyan/40 hover:bg-neoncyan hover:text-black transition flex items-center space-x-1 backdrop-blur z-10 shadow-sm" title="Prancha Cinesiológica disponível">
                                <i data-lucide="scan" class="w-3 h-3"></i>
                                <span>Raio-X 3D</span>
                            </button>
                        ` : ''}
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
                    <span class="truncate max-w-[100px]">${escapeHtml(ex.when || 'Geral')}</span>
                    <div class="flex items-center space-x-2">
                        ${bio ? `
                            <button onclick="openBiomechanicsModal('${bio.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-neoncyan bg-neoncyan/10 border border-neoncyan/30 hover:bg-neoncyan/25 hover:border-neoncyan transition flex items-center space-x-1 shadow-sm" title="Abrir Raio-X Biomecânico & Cinesiologia">
                                <i data-lucide="scan" class="w-3.5 h-3.5 text-neoncyan"></i>
                                <span>🔬 Raio-X</span>
                            </button>
                        ` : ''}
                        <button onclick="askAIAbaoutExercise('${escapeJsString(ex.name)}')" class="text-gray-400 hover:text-white font-medium flex items-center space-x-1 py-1 px-1.5 transition" title="Tirar dúvida com a IA">
                            <i data-lucide="sparkles" class="w-3 h-3 text-neoncyan"></i>
                            <span>IA</span>
                        </button>
                    </div>
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
        if (typeof autoResizeChatInput === 'function') {
            autoResizeChatInput(input);
        }
        input.focus();
        // Colocar cursor no final do texto
        input.setSelectionRange(input.value.length, input.value.length);
    }
}

// ========================================================
// CONTROLE DO MODAL DE RAIO-X BIOMECÂNICO & CINESIOLOGIA
// ========================================================

function openBiomechanicsModal(cinesioId) {
    const modal = document.getElementById('biomechanics-modal');
    if (!modal) return;

    const data = cinesiologiaMap[cinesioId];
    if (!data) return;

    currentBioZoomed = false;
    const imgEl = document.getElementById('modal-bio-image');
    if (imgEl) {
        imgEl.style.transform = 'scale(1)';
        imgEl.style.cursor = 'zoom-in';
        imgEl.src = data.image;
        imgEl.alt = `Prancha Cinesiológica - ${data.name}`;
    }

    const titleEl = document.getElementById('modal-bio-title');
    if (titleEl) titleEl.textContent = data.name;

    const subEl = document.getElementById('modal-bio-subtitle');
    if (subEl) subEl.textContent = `🔬 Raio-X Biomecânico • ${data.subgroup ? data.subgroup.toUpperCase() : data.group.toUpperCase()}`;

    // Músculos Primários
    const primEl = document.getElementById('modal-bio-primary');
    if (primEl) {
        primEl.innerHTML = (data.primary_muscles && data.primary_muscles.length > 0)
            ? data.primary_muscles.map(m => `<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-600/40">${escapeHtml(m)}</span>`).join('')
            : '<span class="text-gray-500 text-xs">Conforme prancha oficial</span>';
    }

    // Músculos Secundários
    const secEl = document.getElementById('modal-bio-secondary');
    if (secEl) {
        secEl.innerHTML = (data.secondary_muscles && data.secondary_muscles.length > 0)
            ? data.secondary_muscles.map(m => `<span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/40">${escapeHtml(m)}</span>`).join('')
            : '<span class="text-gray-500 text-xs">Músculos sinergistas auxiliares</span>';
    }

    // Estabilizadores
    const estabEl = document.getElementById('modal-bio-stabilizers');
    if (estabEl) {
        estabEl.innerHTML = (data.stabilizers && data.stabilizers.length > 0)
            ? data.stabilizers.map(m => `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-600/30">${escapeHtml(m)}</span>`).join('')
            : '<span class="text-gray-500 text-xs">Core e estabilizadores articulares</span>';
    }

    // Plano Anatômico
    const planeEl = document.getElementById('modal-bio-plane');
    if (planeEl) {
        planeEl.textContent = data.plane || 'Plano sagital';
    }

    // Erros Comuns
    const errEl = document.getElementById('modal-bio-errors');
    if (errEl) {
        errEl.innerHTML = (data.common_errors && data.common_errors.length > 0)
            ? data.common_errors.map(err => `
                <li class="flex items-start space-x-2">
                    <i data-lucide="x-circle" class="w-4 h-4 text-rose-400 shrink-0 mt-0.5"></i>
                    <span class="text-gray-300 text-xs leading-relaxed">${escapeHtml(err)}</span>
                </li>
            `).join('')
            : '<li class="text-xs text-gray-400">Evite cargas excessivas e perda de alinhamento postural.</li>';
    }

    // Execução Correta
    const execEl = document.getElementById('modal-bio-execution');
    if (execEl) {
        execEl.innerHTML = (data.correct_execution && data.correct_execution.length > 0)
            ? data.correct_execution.map(item => `
                <li class="flex items-start space-x-2">
                    <i data-lucide="check-circle-2" class="w-4 h-4 text-neongreen shrink-0 mt-0.5"></i>
                    <span class="text-gray-300 text-xs leading-relaxed">${escapeHtml(item)}</span>
                </li>
            `).join('')
            : '<li class="text-xs text-gray-400">Execute com postura alinhada e movimento controlado.</li>';
    }

    // Dica de Ouro
    const tipEl = document.getElementById('modal-bio-tip');
    if (tipEl) {
        tipEl.textContent = data.golden_tip || 'Mantenha o foco na contração muscular máxima e na cadência controlada.';
    }

    // Botão de Perguntar à IA sobre este Raio-X
    const askBtn = document.getElementById('modal-bio-ask-ai');
    if (askBtn) {
        askBtn.onclick = () => {
            closeBiomechanicsModal();
            askAIAbaoutExercise(data.name);
        };
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    if (window.lucide) {
        lucide.createIcons();
    }
}

function closeBiomechanicsModal() {
    const modal = document.getElementById('biomechanics-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        currentBioZoomed = false;
        const imgEl = document.getElementById('modal-bio-image');
        if (imgEl) {
            imgEl.style.transform = 'scale(1)';
            imgEl.style.cursor = 'zoom-in';
        }
    }
}

function toggleBiomechanicsZoom() {
    const imgEl = document.getElementById('modal-bio-image');
    if (!imgEl) return;
    currentBioZoomed = !currentBioZoomed;
    if (currentBioZoomed) {
        imgEl.style.transform = 'scale(1.75)';
        imgEl.style.cursor = 'zoom-out';
    } else {
        imgEl.style.transform = 'scale(1)';
        imgEl.style.cursor = 'zoom-in';
    }
}

// Fechamento de modais com a tecla ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBiomechanicsModal();
    }
});
