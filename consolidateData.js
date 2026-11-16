const fs = require('fs');
const path = require('path');

console.log('--- Iniciando Consolidação de Dados para o Shape Mestre ---');

// 1. CONSOLIDAR TREINOS (Fichas Femininas e Masculinas)
const treinosSource = path.join(__dirname, '..', 'COPIAS DE SEGURANÇA SOMENTE ARQUIVO JSON', 'FICHAS FEMININAS', 'data', 'treinos.json');
let trainings = [];
if (fs.existsSync(treinosSource)) {
    trainings = JSON.parse(fs.readFileSync(treinosSource, 'utf8'));
    console.log(`Carregadas ${trainings.length} fichas de treino.`);
} else {
    console.warn('Arquivo treinos.json não encontrado no caminho padrão.');
}

// Salvar trainings.json
fs.writeFileSync(
    path.join(__dirname, 'data', 'trainings.json'),
    JSON.stringify(trainings, null, 2),
    'utf8'
);
console.log('✅ data/trainings.json salvo com sucesso.');

// 2. CONSOLIDAR EXERCÍCIOS
const exercisesSource = path.join(__dirname, '..', 'exercicios3-costas-peito-biceps-glúteos-triceps', 'data', 'exercises.json');
let exercises = [];
if (fs.existsSync(exercisesSource)) {
    exercises = JSON.parse(fs.readFileSync(exercisesSource, 'utf8'));
    console.log(`Carregados ${exercises.length} exercícios base.`);
}

// Padronizar grupos musculares
exercises.forEach(ex => {
    if (ex.group === 'bracos') ex.group = 'biceps';
    if (ex.group === 'trapézio') ex.group = 'trapezio';
    if (ex.group === 'antebraços') ex.group = 'antebraco';
});

// Adicionar exercícios de Panturrilha que estavam na pasta de GIFs
const panturrilhaGifs = [
    { name: 'Elevação de Panturrilha em Pé', gif: 'Panturrilhas em Pé.gif', how: 'Fique na ponta dos pés em uma elevação e desça controladamente até o calcanhar alongar bem.', when: 'Final do treino de pernas.' },
    { name: 'Elevação de Panturrilha no Smith', gif: 'Panturrilha em Pé no Smith.gif', how: 'Posicione a barra sobre os trapézios, apoie a ponta dos pés em um degrau e realize a flexão plantar.', when: 'Principal exercício com sobrecarga para o gastrocnêmio.' },
    { name: 'Elevação de Panturrilha Sentado com Barra', gif: 'Elevação de Panturrilha Sentado com Barra.gif', how: 'Sentado no banco, apoie a barra com proteção sobre os joelhos e faça a flexão plantar focando no músculo sóleo.', when: 'Segundo exercício de panturrilha.' },
    { name: 'Elevação de Panturrilha no Leg Press', gif: 'Elevação de Panturrilha no Leg Press.gif', how: 'Apoie as pontas dos pés na base inferior da plataforma e empurre estendendo os tornozelos com os joelhos destravados.', when: 'Excelente para trabalhar com volume e carga com segurança.' },
    { name: 'Elevação de Panturrilhas no Hack', gif: 'Elevação de Panturrilhas no Hack.gif', how: 'No carrinho do hack squat, apoie as pontas dos pés na borda da plataforma e eleve os calcanhares no ponto mais alto.', when: 'Alternativa segura com suporte dorsal.' },
    { name: 'Elevação de Panturrilha Sentado com Alavanca', gif: 'Elevação de Panturrilha Sentado com Alavanca.gif', how: 'Ajuste a almofada sobre as coxas, destrave o aparelho e faça a contração máxima na subida.', when: 'Foco exclusivo no sóleo para espessura da panturrilha.' },
    { name: 'Elevação Unilateral de Panturrilha no Leg Press', gif: 'Elevação Unilateral de Panturrilha no Leg Press.gif', how: 'Realize o movimento com uma perna de cada vez para corrigir assimetrias de força e volume.', when: 'Exercício de isolamento corretivo.' },
    { name: 'Agachamento com Sustentação e Elevação de Panturrilhas', gif: 'Agachamento com Sustentação e Elevação de Panturrilhas.gif', how: 'Em posição isométrica de agachamento, realize a elevação alternada ou dupla dos calcanhares.', when: 'Treino metabólico ou queima final.' }
];

panturrilhaGifs.forEach(p => {
    exercises.push({
        name: p.name,
        group: 'panturrilha',
        goals: ['hipertrofia', 'resistencia', 'definicao'],
        muscles: 'Gastrocnêmio (cabeças medial e lateral), Sóleo.',
        why: 'Desenvolve força, espessura e vascularização nas panturrilhas, melhorando estética e estabilidade do tornozelo.',
        how: p.how,
        when: p.when,
        gif: `images/panturrilha/${p.gif}`
    });
});

fs.writeFileSync(
    path.join(__dirname, 'data', 'exercises.json'),
    JSON.stringify(exercises, null, 2),
    'utf8'
);
console.log(`✅ data/exercises.json salvo com sucesso (${exercises.length} exercícios).`);

