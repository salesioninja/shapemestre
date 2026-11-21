/**
 * nutrition.js - Módulo de Registro de Refeições por Foto com IA e Tabela TACO
 * Shape Mestre - PWA
 */

// Estado global do módulo de nutrição
let currentPhotoBlob = null;
let currentThumbnailDataUrl = null;
let tacoCatalog = [];
let tacoCategories = [];

/**
 * 1. COMPRESSÃO DE IMAGEM NO CLIENT-SIDE (Adaptado do calorie-ai-tracker)
 * Redimensiona a imagem para lado máximo de 1280px (85% qualidade) para envio
 * e gera uma miniatura de 320px (70% qualidade) para o diário local.
 */
async function compressImage(file, maxSide, quality) {
    if ('createImageBitmap' in window) {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            const w = Math.max(1, Math.round(bitmap.width * scale));
            const h = Math.max(1, Math.round(bitmap.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, w, h);

            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
            });
        } catch (e) {
            console.warn('Fallback para canvas tradicional:', e);
        }
    }

    // Fallback tradicional com HTMLImageElement
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * 2. FLUXO DE CAPTURA E UPLOAD DE FOTO
 */
function selectMealType(type) {
    const hidden = document.getElementById('selected-meal-type') || document.getElementById('meal-type-select');
    if (hidden) hidden.value = type;
    
    document.querySelectorAll('.meal-type-btn').forEach(btn => {
        if (btn.dataset.type === type) {
            btn.classList.add('border-neonpink', 'bg-neonpink/20', 'text-white');
            btn.classList.remove('border-gray-800', 'bg-gray-900', 'text-gray-300');
        } else {
            btn.classList.remove('border-neonpink', 'bg-neonpink/20', 'text-white');
            btn.classList.add('border-gray-800', 'bg-gray-900', 'text-gray-300');
        }
    });
}

function resetPhotoSelection() {
    currentPhotoBlob = null;
    currentThumbnailDataUrl = null;
    const input = document.getElementById('meal-photo-input');
    if (input) input.value = '';

    const preview = document.getElementById('photo-preview-img') || document.getElementById('meal-photo-preview');
    if (preview) preview.src = '';

    const previewWrapper = document.getElementById('photo-preview-wrapper') || document.getElementById('meal-photo-preview-container');
    if (previewWrapper) previewWrapper.classList.add('hidden');

    const placeholder = document.getElementById('photo-placeholder-content');
    if (placeholder) placeholder.classList.remove('hidden');

    const sizeInfo = document.getElementById('meal-photo-size-info');
    if (sizeInfo) sizeInfo.textContent = '';

    const analyzeBtn = document.getElementById('btn-submit-meal-photo') || document.getElementById('btn-analyze-meal');
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const loadingState = document.getElementById('photo-analysis-loading') || document.getElementById('meal-loading-state');
    if (loadingState) loadingState.classList.add('hidden');
}

