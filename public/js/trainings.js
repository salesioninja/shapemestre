/**
 * Trainings.js - Módulo de Fichas de Treino Oficiais (Shape Mestre)
 */

let allTrainings = [];
let currentGenderFilter = 'Todos';
let selectedTrainingForModal = null;

async function loadTrainings() {
    const grid = document.getElementById('trainings-grid');
    try {
        const response = await fetch('/api/trainings');
        allTrainings = await response.json();
        renderTrainingsList();
    } catch (error) {
        console.error('Erro ao carregar treinos:', error);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-red-400">Erro ao carregar fichas de treino.</div>';
    }
}

function setTrainingGender(gender) {
    currentGenderFilter = gender;

    // Atualizar botões
    const btnAll = document.getElementById('filter-gender-all');
    const btnFem = document.getElementById('filter-gender-fem');
    const btnMasc = document.getElementById('filter-gender-masc');

    [btnAll, btnFem, btnMasc].forEach(b => {
        b.className = 'px-4 py-2 rounded-lg text-xs font-bold transition text-gray-400 hover:text-white';
    });

    if (gender === 'Todos') {
        btnAll.className = 'px-4 py-2 rounded-lg text-xs font-bold transition bg-neonpink text-black';
    } else if (gender === 'Feminino') {
        btnFem.className = 'px-4 py-2 rounded-lg text-xs font-bold transition bg-neonpink text-black';
    } else if (gender === 'Masculino') {
        btnMasc.className = 'px-4 py-2 rounded-lg text-xs font-bold transition bg-neoncyan text-black';
    }

    renderTrainingsList();
}

function filterTrainings() {
    renderTrainingsList();
}

