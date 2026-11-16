/**
 * Recipes.js - Portal de Receitas Fitness do Shape Mestre (Mais de 120 receitas unificadas)
 * Suporte a busca inteligente por nome ou ingrediente, filtros por categoria e integração com Nutri IA & WhatsApp
 */

let allRecipes = [];
let currentRecipeCategory = 'todas';
let currentRecipeLimit = 24;
let recipeSearchDebounceTimer = null;
let selectedRecipeForModal = null;

// Normalização para busca
function normalizeRecipeText(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function loadRecipes() {
    const grid = document.getElementById('recipes-grid');
    try {
        const response = await fetch('/api/recipes');
        allRecipes = await response.json();
        window.allRecipes = allRecipes;

        // Atualizar contador do botão 'Todas'
        const badgeTodas = document.querySelector('[data-cat="todas"]');
        if (badgeTodas) badgeTodas.textContent = `Todas (${allRecipes.length})`;

        renderRecipesList();
    } catch (error) {
        console.error('Erro ao carregar receitas:', error);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-400">Erro ao carregar receitas fit.</div>';
    }
}

function matchesRecipeCategory(r, cat) {
    if (cat === 'todas') return true;
    const t = (r.type || '').toLowerCase();
    const c = (r.category || '').toLowerCase();

    if (cat === 'pratos') return t.includes('prato') || c.includes('almoço') || c.includes('prato');
    if (cat === 'sucos') return t.includes('suco') || t.includes('chá') || c.includes('suco') || c.includes('chá');
    if (cat === 'smoothies') return t.includes('smoothie');
    if (cat === 'sobremesas') return t.includes('sobremesa') || c.includes('sobremesa');
    if (cat === 'lanches') return t.includes('lanche') || t.includes('pão') || t.includes('café') || c.includes('lanche') || c.includes('pão') || c.includes('café');
    if (cat === 'saladas') return t.includes('salada') || t.includes('sopa') || t.includes('acompanhamento') || c.includes('salada') || c.includes('sopa');
    return false;
}

function setRecipeCategory(cat) {
    currentRecipeCategory = cat;
    currentRecipeLimit = 24;

    document.querySelectorAll('.recipe-cat-btn').forEach(btn => {
        if (btn.dataset.cat === cat) {
            btn.className = 'recipe-cat-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-neongreen text-black shadow-lg shadow-neongreen/20';
        } else {
            btn.className = 'recipe-cat-btn px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-gray-900 text-gray-300 hover:text-white border border-gray-800';
        }
    });

    renderRecipesList();
}

function filterRecipes() {
    currentRecipeLimit = 24;
    clearTimeout(recipeSearchDebounceTimer);
    recipeSearchDebounceTimer = setTimeout(() => {
        renderRecipesList();
    }, 60);
}

function clearRecipeSearch() {
    const input = document.getElementById('search-recipes');
    if (input) {
        input.value = '';
        renderRecipesList();
        input.focus();
    }
}

function loadMoreRecipes() {
    currentRecipeLimit += 24;
    renderRecipesList();
}

function renderRecipesList() {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    const searchInput = document.getElementById('search-recipes');
    const searchVal = searchInput?.value || '';
    const clearBtn = document.getElementById('clear-search-recipes');
    const feedbackEl = document.getElementById('recipe-search-feedback');

    // Botão Limpar
    if (clearBtn) {
        if (searchVal.trim().length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }

    const queryNorm = normalizeRecipeText(searchVal);
    const searchTokens = queryNorm.split(' ').filter(Boolean);

    // Filtragem
    let filtered = allRecipes.filter(r => {
        const matchCat = matchesRecipeCategory(r, currentRecipeCategory);
        if (!queryNorm) return matchCat;

        const titleNorm = normalizeRecipeText(r.title);
        const ingNorm = (r.ingredients || []).map(normalizeRecipeText).join(' ');
        const catNorm = normalizeRecipeText(r.category) + ' ' + normalizeRecipeText(r.type);
        const combined = `${titleNorm} ${ingNorm} ${catNorm}`;

        // Todos os tokens de busca devem bater (multi-termo)
        const matchesTokens = searchTokens.every(token => combined.includes(token));
        return matchCat && matchesTokens;
    });

    // Fallback: Se 0 resultados na categoria selecionada, busca em todas
    let searchedGlobally = false;
    if (filtered.length === 0 && currentRecipeCategory !== 'todas' && queryNorm) {
        searchedGlobally = true;
        filtered = allRecipes.filter(r => {
            const titleNorm = normalizeRecipeText(r.title);
            const ingNorm = (r.ingredients || []).map(normalizeRecipeText).join(' ');
            const catNorm = normalizeRecipeText(r.category) + ' ' + normalizeRecipeText(r.type);
            const combined = `${titleNorm} ${ingNorm} ${catNorm}`;
            return searchTokens.every(token => combined.includes(token));
        });
    }

    // Feedback visual
    if (feedbackEl) {
        if (queryNorm) {
            feedbackEl.classList.remove('hidden');
            if (filtered.length > 0) {
                if (searchedGlobally) {
                    feedbackEl.innerHTML = `✨ Encontradas <strong class="text-neongreen">${filtered.length}</strong> receitas para "<strong>${escapeHtml(searchVal)}</strong>" (mostrando em <em>todas as categorias</em>).`;
                } else {
                    feedbackEl.innerHTML = `✨ Encontradas <strong class="text-neongreen">${filtered.length}</strong> receitas para "<strong>${escapeHtml(searchVal)}</strong>".`;
                }
            } else {
                feedbackEl.innerHTML = `❌ Nenhuma receita encontrada para "<strong>${escapeHtml(searchVal)}</strong>". Tente buscar por ingrediente (ex: frango, banana, whey, aveia).`;
            }
        } else {
            feedbackEl.classList.add('hidden');
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                    <i data-lucide="salad" class="w-8 h-8"></i>
                </div>
                <h4 class="text-white font-bold text-base mb-1">Nenhuma receita encontrada</h4>
                <p class="text-gray-400 text-xs max-w-sm mx-auto mb-4">Não encontramos receitas com os filtros atuais. Tente buscar por ingrediente como frango, ovos, whey, banana ou limpe a busca.</p>
                <button onclick="clearRecipeSearch(); setRecipeCategory('todas');" class="px-4 py-2 rounded-xl text-xs font-bold bg-neongreen text-black hover:bg-emerald-400 transition">
                    Ver Todas as ${allRecipes.length} Receitas
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const displayList = filtered.slice(0, currentRecipeLimit);

    grid.innerHTML = displayList.map(r => {
        return `
            <div class="glass-card overflow-hidden flex flex-col justify-between hover:border-neongreen transition cursor-pointer group" onclick="openRecipeModal(${r.id})">
                <div>
                    <!-- Imagem da Receita -->
                    <div class="relative w-full h-44 overflow-hidden bg-gray-900">
                        <img 
                            src="${r.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60'}" 
                            alt="${escapeHtml(r.title)}" 
                            loading="lazy"
                            class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div class="absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-black/80 text-neongreen border border-neongreen/40">
                            ${escapeHtml(r.category || r.type)}
                        </div>
                        <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/80 text-gray-300 flex items-center space-x-1">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            <span>${escapeHtml(r.prepTime)}</span>
                        </div>
                    </div>

                    <div class="p-4 sm:p-5">
                        <h3 class="text-base sm:text-lg font-bold text-white mb-2 leading-tight group-hover:text-neongreen transition">${escapeHtml(r.title)}</h3>

                        <!-- Badges de Macronutrientes -->
                        <div class="grid grid-cols-4 gap-1 text-center p-2 rounded-xl bg-gray-950/80 border border-gray-800 mb-3 text-[11px]">
                            <div>
                                <span class="text-gray-400 block text-[9px]">Calorias</span>
                                <span class="font-bold text-white">${r.calories} <span class="text-[8px] font-normal">kcal</span></span>
                            </div>
                            <div>
                                <span class="text-neoncyan block text-[9px]">Proteína</span>
                                <span class="font-bold text-neoncyan">${r.protein}g</span>
                            </div>
                            <div>
                                <span class="text-neonpink block text-[9px]">Carb</span>
                                <span class="font-bold text-neonpink">${r.carbs}g</span>
                            </div>
                            <div>
                                <span class="text-yellow-400 block text-[9px]">Gordura</span>
                                <span class="font-bold text-yellow-400">${r.fat}g</span>
                            </div>
                        </div>

                        <!-- Prévia de Ingredientes -->
                        <p class="text-xs text-gray-400 line-clamp-2 mb-3">
                            <strong class="text-gray-300">Ingredientes:</strong> ${(r.ingredients || []).slice(0, 4).join(', ')}${(r.ingredients || []).length > 4 ? '...' : ''}
                        </p>
                    </div>
                </div>

                <div class="p-4 sm:p-5 pt-0">
                    <button class="w-full py-2 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-black transition flex items-center justify-center space-x-1.5 shadow">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                        <span>Ver Receita Completa</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (filtered.length > currentRecipeLimit) {
        grid.innerHTML += `
            <div class="col-span-full text-center py-6">
                <button onclick="loadMoreRecipes()" class="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neongreen text-black hover:bg-emerald-400 transition shadow-lg shadow-neongreen/20">
                    Carregar Mais Receitas (${filtered.length - currentRecipeLimit} restantes)
                </button>
            </div>
        `;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// Modal de Detalhes da Receita
function openRecipeModal(recipeId) {
    const recipe = allRecipes.find(r => r.id === recipeId);
    if (!recipe) return;

    selectedRecipeForModal = recipe;
    const modal = document.getElementById('recipe-modal');
    if (!modal) return;

    document.getElementById('modal-recipe-title').textContent = recipe.title;
    document.getElementById('modal-recipe-category').textContent = `${recipe.category || recipe.type} • ${recipe.prepTime} • ${recipe.difficulty || 'Fácil'}`;
    
    const imgEl = document.getElementById('modal-recipe-image');
    if (imgEl) {
        imgEl.src = recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60';
        imgEl.alt = recipe.title;
    }

    document.getElementById('modal-recipe-cal').textContent = `${recipe.calories} kcal`;
    document.getElementById('modal-recipe-prot').textContent = `${recipe.protein}g`;
    document.getElementById('modal-recipe-carb').textContent = `${recipe.carbs}g`;
    document.getElementById('modal-recipe-fat').textContent = `${recipe.fat}g`;

    // Ingredientes
    const ingList = document.getElementById('modal-recipe-ingredients');
    if (ingList) {
        ingList.innerHTML = (recipe.ingredients || []).map(ing => `
            <li class="flex items-start space-x-2">
                <span class="text-neongreen font-bold">•</span>
                <span class="text-gray-200">${escapeHtml(ing)}</span>
            </li>
        `).join('');
    }

    // Modo de preparo
    const instList = document.getElementById('modal-recipe-instructions');
    if (instList) {
        instList.innerHTML = (recipe.instructions || []).map((step, idx) => `
            <li class="flex items-start space-x-2.5">
                <span class="w-5 h-5 rounded-full bg-emerald-950 text-neongreen border border-neongreen/40 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">${idx + 1}</span>
                <span class="text-gray-300 leading-relaxed">${escapeHtml(step)}</span>
            </li>
        `).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeRecipeModal() {
    const modal = document.getElementById('recipe-modal');
    if (modal) modal.classList.add('hidden');
}

// Perguntar à Nutri IA sobre a receita aberta
function askNutriAboutCurrentRecipe() {
    if (!selectedRecipeForModal) return;
    const title = selectedRecipeForModal.title;
    closeRecipeModal();
    switchTab('chat');
    setChatAgent('mia');
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = `Gostei da receita "${title}". Como posso encaixá-la na minha meta de macros e quais substituições você sugere?`;
        input.focus();
    }
}

// Enviar receita para WhatsApp
function shareCurrentRecipeWhatsApp() {
    if (!selectedRecipeForModal) return;
    const r = selectedRecipeForModal;

    const ingText = (r.ingredients || []).map(i => `• ${i}`).join('\n');
    const instText = (r.instructions || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n');

    const message = `🥗 *RECEITA FITNESS SHAPE MESTRE*\n\n` +
                    `*${r.title.toUpperCase()}*\n` +
                    `⏱️ Tempo: ${r.prepTime} | 🏷️ Categoria: ${r.category}\n\n` +
                    `📊 *Macronutrientes:*\n` +
                    `🔥 Calorias: ${r.calories} kcal\n` +
                    `💪 Proteínas: ${r.protein}g | 🌾 Carboidratos: ${r.carbs}g | 🥑 Gorduras: ${r.fat}g\n\n` +
                    `🛒 *Ingredientes:*\n${ingText}\n\n` +
                    `👨‍🍳 *Modo de Preparo:*\n${instText}\n\n` +
                    `_Enviado pelo seu aplicativo Shape Mestre_ 🔥`;

    closeRecipeModal();
    window.currentWhatsAppShareText = message;
    window.currentWhatsAppShareTitle = r.title;
    openWhatsAppShareModal();
}