function openPhotoMealModal() {
    const modal = document.getElementById('photo-meal-modal');
    if (!modal) return;

    resetPhotoSelection();

    // Pré-selecionar tipo de refeição com base no horário do dia
    const hour = new Date().getHours();
    let defaultType = 'Almoço';
    if (hour >= 5 && hour < 11) defaultType = 'Café da Manhã';
    else if (hour >= 11 && hour < 15) defaultType = 'Almoço';
    else if (hour >= 15 && hour < 19) defaultType = 'Lanche';
    else defaultType = 'Jantar';
    selectMealType(defaultType);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePhotoMealModal() {
    const modal = document.getElementById('photo-meal-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleMealPhotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const preview = document.getElementById('photo-preview-img') || document.getElementById('meal-photo-preview');
    const previewWrapper = document.getElementById('photo-preview-wrapper') || document.getElementById('meal-photo-preview-container');
    const placeholder = document.getElementById('photo-placeholder-content');
    const sizeInfo = document.getElementById('meal-photo-size-info');
    const analyzeBtn = document.getElementById('btn-submit-meal-photo') || document.getElementById('btn-analyze-meal');

    const originalSizeKb = (file.size / 1024).toFixed(0);

    try {
        if (sizeInfo) sizeInfo.textContent = 'Comprimindo e otimizando imagem...';

        // Comprime para o modelo (1280px) e para thumbnail (320px)
        const [fullBlob, thumbBlob] = await Promise.all([
            compressImage(file, 1280, 0.85),
            compressImage(file, 320, 0.7)
        ]);

        currentPhotoBlob = fullBlob;
        currentThumbnailDataUrl = await blobToDataURL(thumbBlob);

        const compressedSizeKb = (fullBlob.size / 1024).toFixed(0);

        if (preview) preview.src = currentThumbnailDataUrl;
        if (previewWrapper) previewWrapper.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');

        if (sizeInfo) {
            sizeInfo.innerHTML = `Otimizada: <span class="text-neoncyan font-bold">${compressedSizeKb} KB</span> (reduzida de ${originalSizeKb} KB ⚡)`;
        }

        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    } catch (err) {
        console.error('Erro ao processar imagem:', err);
        showToast('Erro ao processar foto. Tente novamente.', 'error');
    }
}

async function submitMealPhotoAnalysis() {
    if (!currentPhotoBlob) {
        showToast('Selecione ou tire uma foto da refeição primeiro.', 'error');
        return;
    }

    const mealType = document.getElementById('selected-meal-type')?.value 
                  || document.getElementById('meal-type-select')?.value 
                  || 'Almoço';
    const notes = document.getElementById('meal-photo-notes')?.value 
               || document.getElementById('meal-notes-input')?.value 
               || '';
    const loadingState = document.getElementById('photo-analysis-loading') 
                      || document.getElementById('meal-loading-state');
    const loadingText = document.getElementById('photo-loading-text') 
                     || document.getElementById('meal-loading-text');
    const analyzeBtn = document.getElementById('btn-submit-meal-photo') 
                    || document.getElementById('btn-analyze-meal');

    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (loadingState) loadingState.classList.remove('hidden');

    const loadingSteps = [
        'Enviando foto comprimida com segurança...',
        'IA identificando alimentos no prato...',
        'Consultando parâmetros nutricionais brasileiros...',
        'Calculando calorias, macros e benefícios de saúde...'
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
        stepIdx = (stepIdx + 1) % loadingSteps.length;
        if (loadingText) loadingText.textContent = loadingSteps[stepIdx];
    }, 1800);

    try {
        const formData = new FormData();
        formData.append('image', currentPhotoBlob, 'meal.jpg');
        formData.append('mealType', mealType);
        formData.append('notes', notes);

        const res = await fetch('/api/nutrition/analyze-meal', {
            method: 'POST',
            body: formData
        });

        clearInterval(interval);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.details || errData.error || `Erro HTTP ${res.status}`);
        }

        const data = await res.json();
        const mealResult = data.meal;

        // Registrar automaticamente no Diário Alimentar e obter registro com id válido
        const savedRecord = registerMealInDiary(mealResult, currentThumbnailDataUrl);

        closePhotoMealModal();
        showToast(`"${savedRecord.title || mealResult.titulo_prato || 'Refeição'}" registrada com sucesso!`, 'success');

        // Exibir modal de detalhamento e ajuste rápido com o registro gravado
        openMealDetailsModal(savedRecord, currentThumbnailDataUrl);

    } catch (err) {
        clearInterval(interval);
        console.error('Erro ao analisar refeição:', err);
        showToast(`Erro na análise: ${err.message}`, 'error');
    } finally {
        if (loadingState) loadingState.classList.add('hidden');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 3. INTEGRAÇÃO COM O DIÁRIO ALIMENTAR
 */
function registerMealInDiary(mealAnalysis, thumbnailDataUrl) {
    let diary = [];
    try {
        const saved = localStorage.getItem('shape_food_diary');
        if (saved) diary = JSON.parse(saved);
    } catch (e) {
        diary = [];
    }

    const record = {
        id: Date.now(),
        date: new Date().toISOString(),
        mealType: mealAnalysis.tipo_refeicao || 'Refeição',
        title: mealAnalysis.titulo_prato || 'Refeição com IA',
        thumbnail: thumbnailDataUrl || null,
        kcal: mealAnalysis.totais?.calorias_kcal || 0,
        protein: mealAnalysis.totais?.proteinas_g || 0,
        carbs: mealAnalysis.totais?.carboidratos_g || 0,
        fat: mealAnalysis.totais?.gorduras_g || 0,
        fiber: mealAnalysis.totais?.fibras_g || 0,
        totais: mealAnalysis.totais || {
            calorias_kcal: mealAnalysis.totais?.calorias_kcal || 0,
            proteinas_g: mealAnalysis.totais?.proteinas_g || 0,
            carboidratos_g: mealAnalysis.totais?.carboidratos_g || 0,
            gorduras_g: mealAnalysis.totais?.gorduras_g || 0,
            fibras_g: mealAnalysis.totais?.fibras_g || 0
        },
        alimentos: mealAnalysis.alimentos || [],
        resumo: mealAnalysis.resumo_prato || '',
        veredito: mealAnalysis.veredito || '',
        ponto_atencao: mealAnalysis.ponto_atencao || '',
        dica_nutri: mealAnalysis.dica_nutri || '',
        confianca: mealAnalysis.confianca || 'alta'
    };

    diary.unshift(record);
    localStorage.setItem('shape_food_diary', JSON.stringify(diary));

    if (typeof foodDiary !== 'undefined' && Array.isArray(foodDiary)) {
        foodDiary.unshift(record);
    }

    // Atualizar renderização do diário se profile.js estiver carregado
    if (typeof renderFoodDiary === 'function') {
        renderFoodDiary();
    }

    return record;
}

/**
 * 4. MODAL DE DETALHES DA REFEIÇÃO COM BENEFÍCIOS E AJUSTE RÁPIDO
 */
function openMealDetailsModal(meal, thumbnail) {
    const modal = document.getElementById('meal-details-modal');
    if (!modal || !meal) return;

    if (!meal.id) {
        meal.id = Date.now();
    }
    window.currentActiveMeal = meal;

    const titleEl = document.getElementById('details-meal-title');
    const typeEl = document.getElementById('details-meal-type');
    const thumbEl = document.getElementById('details-meal-thumb');
    const kcalEl = document.getElementById('details-meal-kcal');
    const protEl = document.getElementById('details-meal-prot');
    const carbEl = document.getElementById('details-meal-carb');
    const fatEl = document.getElementById('details-meal-fat');
    const fiberEl = document.getElementById('details-meal-fiber');
    const summaryEl = document.getElementById('details-meal-summary');
    const foodsListEl = document.getElementById('details-meal-foods-list');

    if (titleEl) titleEl.textContent = meal.titulo_prato || meal.title || 'Refeição Registrada';
    if (typeEl) typeEl.textContent = meal.tipo_refeicao || meal.mealType || 'Refeição';
    if (thumbEl) {
        const img = thumbnail || meal.thumbnail;
        if (img) {
            thumbEl.src = img;
            thumbEl.classList.remove('hidden');
        } else {
            thumbEl.classList.add('hidden');
        }
    }

    const totais = meal.totais || {
        calorias_kcal: meal.kcal,
        proteinas_g: meal.protein,
        carboidratos_g: meal.carbs,
        gorduras_g: meal.fat,
        fibras_g: meal.fiber
    };

    if (kcalEl) kcalEl.textContent = `${totais.calorias_kcal || 0} kcal`;
    if (protEl) protEl.textContent = `${totais.proteinas_g || 0}g`;
    if (carbEl) carbEl.textContent = `${totais.carboidratos_g || 0}g`;
    if (fatEl) fatEl.textContent = `${totais.gorduras_g || 0}g`;
    if (fiberEl) fiberEl.textContent = `${totais.fibras_g || 0}g`;

    if (summaryEl) {
        const veredito = meal.veredito;
        const atencao = meal.ponto_atencao;
        const dica = meal.dica_nutri;
        const resumoGeral = meal.resumo_prato || meal.resumo || '';

        if (veredito || atencao || dica) {
            summaryEl.innerHTML = `
                ${veredito ? `
                    <div class="p-2.5 rounded-xl bg-neoncyan/10 border border-neoncyan/30 flex items-start space-x-2">
                        <span class="text-base shrink-0 leading-none">🎯</span>
                        <div>
                            <span class="text-[10px] uppercase font-bold text-neoncyan block mb-0.5">Veredito da Nutri</span>
                            <p class="text-xs text-white font-medium leading-relaxed">${escapeHtml(veredito)}</p>
                        </div>
                    </div>
                ` : ''}

                ${atencao ? `
                    <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2">
                        <span class="text-base shrink-0 leading-none">⚠️</span>
                        <div>
                            <span class="text-[10px] uppercase font-bold text-amber-400 block mb-0.5">Ponto de Atenção</span>
                            <p class="text-xs text-gray-200 leading-relaxed">${escapeHtml(atencao)}</p>
                        </div>
                    </div>
                ` : ''}

                ${dica ? `
                    <div class="p-2.5 rounded-xl bg-neongreen/10 border border-neongreen/30 flex items-start space-x-2">
                        <span class="text-base shrink-0 leading-none">💡</span>
                        <div>
                            <span class="text-[10px] uppercase font-bold text-neongreen block mb-0.5">Dica Prática da Nutri</span>
                            <p class="text-xs text-gray-200 leading-relaxed">${escapeHtml(dica)}</p>
                        </div>
                    </div>
                ` : ''}
            `;
        } else {
            summaryEl.innerHTML = `
                <div class="p-2.5 rounded-xl bg-gray-900 border border-gray-800">
                    <p class="text-xs text-gray-300 leading-relaxed">${escapeHtml(resumoGeral || 'Refeição registrada com sucesso.')}</p>
                </div>
            `;
        }
    }

    if (foodsListEl && meal.alimentos) {
        foodsListEl.innerHTML = meal.alimentos.map((al, idx) => {
            // Inicializar valores base para garantir precisão absoluta nas proporções
            if (!al._base_g) {
                al._base_g = Number(al.porcao_estimada_g) || 100;
                al._base_p = Number(al.proteinas_g) || 0;
                al._base_c = Number(al.carboidratos_g) || 0;
                al._base_gord = Number(al.gorduras_g) || 0;
                al._base_fib = Number(al.fibras_g) || 0;
            }

            return `
            <div class="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800 text-xs flex flex-col space-y-2.5 hover:border-neoncyan/40 transition">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-white text-sm">${escapeHtml(al.nome)}</span>
                    <span class="font-extrabold text-neonpink text-sm" id="food-kcal-${idx}">${al.calorias_kcal} kcal</span>
                </div>

                <div class="flex items-center space-x-2 text-[11px] text-gray-400 flex-wrap">
                    <span class="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 font-medium text-neoncyan" id="food-portion-badge-${idx}">
                        ${al.porcao_estimada_g}g (${al.medida_caseira || 'porção'})
                    </span>
                    <span id="food-macros-${idx}">P: ${al.proteinas_g}g • C: ${al.carboidratos_g}g • G: ${al.gorduras_g}g ${al.fibras_g ? `• Fib: ${al.fibras_g}g` : ''}</span>
                </div>

                ${al.beneficios ? `
                    <div class="p-2 rounded-lg bg-neongreen/5 border border-neongreen/20 text-[11px] text-gray-300 flex items-start space-x-1.5">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-neongreen shrink-0 mt-0.5"></i>
                        <span><strong class="text-neongreen">Benefícios:</strong> ${escapeHtml(al.beneficios)}</span>
                    </div>
                ` : ''}

                <!-- Controle Reativo de Ajuste em Tempo Real -->
                <div class="flex items-center justify-between pt-2 border-t border-gray-800/80 text-[11px] gap-2 flex-wrap">
                    <div class="flex items-center space-x-2">
                        <span class="text-gray-400 font-medium">Ajustar peso:</span>
                        <div class="inline-flex items-center bg-gray-900 border border-gray-700/80 rounded-lg p-0.5 shadow-inner">
                            <button type="button" onclick="stepMealPortion(${idx}, -10)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded active:scale-95 transition font-bold text-sm select-none" title="Diminuir 10g">−</button>
                            <input type="number" min="5" max="3000" value="${al.porcao_estimada_g}" 
                                id="edit-portion-${idx}" 
                                oninput="liveUpdateMealFoodPortion(${idx}, this.value)"
                                class="w-14 bg-transparent text-xs text-white text-center font-extrabold focus:outline-none focus:text-neonpink">
                            <span class="text-[10px] text-gray-500 pr-1 select-none">g</span>
                            <button type="button" onclick="stepMealPortion(${idx}, 10)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded active:scale-95 transition font-bold text-sm select-none" title="Aumentar 10g">+</button>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1.5 ml-auto">
                        <span id="live-indicator-${idx}" class="text-[10px] text-gray-500 flex items-center gap-1 font-medium transition-colors">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Tempo real</span>
                        </span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (window.lucide) lucide.createIcons();
}

let debounceSaveMealTimer = null;

function stepMealPortion(foodIdx, delta) {
    const input = document.getElementById(`edit-portion-${foodIdx}`);
    if (!input) return;
    const current = parseInt(input.value) || 0;
    const next = Math.max(5, Math.min(3000, current + delta));
    input.value = next;
    liveUpdateMealFoodPortion(foodIdx, next);
}

function liveUpdateMealFoodPortion(foodIdx, rawGrams) {
    const parsed = parseInt(rawGrams);
    if (isNaN(parsed) || parsed <= 0) {
        return; // Usuário está editando/apagando; não interrompe a digitação
    }
    const newGrams = Math.max(5, Math.min(3000, parsed));

    let diary = [];
    try {
        diary = JSON.parse(localStorage.getItem('shape_food_diary') || '[]');
    } catch (e) {
        diary = [];
    }

    let meal = window.currentActiveMeal;
    let diaryIdx = -1;

    if (meal && meal.id) {
        diaryIdx = diary.findIndex(m => String(m.id) === String(meal.id));
    }
    if (diaryIdx === -1 && diary.length > 0) {
        diaryIdx = 0;
        meal = diary[0];
        window.currentActiveMeal = meal;
    }

    if (!meal || !meal.alimentos || !meal.alimentos[foodIdx]) {
        console.warn('Alimento não encontrado para ajuste:', foodIdx);
        return;
    }

    const al = meal.alimentos[foodIdx];

    // Salva valores base na primeira vez para nunca perder precisão matemática
    if (!al._base_g) {
        al._base_g = Number(al.porcao_estimada_g) || 100;
        al._base_p = Number(al.proteinas_g) || 0;
        al._base_c = Number(al.carboidratos_g) || 0;
        al._base_gord = Number(al.gorduras_g) || 0;
        al._base_fib = Number(al.fibras_g) || 0;
    }

    const ratio = newGrams / al._base_g;
    al.porcao_estimada_g = newGrams;
    al.proteinas_g = Math.round((al._base_p * ratio) * 10) / 10;
    al.carboidratos_g = Math.round((al._base_c * ratio) * 10) / 10;
    al.gorduras_g = Math.round((al._base_gord * ratio) * 10) / 10;
    al.fibras_g = Math.round((al._base_fib * ratio) * 10) / 10;
    al.calorias_kcal = Math.round((al.proteinas_g * 4) + (al.carboidratos_g * 4) + (al.gorduras_g * 9));

    // 1. Atualiza elementos do alimento no DOM em tempo real
    const kcalEl = document.getElementById(`food-kcal-${foodIdx}`);
    if (kcalEl) kcalEl.textContent = `${al.calorias_kcal} kcal`;

    const portionEl = document.getElementById(`food-portion-badge-${foodIdx}`);
    if (portionEl) portionEl.textContent = `${newGrams}g (${al.medida_caseira || 'porção'})`;

    const macrosEl = document.getElementById(`food-macros-${foodIdx}`);
    if (macrosEl) {
        macrosEl.innerHTML = `P: ${al.proteinas_g}g • C: ${al.carboidratos_g}g • G: ${al.gorduras_g}g ${al.fibras_g ? `• Fib: ${al.fibras_g}g` : ''}`;
    }

    const indEl = document.getElementById(`live-indicator-${foodIdx}`);
    if (indEl) {
        indEl.innerHTML = '<span class="text-neongreen font-semibold flex items-center gap-1">✓ Atualizado</span>';
        clearTimeout(indEl._resetTimer);
        indEl._resetTimer = setTimeout(() => {
            indEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>Tempo real</span>';
        }, 1500);
    }

    // 2. Recalcula totais da refeição
    let totKcal = 0, totP = 0, totC = 0, totG = 0, totFib = 0;
    meal.alimentos.forEach(item => {
        totKcal += item.calorias_kcal || 0;
        totP += item.proteinas_g || 0;
        totC += item.carboidratos_g || 0;
        totG += item.gorduras_g || 0;
        totFib += item.fibras_g || 0;
    });

    meal.totais = {
        calorias_kcal: Math.round(totKcal),
        proteinas_g: Math.round(totP * 10) / 10,
        carboidratos_g: Math.round(totC * 10) / 10,
        gorduras_g: Math.round(totG * 10) / 10,
        fibras_g: Math.round(totFib * 10) / 10
    };
    meal.kcal = meal.totais.calorias_kcal;
    meal.protein = meal.totais.proteinas_g;
    meal.carbs = meal.totais.carboidratos_g;
    meal.fat = meal.totais.gorduras_g;
    meal.fiber = meal.totais.fibras_g;

    // 3. Atualiza os cards de totais no topo do modal imediatamente
    const dKcal = document.getElementById('details-meal-kcal');
    const dProt = document.getElementById('details-meal-prot');
    const dCarb = document.getElementById('details-meal-carb');
    const dFat = document.getElementById('details-meal-fat');
    const dFib = document.getElementById('details-meal-fiber');

    if (dKcal) dKcal.textContent = `${meal.totais.calorias_kcal} kcal`;
    if (dProt) dProt.textContent = `${meal.totais.proteinas_g}g`;
    if (dCarb) dCarb.textContent = `${meal.totais.carboidratos_g}g`;
    if (dFat) dFat.textContent = `${meal.totais.gorduras_g}g`;
    if (dFib) dFib.textContent = `${meal.totais.fibras_g}g`;

    // 4. Salva no localStorage e mantém array em memória do profile.js em sincronia
    if (diaryIdx !== -1 && diary[diaryIdx]) {
        diary[diaryIdx] = meal;
    }
    clearTimeout(debounceSaveMealTimer);
    debounceSaveMealTimer = setTimeout(() => {
        localStorage.setItem('shape_food_diary', JSON.stringify(diary));
        if (typeof foodDiary !== 'undefined' && Array.isArray(foodDiary)) {
            const fIdx = foodDiary.findIndex(m => String(m.id) === String(meal.id));
            if (fIdx !== -1) foodDiary[fIdx] = meal;
        }
        if (typeof renderFoodDiary === 'function') renderFoodDiary();
    }, 300);
}

// Mantém suporte para chamadas legadas
function updateMealFoodPortion(arg1, arg2) {
    const foodIdx = (arg2 !== undefined) ? arg2 : arg1;
    const input = document.getElementById(`edit-portion-${foodIdx}`);
    if (input) {
        liveUpdateMealFoodPortion(foodIdx, input.value);
    }
}

function openMealDetailsById(id) {
    const list = (typeof foodDiary !== 'undefined' && Array.isArray(foodDiary)) 
        ? foodDiary 
        : JSON.parse(localStorage.getItem('shape_food_diary') || '[]');
    const item = list.find(it => it.id === id);
    if (item) {
        openMealDetailsModal(item, item.thumbnail);
    }
}

function closeMealDetailsModal() {
    const modal = document.getElementById('meal-details-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * 5. CATÁLOGO BRASILEIRO (TABELA TACO) COM BENEFÍCIOS
 */
async function loadTacoCatalog() {
    if (tacoCatalog.length > 0) return;

    try {
        // Tenta buscar estático primeiro (cache offline imediato) ou da API
        const res = await fetch('/data/taco.json').catch(() => fetch('/api/nutrition/taco'));
        if (res && res.ok) {
            tacoCatalog = await res.json();
            const catSet = new Set(tacoCatalog.map(item => item.categoria).filter(Boolean));
            tacoCategories = ['Todos', ...Array.from(catSet).sort()];
            renderTacoCategoryPills();
        }
    } catch (e) {
        console.warn('Falha ao carregar Tabela TACO:', e);
    }
}

function openTacoCatalogModal() {
    loadTacoCatalog().then(() => {
        const modal = document.getElementById('taco-catalog-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            filterTacoFoods();
        }
    });
}

function closeTacoCatalogModal() {
    const modal = document.getElementById('taco-catalog-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

let currentTacoCategory = 'Todos';

function renderTacoCategoryPills() {
    const container = document.getElementById('taco-category-pills');
    if (!container) return;

    container.innerHTML = tacoCategories.slice(0, 8).map(cat => `
        <button 
            onclick="setTacoCategory('${cat}')" 
            class="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition border ${currentTacoCategory === cat ? 'bg-neongreen text-black border-neongreen' : 'bg-gray-900 text-gray-300 border-gray-800 hover:border-gray-700'}">
            ${cat}
        </button>
    `).join('');
}

function setTacoCategory(cat) {
    currentTacoCategory = cat;
    renderTacoCategoryPills();
    filterTacoFoods();
}

function filterTacoFoods() {
    const input = document.getElementById('search-taco');
    const query = (input?.value || '').trim().toLowerCase();
    const listEl = document.getElementById('taco-foods-list');
    const countEl = document.getElementById('taco-count-info');

    if (!listEl) return;

    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normQuery = normalize(query);

    const filtered = tacoCatalog.filter(f => {
        const matchesCategory = currentTacoCategory === 'Todos' || f.categoria === currentTacoCategory;
        const matchesName = !normQuery || normalize(f.nome).includes(normQuery);
        return matchesCategory && matchesName;
    });

    if (countEl) {
        countEl.textContent = `${filtered.length} alimentos encontrados`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12 text-gray-500 text-xs">
                <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 text-gray-600"></i>
                <p>Nenhum alimento encontrado na Tabela TACO para "${query}".</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    listEl.innerHTML = filtered.slice(0, 40).map(food => `
        <div class="glass-card p-4 rounded-xl border border-gray-800 hover:border-neongreen/40 transition flex flex-col justify-between">
            <div>
                <div class="flex items-start justify-between mb-1">
                    <span class="text-xs font-bold text-white leading-snug">${food.nome}</span>
                    <span class="text-[10px] uppercase font-bold text-neongreen px-2 py-0.5 rounded bg-neongreen/10 border border-neongreen/30 shrink-0 ml-2">
                        ${food.categoria || 'TACO'}
                    </span>
                </div>
                <div class="text-[11px] text-gray-400 mb-2">
                    Porção de referência: <strong class="text-gray-200">100g</strong>
                </div>

                <!-- Grid de Macros -->
                <div class="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-gray-950/70 border border-gray-800 text-center mb-2.5">
                    <div>
                        <span class="text-[9px] text-gray-500 block">KCAL</span>
                        <span class="font-bold text-xs text-neonpink">${food.calorias_kcal}</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-gray-500 block">PROT</span>
                        <span class="font-bold text-xs text-white">${food.proteinas_g}g</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-gray-500 block">CARB</span>
                        <span class="font-bold text-xs text-white">${food.carboidratos_g}g</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-gray-500 block">GORD</span>
                        <span class="font-bold text-xs text-white">${food.gorduras_g}g</span>
                    </div>
                </div>

                <!-- Micronutrientes & Fibras -->
                <div class="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-400 mb-2.5">
                    ${food.fibras_g ? `<span class="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800">Fibras: ${food.fibras_g}g</span>` : ''}
                    ${food.calcio_mg ? `<span class="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800">Cálcio: ${food.calcio_mg}mg</span>` : ''}
                    ${food.ferro_mg ? `<span class="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800">Ferro: ${food.ferro_mg}mg</span>` : ''}
                    ${food.vitamina_c_mg ? `<span class="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800">Vit C: ${food.vitamina_c_mg}mg</span>` : ''}
                </div>

                ${food.beneficios ? `
                    <div class="p-2 rounded-lg bg-neongreen/5 border border-neongreen/20 text-[11px] text-gray-300 mb-2">
                        <strong class="text-neongreen">Benefícios:</strong> ${food.beneficios}
                    </div>
                ` : ''}
                ${food.dica_consumo ? `
                    <div class="text-[10px] text-gray-400 italic mb-2">
                        💡 <strong>Dica de Consumo:</strong> ${food.dica_consumo}
                    </div>
                ` : ''}
            </div>

            <!-- Adicionar com porção personalizada -->
            <div class="flex items-center space-x-2 pt-2 border-t border-gray-800/80">
                <input 
                    type="number" 
                    id="taco-gramas-${food.id}" 
                    value="100" 
                    min="10" 
                    max="1000" 
                    step="10" 
                    class="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-center text-white focus:border-neongreen focus:outline-none"
                    title="Grama personalizada"
                />
                <span class="text-[10px] text-gray-400">g</span>
                <button 
                    onclick="addTacoFoodToDiary(${food.id})" 
                    class="flex-1 px-3 py-1.5 rounded-lg bg-neongreen/20 hover:bg-neongreen hover:text-black border border-neongreen/40 text-neongreen font-bold text-xs transition flex items-center justify-center space-x-1">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    <span>Adicionar</span>
                </button>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function addTacoFoodToDiary(foodId) {
    const food = tacoCatalog.find(f => f.id === foodId);
    if (!food) return;

    const gramsInput = document.getElementById(`taco-gramas-${foodId}`);
    const grams = parseFloat(gramsInput?.value) || 100;
    const factor = grams / 100;

    const calculatedKcal = Math.round(food.calorias_kcal * factor);
    const calculatedProt = Math.round((food.proteinas_g * factor) * 10) / 10;
    const calculatedCarb = Math.round((food.carboidratos_g * factor) * 10) / 10;
    const calculatedFat = Math.round((food.gorduras_g * factor) * 10) / 10;
    const calculatedFiber = Math.round((food.fibras_g * factor) * 10) / 10;

    let diary = [];
    try {
        const saved = localStorage.getItem('shape_food_diary');
        if (saved) diary = JSON.parse(saved);
    } catch (e) {
        diary = [];
    }

    const item = {
        id: Date.now(),
        date: new Date().toISOString(),
        mealType: 'Alimento TACO',
        title: `${food.nome} (${grams}g)`,
        kcal: calculatedKcal,
        protein: calculatedProt,
        carbs: calculatedCarb,
        fat: calculatedFat,
        fiber: calculatedFiber,
        alimentos: [
            {
                nome: food.nome,
                porcao_estimada_g: grams,
                medida_caseira: `${grams}g`,
                calorias_kcal: calculatedKcal,
                proteinas_g: calculatedProt,
                carboidratos_g: calculatedCarb,
                gorduras_g: calculatedFat,
                fibras_g: calculatedFiber,
                beneficios: food.beneficios
            }
        ],
        resumo: food.dica_consumo || food.beneficios || '',
        confianca: 'alta'
    };

    diary.unshift(item);
    localStorage.setItem('shape_food_diary', JSON.stringify(diary));

    if (typeof renderFoodDiary === 'function') {
        renderFoodDiary();
    }

    showToast(`"${food.nome} (${grams}g)" adicionado ao diário!`, 'success');
}

/**
 * 6. LANÇADOR RÁPIDO INTELIGENTE POR ALIMENTO + GRAMAS (TACO 597 ALIMENTOS)
 */
let selectedQuickFood = null;
let currentQuickMatches = [];
let quickDropdownHoverIdx = -1;

function parseFoodAndGrams(rawText) {
    let text = rawText || '';
    let grams = null;
    let hasExtractedGrams = false;

    // Detecta padrões como "150g arroz", "arroz 150g", "arroz---100 gramas", "200 g de frango", "100gr"
    const regexGrams = /(\d+)\s*(?:g|gr|gramas?)\b/i;
    const match = text.match(regexGrams);

    if (match) {
        const val = parseInt(match[1]);
        if (val > 0 && val <= 3000) {
            grams = val;
            hasExtractedGrams = true;
            text = text.replace(match[0], ' ');
        }
    } else {
        const dashMatch = text.match(/[-—–\s]+(\d{1,4})\s*$/);
        if (dashMatch) {
            const val = parseInt(dashMatch[1]);
            if (val >= 5 && val <= 3000) {
                grams = val;
                hasExtractedGrams = true;
                text = text.replace(dashMatch[0], ' ');
            }
        }
    }

    const cleanText = text.replace(/[-—–_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { cleanText, grams, hasExtractedGrams };
}

function normalizeSearchTerm(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function stemWord(w) {
    if (w.length > 4 && (w.endsWith('a') || w.endsWith('o') || w.endsWith('s'))) {
        return w.slice(0, -1);
    }
    return w;
}

async function handleQuickFoodSearch(rawVal) {
    const input = document.getElementById('quick-food-input');
    const dropdown = document.getElementById('quick-food-dropdown');
    const clearBtn = document.getElementById('quick-food-clear-btn');
    const gramsInput = document.getElementById('quick-food-grams');

    if (!input || !dropdown) return;

    if (!rawVal || !rawVal.trim()) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        selectedQuickFood = null;
        updateQuickFoodLivePreview();
        return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');

    const parsed = parseFoodAndGrams(rawVal);
    if (parsed.hasExtractedGrams && parsed.grams && gramsInput) {
        gramsInput.value = parsed.grams;
    }

    const query = parsed.cleanText;
    if (!query || query.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }

    if (!tacoCatalog || tacoCatalog.length === 0) {
        await loadTacoCatalog();
    }

    const normQuery = normalizeSearchTerm(query);
    const stopWords = ['de', 'da', 'do', 'dos', 'das', 'com', 'sem', 'e', 'em', 'para', 'tipo'];
    const queryWords = normQuery.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
    const queryStems = queryWords.map(stemWord);

    // Ranqueamento inteligente no catálogo TACO
    const scoredList = [];
    tacoCatalog.forEach(food => {
        const normName = normalizeSearchTerm(food.nome);
        const normCat = normalizeSearchTerm(food.categoria || '');
        let score = 0;

        // 1. Início exato do nome
        if (normName.startsWith(normQuery)) {
            score += 100;
        } else if (normName.includes(normQuery)) {
            score += 60;
        }

        // 2. Coincidência de radicais de palavras
        let matchedStems = 0;
        queryStems.forEach(stem => {
            if (normName.includes(stem)) {
                matchedStems++;
                score += 25;
            } else if (normCat.includes(stem)) {
                matchedStems += 0.5;
                score += 5;
            }
        });

        if (queryStems.length > 0 && matchedStems < Math.min(queryStems.length, 2) && score < 60) {
            return;
        }

        if (score > 0) {
            scoredList.push({ food, score });
        }
    });

    scoredList.sort((a, b) => b.score - a.score);
    currentQuickMatches = scoredList.slice(0, 8).map(item => item.food);
    quickDropdownHoverIdx = -1;

    if (currentQuickMatches.length === 0) {
        dropdown.innerHTML = `
            <div class="p-3 text-center text-gray-400 text-xs">
                <p>Nenhum alimento na TACO para "${escapeHtml(query)}".</p>
                <p class="text-[10px] text-gray-500 mt-1">Dica: digite "arroz", "frango", "ovo", "feijão" ou consulte a Tabela TACO.</p>
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = currentQuickMatches.map((food, idx) => `
        <div 
            onclick="selectQuickFoodItem(${food.id})"
            onmouseenter="setQuickDropdownHover(${idx})"
            id="quick-item-${idx}"
            class="p-2.5 px-3 hover:bg-gray-900 cursor-pointer transition flex items-center justify-between text-xs group"
        >
            <div class="min-w-0 pr-2">
                <div class="flex items-center space-x-1.5 mb-0.5">
                    <span class="font-bold text-white group-hover:text-neonpink transition truncate">${escapeHtml(food.nome)}</span>
                    <span class="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-900 border border-gray-800 text-gray-400 shrink-0">
                        ${escapeHtml(food.categoria || 'TACO')}
                    </span>
                </div>
                <div class="text-[11px] text-gray-400 flex items-center space-x-1">
                    <span>100g = <strong class="text-neonpink">${food.calorias_kcal} kcal</strong></span>
                    <span>•</span>
                    <span>P: <strong class="text-white">${food.proteinas_g}g</strong></span>
                    <span>•</span>
                    <span>C: <strong class="text-white">${food.carboidratos_g}g</strong></span>
                    <span>•</span>
                    <span>G: <strong class="text-white">${food.gorduras_g}g</strong></span>
                </div>
            </div>
            <button type="button" class="shrink-0 p-1 rounded-lg bg-neonpink/10 group-hover:bg-neonpink text-neonpink group-hover:text-black transition" title="Selecionar alimento">
                <i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `).join('');

    dropdown.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function setQuickDropdownHover(idx) {
    quickDropdownHoverIdx = idx;
}

function selectQuickFoodItem(foodId) {
    const food = (tacoCatalog || []).find(f => f.id === foodId);
    if (!food) return;

    selectedQuickFood = food;

    const input = document.getElementById('quick-food-input');
    const dropdown = document.getElementById('quick-food-dropdown');
    const clearBtn = document.getElementById('quick-food-clear-btn');

    if (input) input.value = food.nome;
    if (dropdown) dropdown.classList.add('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');

    updateQuickFoodLivePreview();
}

function updateQuickFoodLivePreview() {
    const previewEl = document.getElementById('quick-food-preview');
    const nameEl = document.getElementById('quick-food-preview-name');
    const badgeEl = document.getElementById('quick-food-preview-badge');
    const macrosEl = document.getElementById('quick-food-preview-macros');
    const gramsInput = document.getElementById('quick-food-grams');

    if (!previewEl) return;

    if (!selectedQuickFood) {
        previewEl.classList.add('hidden');
        return;
    }

    const grams = Math.max(1, Math.min(3000, parseFloat(gramsInput?.value) || 100));
    const factor = grams / 100;

    const kcal = Math.round(selectedQuickFood.calorias_kcal * factor);
    const p = Math.round((selectedQuickFood.proteinas_g * factor) * 10) / 10;
    const c = Math.round((selectedQuickFood.carboidratos_g * factor) * 10) / 10;
    const g = Math.round((selectedQuickFood.gorduras_g * factor) * 10) / 10;
    const fib = Math.round((selectedQuickFood.fibras_g * factor) * 10) / 10;

    if (nameEl) nameEl.textContent = selectedQuickFood.nome;
    if (badgeEl) badgeEl.textContent = `${grams}g`;
    if (macrosEl) {
        macrosEl.innerHTML = `<span class="text-neonpink font-bold">${kcal} kcal</span> • P: <strong class="text-white">${p}g</strong> • C: <strong class="text-white">${c}g</strong> • G: <strong class="text-white">${g}g</strong> ${fib ? `• Fib: <strong class="text-neongreen">${fib}g</strong>` : ''}`;
    }

    previewEl.classList.remove('hidden');
}

function clearQuickFoodInput() {
    const input = document.getElementById('quick-food-input');
    const dropdown = document.getElementById('quick-food-dropdown');
    const clearBtn = document.getElementById('quick-food-clear-btn');
    const gramsInput = document.getElementById('quick-food-grams');

    if (input) input.value = '';
    if (gramsInput) gramsInput.value = '100';
    if (dropdown) dropdown.classList.add('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
    selectedQuickFood = null;
    updateQuickFoodLivePreview();
    if (input) input.focus();
}

function handleQuickFoodKeydown(event) {
    const dropdown = document.getElementById('quick-food-dropdown');
    const isOpen = dropdown && !dropdown.classList.contains('hidden');

    if (event.key === 'Escape') {
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }

    if (event.key === 'ArrowDown' && isOpen && currentQuickMatches.length > 0) {
        event.preventDefault();
        quickDropdownHoverIdx = (quickDropdownHoverIdx + 1) % currentQuickMatches.length;
        highlightQuickDropdownItem(quickDropdownHoverIdx);
        return;
    }

    if (event.key === 'ArrowUp' && isOpen && currentQuickMatches.length > 0) {
        event.preventDefault();
        quickDropdownHoverIdx = (quickDropdownHoverIdx - 1 + currentQuickMatches.length) % currentQuickMatches.length;
        highlightQuickDropdownItem(quickDropdownHoverIdx);
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        if (isOpen && quickDropdownHoverIdx >= 0 && currentQuickMatches[quickDropdownHoverIdx]) {
            selectQuickFoodItem(currentQuickMatches[quickDropdownHoverIdx].id);
        } else {
            addQuickFoodToDiary();
        }
    }
}

function highlightQuickDropdownItem(idx) {
    currentQuickMatches.forEach((_, i) => {
        const el = document.getElementById(`quick-item-${i}`);
        if (el) {
            if (i === idx) {
                el.classList.add('bg-gray-900', 'border-l-2', 'border-neonpink');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('bg-gray-900', 'border-l-2', 'border-neonpink');
            }
        }
    });
}

function addQuickFoodToDiary() {
    const input = document.getElementById('quick-food-input');
    const gramsInput = document.getElementById('quick-food-grams');

    const rawText = input?.value || '';
    const parsed = parseFoodAndGrams(rawText);
    const grams = parsed.grams || Math.max(1, Math.min(3000, parseFloat(gramsInput?.value) || 100));

    let food = selectedQuickFood;

    // Se nenhum alimento foi selecionado no dropdown, tenta o melhor resultado da busca
    if (!food) {
        const query = parsed.cleanText;
        if (!query) {
            showToast('Digite o alimento (ex: Arroz, Frango, Ovo...) para lançar.', 'error');
            if (input) input.focus();
            return;
        }

        if (currentQuickMatches && currentQuickMatches.length > 0) {
            food = currentQuickMatches[0];
        } else if (tacoCatalog && tacoCatalog.length > 0) {
            const normQ = normalizeSearchTerm(query);
            food = tacoCatalog.find(f => normalizeSearchTerm(f.nome).includes(normQ));
        }
    }

    if (!food) {
        showToast(`Alimento não localizado na TACO. Experimente "arroz", "frango", "ovo"...`, 'error');
        return;
    }

    const factor = grams / 100;
    const calculatedKcal = Math.round(food.calorias_kcal * factor);
    const calculatedProt = Math.round((food.proteinas_g * factor) * 10) / 10;
    const calculatedCarb = Math.round((food.carboidratos_g * factor) * 10) / 10;
    const calculatedFat = Math.round((food.gorduras_g * factor) * 10) / 10;
    const calculatedFiber = Math.round((food.fibras_g * factor) * 10) / 10;

    let diary = [];
    try {
        const saved = localStorage.getItem('shape_food_diary');
        if (saved) diary = JSON.parse(saved);
    } catch (e) {
        diary = [];
    }

    const item = {
        id: Date.now(),
        date: new Date().toISOString(),
        mealType: 'Lançamento Rápido',
        title: `${food.nome} (${grams}g)`,
        name: `${food.nome} (${grams}g)`,
        kcal: calculatedKcal,
        protein: calculatedProt,
        carbs: calculatedCarb,
        fat: calculatedFat,
        fiber: calculatedFiber,
        alimentos: [
            {
                nome: food.nome,
                porcao_estimada_g: grams,
                medida_caseira: `${grams}g`,
                calorias_kcal: calculatedKcal,
                proteinas_g: calculatedProt,
                carboidratos_g: calculatedCarb,
                gorduras_g: calculatedFat,
                fibras_g: calculatedFiber,
                beneficios: food.beneficios || ''
            }
        ],
        resumo: food.dica_consumo || food.beneficios || '',
        confianca: 'alta'
    };

    diary.unshift(item);
    localStorage.setItem('shape_food_diary', JSON.stringify(diary));

    // Sincroniza variável global em memória se estiver no perfil
    if (typeof foodDiary !== 'undefined' && Array.isArray(foodDiary)) {
        foodDiary.unshift(item);
    }

    if (typeof renderFoodDiary === 'function') {
        renderFoodDiary();
    }

    // Limpa campos para novo lançamento
    clearQuickFoodInput();

    showToast(`✓ ${food.nome} (${grams}g) lançado! (${calculatedKcal} kcal)`, 'success');
}

// Fechar dropdown de busca ao clicar fora
document.addEventListener('click', (e) => {
    const input = document.getElementById('quick-food-input');
    const dropdown = document.getElementById('quick-food-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.classList.add('hidden');
        }
    }
});

// Inicializar ouvintes ao carregar
document.addEventListener('DOMContentLoaded', () => {
    loadTacoCatalog();
});
