/**
 * Recipes.js - Portal de Receitas Fitness do Shape Mestre
 */

let allRecipes = [];

async function loadRecipes() {
    const grid = document.getElementById('recipes-grid');
    try {
        const response = await fetch('/api/recipes');
        allRecipes = await response.json();
        renderRecipesList();
    } catch (error) {
        console.error('Erro ao carregar receitas:', error);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-400">Erro ao carregar receitas fit.</div>';
    }
}

function renderRecipesList() {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    if (allRecipes.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Nenhuma receita encontrada.</div>';
        return;
    }

    grid.innerHTML = allRecipes.map(r => {
        return `
            <div class="glass-card overflow-hidden flex flex-col justify-between hover:border-neongreen transition">
                <div>
                    <!-- Imagem da Receita -->
                    <div class="relative w-full h-48 overflow-hidden bg-gray-900">
                        <img 
                            src="${r.image}" 
                            alt="${r.title}" 
                            class="w-full h-full object-cover hover:scale-105 transition duration-500"
                        />
                        <div class="absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-black/80 text-neongreen border border-neongreen/40">
                            ${r.category}
                        </div>
                        <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/80 text-gray-300 flex items-center space-x-1">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            <span>${r.prepTime}</span>
                        </div>
                    </div>

                    <div class="p-5">
                        <h3 class="text-lg font-bold text-white mb-2 leading-tight">${r.title}</h3>

                        <!-- Badges de Macronutrientes -->
                        <div class="grid grid-cols-4 gap-1 text-center p-2 rounded-xl bg-gray-950/80 border border-gray-800 mb-4 text-[11px]">
                            <div>
                                <span class="text-gray-400 block text-[9px]">Calorias</span>
                                <span class="font-bold text-white">${r.calories} kcal</span>
                            </div>
                            <div>
                                <span class="text-neoncyan block text-[9px]">Proteína</span>
                                <span class="font-bold text-neoncyan">${r.protein}g</span>
                            </div>
                            <div>
                                <span class="text-neonpink block text-[9px]">Carboidrato</span>
                                <span class="font-bold text-neonpink">${r.carbs}g</span>
                            </div>
                            <div>
                                <span class="text-yellow-400 block text-[9px]">Gordura</span>
                                <span class="font-bold text-yellow-400">${r.fat}g</span>
                            </div>
                        </div>

                        <!-- Ingredientes Principais -->
                        <div class="mb-4">
                            <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Ingredientes:</h4>
                            <ul class="text-xs text-gray-400 space-y-1">
                                ${r.ingredients.map(ing => `<li class="flex items-start space-x-1.5"><span class="text-neongreen">•</span><span>${ing}</span></li>`).join('')}
                            </ul>
                        </div>

                        <!-- Modo de Preparo -->
                        <div>
                            <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Modo de Preparo:</h4>
                            <ol class="text-xs text-gray-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                                ${r.instructions.map(step => `<li>${step}</li>`).join('')}
                            </ol>
                        </div>
                    </div>
                </div>

                <div class="p-5 pt-0">
                    <button onclick="askNutriAboutRecipe('${r.title.replace(/'/g, "\\'")}')" class="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500 hover:text-black transition flex items-center justify-center space-x-1.5">
                        <i data-lucide="salad" class="w-4 h-4"></i>
                        <span>Pedir Substituição à Nutri IA</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) {
        lucide.createIcons();
    }
}

function askNutriAboutRecipe(recipeTitle) {
    switchTab('chat');
    setChatAgent('mia');
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = `Gostei da receita de "${recipeTitle}". Quais alimentos posso usar para substituir os ingredientes caso eu não tenha algum em casa?`;
        input.focus();
    }
}