// 3. CONSOLIDAR RECEITAS FITNESS
const recipes = [
    {
        id: 1,
        title: "Panqueca Proteica de Aveia e Banana",
        category: "Café da Manhã",
        prepTime: "10 min",
        calories: 320,
        protein: 26,
        carbs: 38,
        fat: 6,
        image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "2 ovos inteiros",
            "1 banana prata amassada",
            "30g de aveia em flocos finos",
            "1 scoop (30g) de Whey Protein de baunilha ou chocolate",
            "1 colher de café de canela em pó"
        ],
        instructions: [
            "Em uma tigela, amasse a banana e misture os ovos até ficar homogêneo.",
            "Adicione a aveia, o Whey Protein e a canela.",
            "Aqueça uma frigideira antiaderente untada com um fio de azeite ou óleo de coco.",
            "Despeje a massa em fogo baixo, tampe e doure dos dois lados por cerca de 2 minutos cada."
        ]
    },
    {
        id: 2,
        title: "Frango Grelhado Crocante com Purê de Batata Doce",
        category: "Almoço / Jantar",
        prepTime: "25 min",
        calories: 450,
        protein: 48,
        carbs: 42,
        fat: 8,
        image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "180g de peito de frango em filés finos",
            "180g de batata doce cozida e amassada",
            "1 colher de sobremesa de azeite de oliva",
            "Alho, páprica defumada, sal e pimenta-do-reino a gosto",
            "Couve flor ou brócolis cozido no vapor (à vontade)"
        ],
        instructions: [
            "Tempere o frango com alho, páprica, sal e pimenta.",
            "Grelhe em frigideira bem quente com o azeite até dourar bem os dois lados (cerca de 4 a 5 min por lado).",
            "Amasse a batata doce ainda quente, tempere com uma pitada de sal e noz-moscada.",
            "Sirva o frango com o purê e os legumes no vapor."
        ]
    },
    {
        id: 3,
        title: "Omelete Turbo Anabólico com Queijo Branco e Espinafre",
        category: "Café da Manhã / Jantar",
        prepTime: "12 min",
        calories: 310,
        protein: 32,
        carbs: 4,
        fat: 16,
        image: "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "3 claras e 2 gemas",
            "50g de queijo minas frescal ou ricota em cubos",
            "1 xícara de folhas de espinafre picadas",
            "1/2 tomate picadinho",
            "Sal, orégano e cúrcuma a gosto"
        ],
        instructions: [
            "Bata os ovos com sal, cúrcuma e orégano com um garfo.",
            "Refogue rapidamente o espinafre e o tomate em frigideira antiaderente.",
            "Despeje os ovos batidos, distribua o queijo por cima e deixe firmar em fogo baixo com tampa.",
            "Dobre ao meio e sirva quente."
        ]
    },
    {
        id: 4,
        title: "Bowl Pré-Treino de Açaí Zero com Whey e Morangos",
        category: "Pré-Treino",
        prepTime: "5 min",
        calories: 340,
        protein: 28,
        carbs: 45,
        fat: 5,
        image: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "150g de polpa de açaí puro (sem xarope)",
            "1 scoop de Whey Protein sabor morango ou baunilha",
            "50ml de água ou leite desnatado gelado",
            "4 morangos picados",
            "15g de granola sem açúcar"
        ],
        instructions: [
            "Bata a polpa de açaí, o Whey e a água no liquidificador ou mixer até virar um creme bem espesso.",
            "Despeje na tigela e finalize com morangos frescos e a granola por cima.",
            "Consuma 40 a 60 minutos antes do treino de alta intensidade."
        ]
    },
    {
        id: 5,
        title: "Mousse de Chocolate Fit 2 Ingredientes",
        category: "Sobremesa Fit",
        prepTime: "5 min (+ 1h geladeira)",
        calories: 190,
        protein: 22,
        carbs: 9,
        fat: 4,
        image: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "1 pote (150g) de iogurte grego natural desnatado sem açúcar",
            "1 scoop (30g) de Whey Protein ou proteína isolada sabor chocolate belga",
            "1 colher de chá de cacau 100% (opcional, para intensificar o sabor)",
            "Nibs de cacau ou raspas de chocolate 70% para decorar"
        ],
        instructions: [
            "Em uma taça, misture o iogurte grego com o Whey Protein e o cacau em pó.",
            "Mexa vigorosamente com uma colher pequena ou mini fouet até obter textura aerada de mousse.",
            "Leve à geladeira por 1 hora para firmar.",
            "Decore com raspas de chocolate amargo e sirva gelado."
        ]
    },
    {
        id: 6,
        title: "Salmão Grelhado com Arroz Integral e Aspargos",
        category: "Almoço / Jantar",
        prepTime: "20 min",
        calories: 480,
        protein: 40,
        carbs: 35,
        fat: 18,
        image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&auto=format&fit=crop&q=60",
        ingredients: [
            "170g de filé de salmão fresco",
            "100g de arroz integral cozido",
            "6 talos de aspargos frescos ou brócolis",
            "Suco de 1/2 limão siciliano",
            "Sal marinho, pimenta-do-reino e azeite de oliva"
        ],
        instructions: [
            "Tempere o salmão com sal, pimenta e gotas de limão.",
            "Em frigideira bem quente com um fio de azeite, sele o salmão primeiro com a pele para baixo por 4 minutos.",
            "Vire e grelhe por mais 3 minutos até ficar suculento por dentro.",
            "Na mesma frigideira, salteie os aspargos por 3 minutos com sal e pimenta.",
            "Sirva com o arroz integral quente."
        ]
    }
];

fs.writeFileSync(
    path.join(__dirname, 'data', 'recipes.json'),
    JSON.stringify(recipes, null, 2),
    'utf8'
);
console.log(`✅ data/recipes.json salvo com sucesso (${recipes.length} receitas).`);
console.log('--- Consolidação concluída com êxito! ---');
