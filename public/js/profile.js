/**
 * Profile.js - Calculadora de IMC, Metas de Macros & Diário Alimentar do Shape Mestre
 */

let foodDiary = [];

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Perfis nutricionais padrão-ouro (Proteína entre 1.5 e 2.2 g/kg conforme solicitação)
const MACRO_PROFILES = {
    fitness: {
        id: 'fitness',
        name: 'Quem treina (Fitness)',
        pMin: 1.5, pMax: 1.8,
        cMin: 3.0, cMax: 5.0,
        gMin: 0.8, gMax: 1.2,
        waterMin: 35, waterMax: 40,
        desc: 'Para manutenção, queima moderada de gordura e condicionamento físico geral.'
    },
    hipertrofia: {
        id: 'hipertrofia',
        name: 'Hipertrofia / Força',
        pMin: 1.8, pMax: 2.2,
        cMin: 4.0, cMax: 6.0,
        gMin: 0.8, gMax: 1.2,
        waterMin: 35, waterMax: 45,
        desc: 'Foco total em ganho de massa muscular, síntese proteica e progressão de força.'
    },
    endurance: {
        id: 'endurance',
        name: 'Atleta Endurance',
        pMin: 1.5, pMax: 1.8,
        cMin: 6.0, cMax: 8.0,
        gMin: 0.8, gMax: 1.2,
        waterMin: 40, waterMax: 50,
        desc: 'Para esportes de longa duração (corrida, ciclismo, triatlo) com alta recarga de glicogênio.'
    },
    atleta: {
        id: 'atleta',
        name: 'Atleta Alto Volume',
        pMin: 1.8, pMax: 2.2,
        cMin: 8.0, cMax: 12.0,
        gMin: 1.0, gMax: 1.5,
        waterMin: 45, waterMax: 55,
        desc: 'Demanda energética elevada para treinos bi-diários ou competições de alto desgaste.'
    }
};

let currentMacroProfile = 'hipertrofia';
let currentMacroWeight = 70;

function loadProfileData() {
    // Carregar dados de IMC salvos
    const savedWeight = localStorage.getItem('shape_user_weight');
    const savedHeight = localStorage.getItem('shape_user_height');

    if (savedWeight) {
        const w = parseFloat(savedWeight);
        const wInput = document.getElementById('imc-weight');
        if (wInput) wInput.value = w;
        if (!isNaN(w) && w > 0) currentMacroWeight = Math.round(w);
    }
    if (savedHeight) {
        const hInput = document.getElementById('imc-height');
        if (hInput) hInput.value = savedHeight;
    }
    if (savedWeight && savedHeight) calculateIMC(false);

    // Carregar Diário Alimentar do LocalStorage
    try {
        const savedDiary = localStorage.getItem('shape_food_diary');
        if (savedDiary) {
            foodDiary = JSON.parse(savedDiary);
        }
    } catch(e) {
        foodDiary = [];
    }

    // Inicializar Planejador de Macros
    initMacroPlanner();

    renderFoodDiary();
}

/**
 * Inicializador e Controladores do Planejador de Macros
 */
function initMacroPlanner() {
    // Tenta carregar meta diária ativa salva
    try {
        const savedGoal = localStorage.getItem('shape_user_daily_goal');
        if (savedGoal) {
            const goal = JSON.parse(savedGoal);
            if (goal.profileKey && MACRO_PROFILES[goal.profileKey]) {
                currentMacroProfile = goal.profileKey;
            }
            if (goal.weight) {
                currentMacroWeight = goal.weight;
            }
        }
    } catch (e) {}

    updateMacroDisplay();
}

function setMacroProfile(profileKey) {
    if (!MACRO_PROFILES[profileKey]) return;
    currentMacroProfile = profileKey;
    updateMacroDisplay();
}

function setMacroWeight(val) {
    const w = Math.max(40, Math.min(160, parseInt(val) || 70));
    currentMacroWeight = w;
    updateMacroDisplay();
}

