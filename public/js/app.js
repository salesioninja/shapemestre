/**
 * App.js - Controlador Principal do Shape Mestre
 */

let currentTab = 'home';

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar ícones do Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Carregar dados de módulos
    loadTrainings();
    loadExercises();
    loadRecipes();
    loadProfileData();

    // Recuperar aba salva ou padrão
    const savedTab = localStorage.getItem('shape_mestre_active_tab') || 'home';
    switchTab(savedTab);
});

/**
 * Alterna entre as abas do aplicativo sem recarregar a página
 */
function switchTab(tabName) {
    const validTabs = ['home', 'trainings', 'exercises', 'recipes', 'chat', 'profile'];
    if (!validTabs.includes(tabName)) tabName = 'home';

    currentTab = tabName;
    localStorage.setItem('shape_mestre_active_tab', tabName);

    // Esconder todas as abas
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.add('hidden');
    });

    // Mostrar aba ativa
    const activeSection = document.getElementById(`tab-${tabName}`);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }

    // Atualizar botões Desktop
    document.querySelectorAll('.nav-btn-desktop').forEach(btn => {
        const isCurrent = btn.dataset.tab === tabName;
        if (isCurrent) {
            btn.classList.add('text-neoncyan', 'bg-gray-800/60');
            btn.classList.remove('text-gray-300');
        } else {
            btn.classList.remove('text-neoncyan', 'bg-gray-800/60');
            btn.classList.add('text-gray-300');
        }
    });

    // Atualizar botões Mobile
    document.querySelectorAll('.nav-btn-mobile').forEach(btn => {
        const isCurrent = btn.dataset.tab === tabName;
        if (isCurrent) {
            btn.classList.add('text-neonpink');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('text-neonpink');
            btn.classList.add('text-gray-400');
        }
    });

    // Recriar ícones na nova tela
    if (window.lucide) {
        lucide.createIcons();
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast de notificação rápida
function showToast(message, type = 'success') {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    const bgClass = type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-red-950 border-red-500 text-red-300';
    toast.className = `fixed top-20 right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center space-x-2 text-sm font-semibold transition-all duration-300 ${bgClass}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
