const fs = require('fs');
const path = require('path');

// 1. Carregar os 289 exercícios existentes (ricos em detalhes)
const existingPath = path.join(__dirname, '..', 'data', 'exercises.json');
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));

function norm(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Helper de detecção de grupo e músculos
function detectInfo(relPath, filename) {
  const full = (relPath + '/' + filename).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (full.includes('peitoral') || full.includes('peito')) {
    return { group: 'peito', muscles: 'Peitoral Maior, Tríceps e Deltoide Anterior.', how: 'Mantenha a postura alinhada, execute a fase excêntrica de forma controlada e concentre a força no peitoral.', why: 'Desenvolvimento de força, hipertrofia e definição do peitoral.' };
  }
  if (full.includes('costas') || full.includes('eretor')) {
    return { group: 'costas', muscles: 'Latíssimo do Dorso, Romboides e Trapézio.', how: 'Puxe com os cotovelos direcionados para trás, mantendo a coluna alinhada e as escápulas aduzidas.', why: 'Fortalecimento dorsal e melhora postural da cadeia posterior.' };
  }
  if (full.includes('biceps')) {
    return { group: 'biceps', muscles: 'Bíceps Braquial e Braquiorradial.', how: 'Mantenha os cotovelos fixos ao lado do tronco e faça a flexão de cotovelos com cadência controlada.', why: 'Isolamento e pico de contração para os braços.' };
  }
  if (full.includes('triceps')) {
    return { group: 'triceps', muscles: 'Tríceps Braquial (Cabeças lateral, medial e longa).', how: 'Estenda os cotovelos totalmente na fase concêntrica, sem movimentar os ombros.', why: 'Desenvolve espessura e força nos membros superiores.' };
  }
  if (full.includes('ombro') || full.includes('deltoide')) {
    return { group: 'ombros', muscles: 'Deltoides (Anterior, Lateral e Posterior).', how: 'Eleve os braços com estabilidade articular sem projetar o pescoço para a frente.', why: 'Construção de volume e estabilidade para a cintura escapular.' };
  }
  if (full.includes('trapezio')) {
    return { group: 'trapezio', muscles: 'Trapézio Superior e Médio.', how: 'Eleve as escápulas contra a resistência, segure por 1 segundo no pico de contração.', why: 'Melhora da densidade muscular na região superior das costas e pescoço.' };
  }
  if (full.includes('antebraco')) {
    return { group: 'antebraco', muscles: 'Flexores e Extensores de Punho.', how: 'Flexione e estenda os punhos com amplitude controlada e cargas moderadas.', why: 'Força de pegada (grip) e resistência nos antebraços.' };
  }
  if (full.includes('gluteo')) {
    return { group: 'gluteos', muscles: 'Glúteo Máximo, Médio e Mínimo.', how: 'Empurre com os calcanhares e esmague o glúteo no topo do movimento.', why: 'Construção de volume, potência e estabilidade pélvica.' };
  }
  if (full.includes('panturrilha')) {
    return { group: 'panturrilha', muscles: 'Gastrocnêmio e Sóleo.', how: 'Eleve os calcanhares até a máxima flexão plantar e desça alongando completamente a panturrilha.', why: 'Desenvolvimento e definição da musculatura da panturrilha.' };
  }
  if (full.includes('perna') || full.includes('quadriceps') || full.includes('isquiotibiais')) {
    return { group: 'pernas', muscles: 'Quadríceps, Isquiotibiais e Adutores.', how: 'Desça flexionando quadril e joelhos de forma controlada, mantendo o abdômen firme.', why: 'Base fundamental de força e hipertrofia para os membros inferiores.' };
  }
  if (full.includes('calistenia')) {
    return { group: 'calistenia', muscles: 'Músculos funcionais e Core.', how: 'Controle o peso do próprio corpo em todo o percurso, mantendo a contração isométrica do core.', why: 'Domínio do peso corporal, força relativa e coordenação motora avançada.' };
  }
  if (full.includes('mobilidade') || full.includes('alongamento')) {
    return { group: 'alongamento', muscles: 'Fáscias, Articulações e Cadeias Musculares.', how: 'Respire profundamente, mantenha a posição sem solavancos e sinta o alongamento progressivo.', why: 'Aumento da flexibilidade, prevenção de lesões e alívio de tensões articulares.' };
  }
  if (full.includes('funcional') || full.includes('hiit')) {
    return { group: 'funcional', muscles: 'Corpo Inteiro e Sistema Cardiorrespiratório.', how: 'Mantenha ritmo constante, transições rápidas e foco na precisão biomecânica.', why: 'Aceleração do metabolismo, queima calórica e condicionamento atlético.' };
  }
  if (full.includes('crossfit')) {
    return { group: 'crossfit', muscles: 'Múltiplos grupamentos musculares e Core.', how: 'Execute de forma explosiva porém com alinhamento postural rígido.', why: 'Potência, força submáxima e resistência anaeróbica de alta intensidade.' };
  }
  if (full.includes('cardio')) {
    return { group: 'cardio', muscles: 'Sistema Cardiovascular e Membros Inferiores.', how: 'Mantenha cadência regular e frequência cardíaca na zona alvo.', why: 'Saúde cardíaca, resistência aeróbica e gasto calórico.' };
  }
  return { group: 'geral', muscles: 'Grupamentos sinérgicos e estabilizadores.', how: 'Execute com cadência cadenciada e respiração fluida.', why: 'Equilíbrio muscular geral.' };
}

// 2. Varrer todos os GIFs da pasta local
const gifsRoot = path.join(__dirname, '..', '..', 'TODOS OS GIFS MUSCULAÇÃO');
const allGifs = [];
function walk(dir, rel = '') {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = path.join(dir, e.name);
    const r = path.join(rel, e.name);
    if (e.isDirectory()) {
      walk(full, r);
    } else if (e.name.toLowerCase().endsWith('.gif')) {
      allGifs.push({
        filename: e.name,
        rel: r
      });
    }
  });
}

walk(gifsRoot);

// 3. Montar a lista final sem duplicatas
const finalExercises = [...existing];
const addedNames = new Set(existing.map(e => norm(e.name)));

allGifs.forEach(g => {
  let cleanName = g.filename.replace(/\.gif$/i, '').trim();
  cleanName = cleanName.replace(/\s*\(\d+\)$/, '').trim();
  const nKey = norm(cleanName);

  if (!addedNames.has(nKey)) {
    addedNames.add(nKey);
    const info = detectInfo(g.rel, g.filename);
    finalExercises.push({
      name: cleanName,
      group: info.group,
      goals: ['hipertrofia', 'condicionamento'],
      muscles: info.muscles,
      why: info.why,
      how: info.how,
      when: 'Conforme planejado na rotina de treino.',
      gif: '/assets/gifs/' + encodeURIComponent(g.filename)
    });
  }
});

console.log('Total final exercises:', finalExercises.length);
fs.writeFileSync(existingPath, JSON.stringify(finalExercises, null, 2), 'utf8');
console.log('Successfully saved to SHAPE_MESTRE_APP/data/exercises.json!');