function updateMacroDisplay() {
    const prof = MACRO_PROFILES[currentMacroProfile] || MACRO_PROFILES.hipertrofia;
    const w = currentMacroWeight;

    // Gramas calculadas
    const pLow = Math.round(w * prof.pMin);
    const pHigh = Math.round(w * prof.pMax);
    const pMid = Math.round((pLow + pHigh) / 2);

    const cLow = Math.round(w * prof.cMin);
    const cHigh = Math.round(w * prof.cMax);
    const cMid = Math.round((cLow + cHigh) / 2);

    const gLow = Math.round(w * prof.gMin);
    const gHigh = Math.round(w * prof.gMax);
    const gMid = Math.round((gLow + gHigh) / 2);

    const waterLow = ((w * prof.waterMin) / 1000).toFixed(2).replace('.', ',');
    const waterHigh = ((w * prof.waterMax) / 1000).toFixed(2).replace('.', ',');

    // Calorias médias
    const pKcal = pMid * 4;
    const cKcal = cMid * 4;
    const gKcal = gMid * 9;
    const kcalTotal = pKcal + cKcal + gKcal;

    const pPct = Math.round((pKcal / kcalTotal) * 100);
    const cPct = Math.round((cKcal / kcalTotal) * 100);
    const gPct = Math.max(0, 100 - pPct - cPct);

    // Atualiza cards de métricas
    const pVal = document.getElementById('macro-prot-val');
    const pSub = document.getElementById('macro-prot-sub');
    if (pVal) pVal.textContent = `${pLow} - ${pHigh} g`;
    if (pSub) pSub.textContent = `${prof.pMin.toFixed(1)} - ${prof.pMax.toFixed(1)} g/kg`;

    const cVal = document.getElementById('macro-carb-val');
    const cSub = document.getElementById('macro-carb-sub');
    if (cVal) cVal.textContent = `${cLow} - ${cHigh} g`;
    if (cSub) cSub.textContent = `${prof.cMin.toFixed(1)} - ${prof.cMax.toFixed(1)} g/kg`;

    const gVal = document.getElementById('macro-fat-val');
    const gSub = document.getElementById('macro-fat-sub');
    if (gVal) gVal.textContent = `${gLow} - ${gHigh} g`;
    if (gSub) gSub.textContent = `${prof.gMin.toFixed(1)} - ${prof.gMax.toFixed(1)} g/kg`;

    const wVal = document.getElementById('macro-water-val');
    const wSub = document.getElementById('macro-water-sub');
    if (wVal) wVal.textContent = `${waterLow} - ${waterHigh} L`;
    if (wSub) wSub.textContent = `${prof.waterMin} - ${prof.waterMax} mL/kg`;

    // Atualiza barra de distribuição calórica
    const kcalEl = document.getElementById('macro-kcal-total');
    if (kcalEl) kcalEl.textContent = `~${kcalTotal.toLocaleString('pt-BR')} kcal / dia`;

    const barCarb = document.getElementById('macro-bar-carb');
    const barProt = document.getElementById('macro-bar-prot');
    const barFat = document.getElementById('macro-bar-fat');
    if (barCarb) {
        barCarb.style.width = `${cPct}%`;
        barCarb.textContent = `${cPct}%`;
    }
    if (barProt) {
        barProt.style.width = `${pPct}%`;
        barProt.textContent = `${pPct}%`;
    }
    if (barFat) {
        barFat.style.width = `${gPct}%`;
        barFat.textContent = `${gPct}%`;
    }

    // Atualiza slider e badge numérico
    const slider = document.getElementById('macro-weight-slider');
    const badge = document.getElementById('macro-weight-badge');
    if (slider) slider.value = w;
    if (badge) badge.textContent = `${w} kg`;

    // Atualiza estilos das abas (destaca a aba ativa exatamente como no print de referência)
    ['fitness', 'hipertrofia', 'endurance', 'atleta'].forEach(key => {
        const tabBtn = document.getElementById(`macro-tab-${key}`);
        if (tabBtn) {
            if (key === currentMacroProfile) {
                tabBtn.className = "flex-1 py-2 px-3 rounded-full text-[11px] sm:text-xs font-bold transition text-center whitespace-nowrap bg-white text-gray-950 border border-white shadow";
            } else {
                tabBtn.className = "flex-1 py-2 px-3 rounded-full text-[11px] sm:text-xs font-bold transition text-center whitespace-nowrap text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent";
            }
        }
    });
}

