/**
 * Exercises.js - Catálogo Completo de Exercícios & Biomecânica (Shape Mestre)
 */

let allExercises = [];
let currentMuscleGroup = 'todos';
let currentDisplayLimit = 60;

async function loadExercises() {
    const grid = document.getElementById('exercises-grid');
    try {
        const response = await fetch('/api/exercises');
        allExercises = await response.json();
        window.allExercises = allExercises;
        
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
            btn.className = 'group-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-neoncyan text-black';
        } else {
            btn.className = 'group-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-gray-900 text-gray-300 hover:text-white border border-gray-800';
        }
    });

    renderExercisesList();
}

function filterExercises() {
    currentDisplayLimit = 60;
    renderExercisesList();
}

function loadMoreExercises() {
    currentDisplayLimit += 60;
    renderExercisesList();
}

function renderExercisesList() {
    const grid = document.getElementById('exercises-grid');
    const searchVal = (document.getElementById('search-exercises')?.value || '').toLowerCase();

    const filtered = allExercises.filter(ex => {
        const matchGroup = currentMuscleGroup === 'todos' || ex.group === currentMuscleGroup;
        const matchSearch = ex.name.toLowerCase().includes(searchVal) ||
                            (ex.muscles && ex.muscles.toLowerCase().includes(searchVal)) ||
                            (ex.why && ex.why.toLowerCase().includes(searchVal));
        return matchGroup && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Nenhum exercício encontrado com esses termos.</div>';
        return;
    }

    // Limitar renderização para performance com paginação progressiva
    const displayList = filtered.slice(0, currentDisplayLimit);

    grid.innerHTML = displayList.map((ex, index) => {
        // Tratar URL do GIF (se for link externo ou local)
        let gifSrc = ex.gif || '';
        if (gifSrc.startsWith('images/')) {
            // Rota para GIFs locais
            gifSrc = `/assets/gifs/${gifSrc.replace('images/', '')}`;
        }

        return `
            <div class="glass-card p-4 flex flex-col justify-between hover:border-neoncyan transition">
                <div>
                    <!-- Imagem / GIF do Exercício -->
                    <div class="relative w-full h-44 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 mb-3 flex items-center justify-center">
                        <img 
                            src="${gifSrc || 'https://placehold.co/400x250/111827/00FFFF?text=Shape+Mestre'}" 
                            alt="${ex.name}" 
                            loading="lazy" 
                            onerror="this.src='https://placehold.co/400x250/111827/00FFFF?text=${encodeURIComponent(ex.name)}'"
                            class="w-full h-full object-contain"
                        />
                        <span class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black/70 text-neoncyan border border-neoncyan/40">
                            ${ex.group}
                        </span>
                    </div>

                    <h3 class="text-base font-bold text-white mb-1.5 leading-snug">${ex.name}</h3>
                    <p class="text-xs text-neoncyan/90 font-medium mb-3">${ex.muscles || 'Músculos principais'}</p>

                    <!-- Detalhes do Exercício -->
                    <div class="space-y-2 text-xs text-gray-300">
                        <div class="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800/80">
                            <span class="font-bold text-neonpink block mb-0.5">Como Executar:</span>
                            <p class="text-gray-300 leading-relaxed">${ex.how || 'Execute com postura alinhada e movimento controlado.'}</p>
                        </div>
                        ${ex.why ? `
                            <div class="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800/80">
                                <span class="font-bold text-neongreen block mb-0.5">Por que fazer:</span>
                                <p class="text-gray-400 leading-relaxed">${ex.why}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                    <span>${ex.when || 'Geral'}</span>
                    <button onclick="askAIAbaoutExercise('${ex.name.replace(/'/g, "\\'")}')" class="text-neoncyan hover:underline font-bold flex items-center space-x-1">
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