function renderTrainingsList() {
    const grid = document.getElementById('trainings-grid');
    const rawSearch = (document.getElementById('search-trainings')?.value || '').toLowerCase();
    const searchVal = rawSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const filtered = allTrainings.filter(t => {
        const matchGender = currentGenderFilter === 'Todos' || t.gender === currentGenderFilter;
        if (!searchVal) return matchGender;

        const tName = (t.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tDesc = (t.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tCat = (t.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const matchSearch = tName.includes(searchVal) || 
                            tDesc.includes(searchVal) ||
                            tCat.includes(searchVal);
        return matchGender && matchSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-500">Nenhuma ficha encontrada com esses filtros.</div>';
        return;
    }

    grid.innerHTML = filtered.map(t => {
        const isFem = t.gender === 'Feminino';
        const badgeColor = isFem ? 'text-neonpink border-neonpink/40 bg-pink-950/30' : 'text-neoncyan border-neoncyan/40 bg-cyan-950/30';
        const buttonClass = isFem ? 'btn-neon-pink' : 'btn-neon-cyan';

        return `
            <div class="glass-card p-5 flex flex-col justify-between hover:scale-[1.01] transition">
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${badgeColor}">
                            ${t.gender || 'Geral'} • ${t.category || 'Hipertrofia'}
                        </span>
                        <i data-lucide="dumbbell" class="w-5 h-5 ${isFem ? 'text-neonpink' : 'text-neoncyan'}"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">${t.name}</h3>
                    <p class="text-xs text-gray-400 mb-4 line-clamp-3 leading-relaxed">${t.description}</p>
                </div>
                <div>
                    <button onclick="openTrainingModal(${t.id})" class="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider ${buttonClass}">
                        Ver Ficha Completa
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) {
        lucide.createIcons();
    }
}

function openTrainingModal(id) {
    const training = allTrainings.find(t => t.id === id);
    if (!training) return;
    selectedTrainingForModal = training;

    document.getElementById('modal-training-title').textContent = training.name;
    document.getElementById('modal-training-category').textContent = `${training.gender} • ${training.category} • Duração: ${training.details?.duration || '6 semanas'}`;

    const body = document.getElementById('modal-training-body');
    let routineHtml = '';

    if (training.details?.routine) {
        Object.entries(training.details.routine).forEach(([sectionName, exercises]) => {
            routineHtml += `
                <div class="border border-gray-800 rounded-xl p-4 bg-gray-950/60">
                    <h4 class="text-sm font-extrabold text-neoncyan uppercase tracking-wider mb-3 flex items-center space-x-2">
                        <i data-lucide="chevron-right" class="w-4 h-4 text-neonpink"></i>
                        <span>${sectionName}</span>
                    </h4>
                    <div class="space-y-2">
            `;

            exercises.forEach(ex => {
                routineHtml += `
                    <div class="flex items-center justify-between py-2 border-b border-gray-800/60 text-xs hover:bg-gray-900/40 px-2 rounded-lg transition group">
                        <div class="flex items-center space-x-2 flex-1 min-w-0 mr-2">
                            <button onclick="viewExerciseDetails('${encodeURIComponent(ex.exercise)}', '${ex.sets}', '${ex.reps}')" class="p-1 rounded-md bg-gray-800/80 group-hover:bg-neoncyan group-hover:text-black text-neoncyan transition shrink-0" title="Ver execução e GIF">
                                <i data-lucide="play-circle" class="w-4 h-4"></i>
                            </button>
                            <span onclick="viewExerciseDetails('${encodeURIComponent(ex.exercise)}', '${ex.sets}', '${ex.reps}')" class="font-medium text-gray-200 truncate cursor-pointer hover:text-neoncyan transition" title="Clique para ver o GIF">${ex.exercise}</span>
                        </div>
                        <span class="font-bold text-neonpink shrink-0">${ex.sets} séries x ${ex.reps} reps</span>
                    </div>
                `;
            });

            routineHtml += `
                    </div>
                </div>
            `;
        });
    } else {
        routineHtml = '<p class="text-gray-400 text-xs">Detalhes da rotina não encontrados.</p>';
    }

    body.innerHTML = routineHtml;
    document.getElementById('training-modal').classList.remove('hidden');

    if (window.lucide) {
        lucide.createIcons();
    }
}

function closeTrainingModal() {
    document.getElementById('training-modal').classList.add('hidden');
}

let catalogExercisesCache = null;

async function getExerciseCatalog() {
    if (window.allExercises && window.allExercises.length > 0) {
        return window.allExercises;
    }
    if (catalogExercisesCache) return catalogExercisesCache;
    try {
        const res = await fetch('/api/exercises');
        catalogExercisesCache = await res.json();
        return catalogExercisesCache;
    } catch (e) {
        console.warn('Erro ao carregar catálogo para busca de GIF:', e);
        return [];
    }
}

function normalizeForSearch(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

async function viewExerciseDetails(encodedName, sets, reps) {
    const rawName = decodeURIComponent(encodedName);
    const catalog = await getExerciseCatalog();
    const query = normalizeForSearch(rawName);

    // Tentar match exato ou aproximado
    let found = catalog.find(e => normalizeForSearch(e.name) === query);
    if (!found) {
        // Tentar substring bidirecional
        found = catalog.find(e => {
            const eNorm = normalizeForSearch(e.name);
            return eNorm.includes(query) || query.includes(eNorm);
        });
    }

    // Se ainda não encontrou, testar por partes (palavras-chave como extensora, flexora, supino, etc.)
    if (!found) {
        const words = rawName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 4);
        for (const w of words) {
            const wNorm = normalizeForSearch(w);
            found = catalog.find(e => normalizeForSearch(e.name).includes(wNorm));
            if (found) break;
        }
    }

    const modalTitle = document.getElementById('modal-gif-title');
    const modalSubtitle = document.getElementById('modal-gif-subtitle');
    const modalImg = document.getElementById('modal-gif-image');
    const modalHow = document.getElementById('modal-gif-how');
    const modalMuscles = document.getElementById('modal-gif-muscles');

    modalTitle.textContent = rawName;
    modalSubtitle.textContent = `${sets || 4} séries × ${reps || 15} repetições`;

    const cleanName = rawName.replace(/\s*\(\d+\)$/, '').trim();
    const webpSrc = `/assets/webp/${encodeURIComponent(cleanName)}.webp`;
    let gifFallback = '';
    if (found && found.gif) {
        gifFallback = found.gif;
        if (gifFallback.startsWith('images/')) {
            gifFallback = `/assets/gifs/${gifFallback.replace('images/', '')}`;
        }
        modalHow.textContent = found.how || 'Execute com movimento controlado, postura alinhada e foco na contração muscular.';
        modalMuscles.textContent = found.muscles || found.group || 'Grupamento muscular principal';
    } else {
        gifFallback = `/assets/gifs/${encodeURIComponent(cleanName)}.gif`;
        modalHow.textContent = 'Mantenha a postura alinhada, execute a fase excêntrica de forma controlada e concentre a força no músculo alvo.';
        modalMuscles.textContent = 'Grupamento muscular alvo do exercício.';
    }

    modalImg.onerror = function() {
        if (!this.dataset.fallback) {
            this.dataset.fallback = 'gif';
            this.src = gifFallback || `https://placehold.co/500x320/111827/00FFFF?text=${encodeURIComponent(rawName)}`;
        } else {
            this.src = `https://placehold.co/500x320/111827/00FFFF?text=${encodeURIComponent(rawName)}`;
        }
    };
    delete modalImg.dataset.fallback;
    modalImg.src = webpSrc;

    document.getElementById('exercise-gif-modal').classList.remove('hidden');
    if (window.lucide) {
        lucide.createIcons();
    }
}

function closeExerciseGifModal() {
    document.getElementById('exercise-gif-modal').classList.add('hidden');
}

// Compartilhamento da Ficha via WhatsApp com Layout Claro e Imune a Quebras
function shareTrainingViaWhatsApp() {
    if (!selectedTrainingForModal) return;

    const t = selectedTrainingForModal;

    let out = `🏋️‍♂️ *SHAPE MESTRE | FICHA OFICIAL*\n`;
    out += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `📋 *${t.name.toUpperCase()}*\n`;
    out += `👤 *Gênero:* ${t.gender || 'Geral'}  |  🎯 *Foco:* ${t.category || 'Hipertrofia'}\n`;
    out += `🗓️ *Ciclo:* ${t.details?.duration || '6 Semanas'}\n`;
    out += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (t.details?.routine) {
        Object.entries(t.details.routine).forEach(([sec, list]) => {
            const isAbdomen = sec.toLowerCase().includes('abdom');
            const icon = isAbdomen ? '🍫' : (sec.includes('B') ? '🅱️' : '🅰️');
            out += `${icon} *${sec.toUpperCase()}*\n`;
            out += `──────────────────────────\n`;
            
            list.forEach((item, index) => {
                const num = (index + 1) + '️⃣';
                out += `${num} *${item.exercise}*\n`;
                out += `   ↳ 📊 *${item.sets} séries*  ×  🔁 *${item.reps} reps*\n\n`;
            });
        });
    }

    out += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    out += `💡 *Dica do Personal:* Descanse de 60s a 90s entre as séries e mantenha hidratação constante!\n\n`;
    out += `🎬 *Veja as demonstrações em GIF de cada exercício:*\n`;
    out += `👉 https://shapemestre.acessaronline.com.br/#treinos 🔥`;

    window.currentWhatsAppShareText = out;
    window.currentWhatsAppShareTitle = t.name;
    openWhatsAppShareModal();
}

/**
 * Função de Impressão Profissional / Salvar em PDF
 */
function printTrainingSheet() {
    if (!selectedTrainingForModal) return;
    const t = selectedTrainingForModal;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor, permita popups neste site para abrir a ficha de impressão.');
        return;
    }

    let routineHtml = '';
    if (t.details?.routine) {
        Object.entries(t.details.routine).forEach(([sec, list]) => {
            routineHtml += `
                <div class="section-box">
                    <h2 class="section-title">${sec.toUpperCase()}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%;">Nº</th>
                                <th style="width: 45%;">EXERCÍCIO</th>
                                <th style="width: 12%;">SÉRIES</th>
                                <th style="width: 13%;">REPETIÇÕES</th>
                                <th style="width: 15%;">CARGA (KG)</th>
                                <th style="width: 10%;">VISTO</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            list.forEach((item, index) => {
                routineHtml += `
                    <tr>
                        <td style="text-align: center; font-weight: bold;">${index + 1}</td>
                        <td style="font-weight: 600;">${item.exercise}</td>
                        <td style="text-align: center;">${item.sets}</td>
                        <td style="text-align: center;">${item.reps}</td>
                        <td style="border-bottom: 1px dashed #999;">&nbsp;</td>
                        <td style="text-align: center;"><div class="checkbox-box"></div></td>
                    </tr>
                `;
            });

            routineHtml += `
                        </tbody>
                    </table>
                </div>
            `;
        });
    }

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Ficha de Treino - ${t.name}</title>
            <style>
                @page { size: A4; margin: 12mm 15mm; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    color: #111;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                    font-size: 11pt;
                }
                .header {
                    border-bottom: 2px solid #000;
                    padding-bottom: 8px;
                    margin-bottom: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .logo {
                    font-size: 20pt;
                    font-weight: 900;
                    letter-spacing: 1px;
                }
                .subtitle {
                    font-size: 9pt;
                    color: #555;
                    text-transform: uppercase;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    gap: 8px;
                    background: #f4f4f4;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                    font-size: 9.5pt;
                    border: 1px solid #ddd;
                }
                .meta-item {
                    display: flex;
                    flex-direction: column;
                }
                .meta-item span:first-child {
                    font-size: 8pt;
                    color: #666;
                    text-transform: uppercase;
                    font-weight: bold;
                }
                .meta-item span:last-child {
                    font-weight: bold;
                    color: #000;
                }
                .section-box {
                    margin-bottom: 16px;
                    page-break-inside: avoid;
                }
                .section-title {
                    font-size: 11pt;
                    font-weight: bold;
                    background: #222;
                    color: #fff;
                    padding: 4px 8px;
                    margin: 0 0 6px 0;
                    border-radius: 4px;
                    letter-spacing: 0.5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9pt;
                }
                th {
                    background: #eaeaea;
                    border: 1px solid #ccc;
                    padding: 6px 4px;
                    font-weight: bold;
                    text-align: left;
                }
                td {
                    border: 1px solid #ddd;
                    padding: 5px 6px;
                }
                .checkbox-box {
                    width: 12px;
                    height: 12px;
                    border: 1.5px solid #555;
                    margin: 0 auto;
                    border-radius: 2px;
                }
                .footer {
                    margin-top: 20px;
                    border-top: 1px solid #ccc;
                    padding-top: 8px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8pt;
                    color: #666;
                }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo">SHAPE MESTRE</div>
                    <div class="subtitle">Ficha Oficial de Treinamento Resistido</div>
                </div>
                <div style="text-align: right; font-size: 8pt; color: #666;">
                    shapemestre.acessaronline.com.br
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <span>Ficha de Treino</span>
                    <span>${t.name}</span>
                </div>
                <div class="meta-item">
                    <span>Público / Divisão</span>
                    <span>${t.gender} • ${t.category}</span>
                </div>
                <div class="meta-item">
                    <span>Duração Prevista</span>
                    <span>${t.details?.duration || '6 Semanas'}</span>
                </div>
            </div>

            ${routineHtml}

            <div class="footer">
                <div>Orientação: Respeite o intervalo de 60s a 90s entre as séries e mantenha hidratação constante.</div>
                <div>Impresso em: ${new Date().toLocaleDateString('pt-BR')}</div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}