function applyMacroPlanAsDailyGoal() {
    const prof = MACRO_PROFILES[currentMacroProfile] || MACRO_PROFILES.hipertrofia;
    const w = currentMacroWeight;

    const pMid = Math.round((Math.round(w * prof.pMin) + Math.round(w * prof.pMax)) / 2);
    const cMid = Math.round((Math.round(w * prof.cMin) + Math.round(w * prof.cMax)) / 2);
    const gMid = Math.round((Math.round(w * prof.gMin) + Math.round(w * prof.gMax)) / 2);
    const kcalTotal = Math.round((pMid * 4) + (cMid * 4) + (gMid * 9));
    const waterMid = (((w * prof.waterMin) + (w * prof.waterMax)) / 2000).toFixed(1);

    const goal = {
        profileKey: currentMacroProfile,
        profileName: prof.name,
        weight: w,
        kcal: kcalTotal,
        protein: pMid,
        carbs: cMid,
        fat: gMid,
        water: waterMid,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem('shape_user_daily_goal', JSON.stringify(goal));
    showToast(`🎯 Meta "${prof.name}" ativada! (${kcalTotal} kcal • ${pMid}g Proteína)`, 'success');

    renderFoodDiary();
}

/**
 * Cálculo de Índice de Massa Corporal (IMC)
 */
function calculateIMC(save = true) {
    const weightInput = document.getElementById('imc-weight');
    const heightInput = document.getElementById('imc-height');

    const weight = parseFloat(weightInput.value);
    const heightCm = parseFloat(heightInput.value);

    if (!weight || !heightCm || heightCm <= 0) {
        if (save) alert('Por favor, informe peso e altura válidos.');
        return;
    }

    const heightM = heightCm / 100;
    const imc = (weight / (heightM * heightM)).toFixed(1);

    if (weight > 0) {
        currentMacroWeight = Math.round(weight);
        updateMacroDisplay();
    }

    if (save) {
        localStorage.setItem('shape_user_weight', weight);
        localStorage.setItem('shape_user_height', heightCm);
        showToast('Dados corporais salvos!', 'success');
    }

    let classification = '';
    let colorClass = 'text-neongreen';

    if (imc < 18.5) {
        classification = 'Abaixo do Peso (Foco em Superávit Calórico e Hipertrofia)';
        colorClass = 'text-yellow-400';
    } else if (imc < 24.9) {
        classification = 'Peso Saudável (Eutrofia)';
        colorClass = 'text-neongreen';
    } else if (imc < 29.9) {
        classification = 'Sobrepeso (Foco em Recomposição Corporal / Déficit Leve)';
        colorClass = 'text-yellow-400';
    } else if (imc < 34.9) {
        classification = 'Obesidade Grau I (Foco em Déficit Calórico e Treino Resistido)';
        colorClass = 'text-neonpink';
    } else {
        classification = 'Obesidade Grau II / III (Acompanhamento Médico & Nutricional)';
        colorClass = 'text-red-500';
    }

    const resultBox = document.getElementById('imc-result');
    const valEl = document.getElementById('imc-value');
    const classEl = document.getElementById('imc-classification');

    valEl.textContent = imc;
    valEl.className = `text-4xl font-extrabold my-1 ${colorClass}`;
    classEl.textContent = classification;
    resultBox.classList.remove('hidden');
}

/**
 * Adicionar alimento manualmente ao diário (compatibilidade e redirecionamento inteligente)
 */
function addManualFood() {
    if (typeof addQuickFoodToDiary === 'function') {
        return addQuickFoodToDiary();
    }

    const nameInput = document.getElementById('food-name');
    const kcalInput = document.getElementById('food-kcal');

    const name = nameInput ? nameInput.value.trim() : '';
    const kcal = kcalInput ? parseInt(kcalInput.value) : NaN;

    if (!name || isNaN(kcal)) {
        alert('Informe o nome do alimento e as calorias aproximadas.');
        return;
    }

    // Estimativa padrão de macros se o usuário não preencher
    const item = {
        id: Date.now(),
        name,
        title: name,
        kcal,
        protein: Math.round(kcal * 0.25 / 4), // 25% proteína
        carbs: Math.round(kcal * 0.50 / 4),   // 50% carbo
        fat: Math.round(kcal * 0.25 / 9)      // 25% gordura
    };

    foodDiary.unshift(item);
    saveFoodDiary();
    renderFoodDiary();

    if (nameInput) nameInput.value = '';
    if (kcalInput) kcalInput.value = '';
    showToast(`"${name}" adicionado ao seu diário!`, 'success');
}

function removeFoodItem(id) {
    foodDiary = foodDiary.filter(it => it.id !== id);
    saveFoodDiary();
    renderFoodDiary();
}

function saveFoodDiary() {
    localStorage.setItem('shape_food_diary', JSON.stringify(foodDiary));
}

function renderFoodDiary() {
    const list = document.getElementById('food-diary-list');
    const totalKcalEl = document.getElementById('total-kcal');
    const totalProtEl = document.getElementById('total-prot');
    const totalCarbEl = document.getElementById('total-carb');
    const totalFatEl = document.getElementById('total-fat');
    const totalFiberEl = document.getElementById('total-fiber');

    if (!list) return;

    // Carrega meta diária ativa salva
    let userGoal = null;
    try {
        const savedGoal = localStorage.getItem('shape_user_daily_goal');
        if (savedGoal) userGoal = JSON.parse(savedGoal);
    } catch(e) {}

    let totKcal = 0, totProt = 0, totCarb = 0, totFat = 0, totFiber = 0;

    if (foodDiary.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-500 text-center py-6">Nenhuma refeição registrada hoje. Use os botões acima para registrar por foto ou consultar a Tabela TACO.</p>';
    } else {
        list.innerHTML = foodDiary.map(item => {
            totKcal += Number(item.kcal) || 0;
            totProt += Number(item.protein) || 0;
            totCarb += Number(item.carbs) || 0;
            totFat += Number(item.fat) || 0;
            totFiber += Number(item.fiber) || 0;

            const hasDetails = (item.alimentos && item.alimentos.length > 0) || item.resumo;
            const mealTypeBadge = item.mealType ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.mealType === 'TACO' ? 'bg-neongreen/15 text-neongreen border border-neongreen/30' :
                    item.mealType.toLowerCase().includes('café') ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                    item.mealType.toLowerCase().includes('almoço') ? 'bg-neoncyan/15 text-neoncyan border border-neoncyan/30' :
                    item.mealType.toLowerCase().includes('jantar') ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                    'bg-neonpink/15 text-neonpink border border-neonpink/30'
                }">${item.mealType}</span>
            ` : '';

            // Usa title, name ou fallback elegante para nunca exibir undefined
            const displayName = item.title || item.name || 'Refeição Registrada';

            return `
                <div class="p-3 rounded-xl bg-gray-950 border border-gray-800 hover:border-gray-700 transition flex items-center justify-between text-xs group">
                    <div class="flex items-center space-x-3 min-w-0">
                        ${item.thumbnail ? `
                            <img src="${item.thumbnail}" alt="Refeição" class="w-12 h-12 rounded-lg object-cover border border-gray-800 shrink-0">
                        ` : `
                            <div class="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 shrink-0">
                                <i data-lucide="utensils" class="w-5 h-5 text-gray-400"></i>
                            </div>
                        `}
                        <div class="truncate">
                            <div class="flex items-center space-x-2 mb-0.5">
                                <span class="font-bold text-white truncate">${escapeHtml(displayName)}</span>
                                ${mealTypeBadge}
                            </div>
                            <div class="text-[11px] text-gray-400 flex items-center space-x-1.5 flex-wrap">
                                <span>P: <strong class="text-white">${Math.round(item.protein || 0)}g</strong></span>
                                <span>•</span>
                                <span>C: <strong class="text-white">${Math.round(item.carbs || 0)}g</strong></span>
                                <span>•</span>
                                <span>G: <strong class="text-white">${Math.round(item.fat || 0)}g</strong></span>
                                ${item.fiber ? `<span>• Fib: <strong class="text-neongreen">${Math.round(item.fiber)}g</strong></span>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2 shrink-0 ml-3">
                        <span class="font-extrabold text-neonpink text-xs sm:text-sm mr-1">${Math.round(item.kcal)} kcal</span>
                        ${hasDetails ? `
                            <button onclick="openMealDetailsById(${item.id})" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-neoncyan/15 text-neoncyan border border-neoncyan/30 hover:bg-neoncyan hover:text-black transition flex items-center space-x-1 shadow-sm" title="Ver Alimentos & Benefícios">
                                <i data-lucide="sparkles" class="w-3 h-3"></i>
                                <span class="hidden sm:inline">Detalhes</span>
                            </button>
                        ` : ''}
                        <button onclick="removeFoodItem(${item.id})" class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Excluir refeição">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (totalKcalEl) totalKcalEl.textContent = `${Math.round(totKcal)} kcal`;
    if (totalProtEl) totalProtEl.textContent = `${Math.round(totProt)}g`;
    if (totalCarbEl) totalCarbEl.textContent = `${Math.round(totCarb)}g`;
    if (totalFatEl) totalFatEl.textContent = `${Math.round(totFat)}g`;
    if (totalFiberEl) totalFiberEl.textContent = `${Math.round(totFiber)}g`;

    // Atualiza Card de Progresso da Meta Diária (se houver meta ativa)
    const goalBanner = document.getElementById('diary-goal-banner');
    if (goalBanner && userGoal) {
        goalBanner.classList.remove('hidden');
        const targetKcal = userGoal.kcal || 2500;
        const targetProt = userGoal.protein || 140;
        const targetCarb = userGoal.carbs || 350;
        const targetFat = userGoal.fat || 70;

        const remainKcal = Math.max(0, targetKcal - Math.round(totKcal));
        const kcalPct = Math.min(100, Math.round((totKcal / targetKcal) * 100));

        const protPct = Math.min(100, Math.round((totProt / targetProt) * 100));
        const carbPct = Math.min(100, Math.round((totCarb / targetCarb) * 100));
        const fatPct = Math.min(100, Math.round((totFat / targetFat) * 100));

        const profNameEl = document.getElementById('goal-profile-name');
        const remKcalEl = document.getElementById('goal-remaining-kcal');
        const progBar = document.getElementById('goal-progress-bar');

        if (profNameEl) profNameEl.textContent = `Meta: ${userGoal.profileName || 'Personalizada'} (${targetKcal.toLocaleString('pt-BR')} kcal)`;
        if (remKcalEl) {
            if (totKcal > targetKcal) {
                remKcalEl.textContent = `+${Math.round(totKcal - targetKcal)} kcal acima`;
                remKcalEl.className = 'text-xs font-extrabold text-amber-400';
            } else {
                remKcalEl.textContent = `Restam ${remainKcal.toLocaleString('pt-BR')} kcal`;
                remKcalEl.className = 'text-xs font-extrabold text-neongreen';
            }
        }
        if (progBar) {
            progBar.style.width = `${kcalPct}%`;
        }

        const protTxt = document.getElementById('goal-prog-prot-txt');
        const protBar = document.getElementById('goal-prog-prot-bar');
        if (protTxt) protTxt.textContent = `${Math.round(totProt)} / ${targetProt}g`;
        if (protBar) protBar.style.width = `${protPct}%`;

        const carbTxt = document.getElementById('goal-prog-carb-txt');
        const carbBar = document.getElementById('goal-prog-carb-bar');
        if (carbTxt) carbTxt.textContent = `${Math.round(totCarb)} / ${targetCarb}g`;
        if (carbBar) carbBar.style.width = `${carbPct}%`;

        const fatTxt = document.getElementById('goal-prog-fat-txt');
        const fatBar = document.getElementById('goal-prog-fat-bar');
        if (fatTxt) fatTxt.textContent = `${Math.round(totFat)} / ${targetFat}g`;
        if (fatBar) fatBar.style.width = `${fatPct}%`;
    }

    // Atualizar no card da home
    const homeMeta = document.getElementById('home-meta-calorias');
    if (homeMeta) {
        const metaVal = userGoal ? userGoal.kcal : 2000;
        homeMeta.textContent = `${Math.round(totKcal)} / ${metaVal.toLocaleString('pt-BR')} kcal`;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}
