/**
 * Profile.js - Calculadora de IMC & Diário Alimentar do Shape Mestre
 */

let foodDiary = [];

function loadProfileData() {
    // Carregar dados de IMC salvos
    const savedWeight = localStorage.getItem('shape_user_weight');
    const savedHeight = localStorage.getItem('shape_user_height');

    if (savedWeight) document.getElementById('imc-weight').value = savedWeight;
    if (savedHeight) document.getElementById('imc-height').value = savedHeight;
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
 * Adicionar alimento manualmente ao diário
 */
function addManualFood() {
    const nameInput = document.getElementById('food-name');
    const kcalInput = document.getElementById('food-kcal');

    const name = nameInput.value.trim();
    const kcal = parseInt(kcalInput.value);

    if (!name || isNaN(kcal)) {
        alert('Informe o nome do alimento e as calorias aproximadas.');
        return;
    }

    // Estimativa padrão de macros se o usuário não preencher
    const item = {
        id: Date.now(),
        name,
        kcal,
        protein: Math.round(kcal * 0.25 / 4), // 25% proteína
        carbs: Math.round(kcal * 0.50 / 4),   // 50% carbo
        fat: Math.round(kcal * 0.25 / 9)      // 25% gordura
    };

    foodDiary.push(item);
    saveFoodDiary();
    renderFoodDiary();

    nameInput.value = '';
    kcalInput.value = '';
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

    if (!list) return;

    if (foodDiary.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Nenhuma refeição registrada hoje.</p>';
        totalKcalEl.textContent = '0 kcal';
        totalProtEl.textContent = '0g';
        totalCarbEl.textContent = '0g';
        totalFatEl.textContent = '0g';
        return;
    }

    let totKcal = 0, totProt = 0, totCarb = 0, totFat = 0;

    list.innerHTML = foodDiary.map(item => {
        totKcal += item.kcal || 0;
        totProt += item.protein || 0;
        totCarb += item.carbs || 0;
        totFat += item.fat || 0;

        return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs">
                <div>
                    <span class="font-bold text-white block">${item.name}</span>
                    <span class="text-[10px] text-gray-400">P: ${item.protein}g | C: ${item.carbs}g | G: ${item.fat}g</span>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="font-bold text-neonpink">${item.kcal} kcal</span>
                    <button onclick="removeFoodItem(${item.id})" class="text-gray-500 hover:text-red-400">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    totalKcalEl.textContent = `${totKcal} kcal`;
    totalProtEl.textContent = `${totProt}g`;
    totalCarbEl.textContent = `${totCarb}g`;
    totalFatEl.textContent = `${totFat}g`;

    // Atualizar no card da home
    const homeMeta = document.getElementById('home-meta-calorias');
    if (homeMeta) {
        homeMeta.textContent = `${totKcal} / 2.000 kcal`;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}
