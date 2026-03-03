// Elementos do DOM
const pokemonGrid = document.getElementById('pokemon-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');
const paginationContainer = document.getElementById('pagination');
const pokedexControls = document.getElementById('pokedex-controls');
const autocompleteResults = document.getElementById('autocomplete-results');
const genDropdown = document.getElementById('gen-dropdown');

// Estado da Aplicação
let currentList = [];
let currentIndex = 0;
let allPokemonCache = []; // Para o autocomplete
let naturesLoaded = false;
let typesLoaded = false;
const ITEMS_PER_PAGE = 30; // Quantidade de Pokémon carregados por vez no scroll/botão

// Inicializador
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Pokedex App Initializing - v2.2 with Unified List");
    initTabs();

    // Obter toda a lista de imediato (1025 pokemons, JSON pequeno)
    showLoading(true);
    await fetchAllPokemonForAutocomplete();

    currentList = allPokemonCache;
    currentIndex = 0;

    setupEventListeners();
    await renderMorePokemon();
    showLoading(false);
});

async function fetchAllPokemonForAutocomplete() {
    try {
        const res = await fetch(`${API_BASE}/pokemon?limit=1025&offset=0`);
        const data = await res.json();
        allPokemonCache = data.results.map(p => {
            const parts = p.url.split('/');
            return { name: p.name, id: parts[parts.length - 2] };
        });
    } catch (e) {
        console.error("Autocomplete fetch failed:", e);
    }
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update Active Tab
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Find target view
            const targetId = btn.getAttribute('data-tab');

            // Toggle Views
            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
            });
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');

            // Handle Controls Visibility
            if (targetId === 'view-pokedex') {
                pokedexControls.classList.remove('hidden');
            } else {
                pokedexControls.classList.add('hidden');
            }

            // Lazy Load Natures and Types
            if (targetId === 'view-natures' && !naturesLoaded) {
                console.log("Triggering loadNatures()...");
                naturesLoaded = true;
                loadNatures();
            }
            if (targetId === 'view-types' && !typesLoaded) {
                console.log("Triggering loadTypeChart()...");
                typesLoaded = true;
                loadTypeChart();
            }
        });
    });
}

// Configuração dos Eventos
function setupEventListeners() {
    // Dropdown de Geração
    genDropdown.addEventListener('change', (e) => {
        const genId = parseInt(e.target.value);
        const gen = GENERATIONS.find(g => g.id === genId);

        if (gen) {
            // Adjust currentIndex based on generation start (0-indexed)
            currentIndex = gen.start - 1;
            pokemonGrid.innerHTML = '';

            // Clear search if any
            if (searchInput.value !== '') {
                searchInput.value = '';
                clearSearchBtn.classList.add('hidden');
                autocompleteResults.classList.add('hidden');
            }

            renderMorePokemon();
        }
    });

    // Botão "Carregar Mais"
    loadMoreBtn.addEventListener('click', () => {
        renderMorePokemon();
    });

    // Campo de busca
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        // Controle de UI do botão de limpar
        if (query.length > 0) clearSearchBtn.classList.remove('hidden');
        else {
            clearSearchBtn.classList.add('hidden');
            autocompleteResults.classList.add('hidden');
        }

        // Logic for Autocomplete
        if (query.length >= 2) {
            const matches = allPokemonCache.filter(p => p.name.includes(query) || p.id === query).slice(0, 8);
            if (matches.length > 0) {
                autocompleteResults.innerHTML = matches.map(m => `
                    <div class="autocomplete-item" onclick="selectAutocomplete('${m.name}')">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${m.id}.png" alt="${m.name}" loading="lazy">
                        <span>${m.name}</span>
                        <span class="autocomplete-id">#${m.id.padStart(3, '0')}</span>
                    </div>
                `).join('');
                autocompleteResults.classList.remove('hidden');
            } else {
                autocompleteResults.classList.add('hidden');
            }
        } else {
            autocompleteResults.classList.add('hidden');
        }

        // Debounce de busca na Grid
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query === '') {
                // Restore grid normal
                currentIndex = 0;
                genDropdown.value = "1";
                pokemonGrid.innerHTML = '';
                renderMorePokemon();
            } else {
                // Only auto-search if the query is an exact match for a known Pokémon
                // or a numeric ID. This prevents 404s from partial names like "chari".
                const isNumeric = /^\d+$/.test(query);
                const isExactMatch = allPokemonCache.some(p => p.name === query);
                if (isExactMatch || isNumeric) {
                    searchPokemon(query);
                }
            }
        }, 800);
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
            autocompleteResults.classList.add('hidden');
        }
    });

    // Botão limpar busca
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        autocompleteResults.classList.add('hidden');

        // Restore grid completely
        currentIndex = 0;
        genDropdown.value = "1";
        pokemonGrid.innerHTML = '';
        renderMorePokemon();
    });

    // Permitir submeter com "Enter" imediatamente
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            autocompleteResults.classList.add('hidden');
            const query = e.target.value.trim().toLowerCase();
            if (query !== '') searchPokemon(query);
        }
    });
}

// Select item from autocomplete
window.selectAutocomplete = function (name) {
    searchInput.value = name;
    autocompleteResults.classList.add('hidden');
    searchPokemon(name);
};

// Renderiza a próxima página de resultados na grid
async function renderMorePokemon() {
    if (currentIndex >= currentList.length) return;

    showLoading(true);
    const endIndex = Math.min(currentIndex + ITEMS_PER_PAGE, currentList.length);
    const sliceToFetch = currentList.slice(currentIndex, endIndex);

    // Mostramos estado loading mas sem limpar a grid, assim scroll não trava
    loadingSpinner.classList.remove('hidden');
    paginationContainer.classList.add('hidden');

    try {
        const detailsArray = await fetchPokemonDetailsGroup(sliceToFetch);

        detailsArray.forEach(data => {
            if (data) {
                const card = createPokemonCard(data);
                pokemonGrid.appendChild(card);
            }
        });

        currentIndex = endIndex;

        // Exibe "Carregar Mais" se tiver mais itens
        if (currentIndex < currentList.length) {
            paginationContainer.classList.remove('hidden');
        } else {
            paginationContainer.classList.add('hidden');
        }

    } catch (error) {
        console.error("Falha ao renderizar grupo:", error);
    } finally {
        showLoading(false);
    }
}


// Executa a busca direta (por nome/ID) na PokeAPI
async function searchPokemon(query) {
    showLoading(true);
    pokemonGrid.innerHTML = '';
    paginationContainer.classList.add('hidden');

    try {
        const data = await fetchPokemonCompleteDetails(query);
        const card = createPokemonCard(data);
        pokemonGrid.appendChild(card);
    } catch (error) {
        showError();
    } finally {
        showLoading(false);
    }
}

// Cria o Elemento do Card
function createPokemonCard(pokemonData) {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.onclick = () => openModal(pokemonData); // Invoca a função de modal.js

    const typesHTML = pokemonData.types.map(t => {
        return `<span class="type-badge" style="background-color: var(--type-${t.type.name})">${t.type.name}</span>`;
    }).join('');

    // Previne falha caso pokemon não tenha sprite
    const spriteUrl = pokemonData.sprites.other["official-artwork"].front_default || pokemonData.sprites.front_default || '';

    card.innerHTML = `
        <div class="card-header">
            <span></span>
            <span class="poke-id">${formatId(pokemonData.id)}</span>
        </div>
        <div class="sprite-container">
            ${spriteUrl ? `<img src="${spriteUrl}" alt="${pokemonData.name}" class="pokemon-sprite" loading="lazy">` : ''}
        </div>
        <div class="pokemon-info">
            <h3 class="pokemon-name">${pokemonData.name}</h3>
            <div class="pokemon-types">
                ${typesHTML}
            </div>
        </div>
    `;

    // Add cor suave do background com base no tipo
    const mainType = pokemonData.types[0].type.name;
    const mainColor = getTypeColor(mainType);
    card.style.borderTop = `3px solid ${mainColor}`;

    return card;
}

// Helpers de UI
function showLoading(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        if (pokemonGrid.innerHTML === '') {
            pokemonGrid.classList.add('hidden');
        }
    } else {
        loadingSpinner.classList.add('hidden');
        pokemonGrid.classList.remove('hidden');
    }
}

function showError(msg = null) {
    pokemonGrid.innerHTML = '';
    errorMessage.classList.remove('hidden');
    if (msg) errorMessage.querySelector('p').textContent = msg;
    paginationContainer.classList.add('hidden');
}

// --- Funções das Novas Abas (Naturezas e Tipos) ---

async function loadNatures() {
    const container = document.getElementById('natures-grid');
    container.innerHTML = '<div style="color:white;text-align:center;width:100%;">Carregando Naturezas...</div>';

    try {
        const res = await fetch(`${API_BASE}/nature?limit=30`);
        const data = await res.json();

        const naturesHtml = await Promise.all(data.results.map(async (n) => {
            const detailRes = await fetch(n.url);
            const detail = await detailRes.json();

            const inc = detail.increased_stat ? detail.increased_stat.name.replace('-', ' ') : 'Nenhum';
            const dec = detail.decreased_stat ? detail.decreased_stat.name.replace('-', ' ') : 'Nenhum';

            return `
                <div class="nature-card">
                    <div class="nature-name">${n.name}</div>
                    <div class="nature-stat stat-up">↑ ${inc}</div>
                    <div class="nature-stat stat-down">↓ ${dec}</div>
                </div>
            `;
        }));

        container.innerHTML = naturesHtml.join('');

        // Nature search filter
        const natureSearchInput = document.getElementById('nature-search');
        if (natureSearchInput) {
            natureSearchInput.addEventListener('input', () => {
                const query = natureSearchInput.value.toLowerCase().trim();
                const cards = container.querySelectorAll('.nature-card');
                cards.forEach(card => {
                    const name = card.querySelector('.nature-name').textContent.toLowerCase();
                    if (name.includes(query)) {
                        card.classList.remove('nature-hidden');
                    } else {
                        card.classList.add('nature-hidden');
                    }
                });
            });
        }
    } catch (e) {
        container.innerHTML = '<div style="color:red;text-align:center;width:100%;">Erro ao carregar naturezas.</div>';
    }
}

async function loadTypeChart() {
    const container = document.getElementById('types-container');
    container.innerHTML = '<div style="color:white;text-align:center;width:100%;">Carregando Tipos...</div>';

    // Tabela estática de tipos principais para montar a matriz rápida
    const allTypes = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];

    try {
        // Build empty table structure
        let tableHeader = '<tr><th>Defesa →<br>Ataque ↓</th>' + allTypes.map(t => `<th><span class="type-badge mini" style="background-color: var(--type-${t}); font-size: 0.6rem; padding: 0.2rem 0.4rem;">${t.substring(0, 3)}</span></th>`).join('') + '</tr>';

        let tableRows = '';

        // Fetch all type data in parallel mapped to type name
        const typeDataMap = {};
        await Promise.all(allTypes.map(async (t) => {
            const res = await fetch(`${API_BASE}/type/${t}`);
            typeDataMap[t] = await res.json();
        }));

        allTypes.forEach(atkType => {
            let rowHtml = `<tr><th><span class="type-badge mini" style="background-color: var(--type-${atkType}); font-size: 0.6rem; padding: 0.2rem 0.4rem;">${atkType}</span></th>`;

            const dmgRelations = typeDataMap[atkType].damage_relations;
            const doubles = dmgRelations.double_damage_to.map(dt => dt.name);
            const halves = dmgRelations.half_damage_to.map(dt => dt.name);
            const zeros = dmgRelations.no_damage_to.map(dt => dt.name);

            allTypes.forEach(defType => {
                if (doubles.includes(defType)) {
                    rowHtml += `<td class="super-effective">2x</td>`;
                } else if (halves.includes(defType)) {
                    rowHtml += `<td class="not-very-effective">½x</td>`;
                } else if (zeros.includes(defType)) {
                    rowHtml += `<td class="no-effect">0x</td>`;
                } else {
                    rowHtml += `<td>1x</td>`;
                }
            });

            rowHtml += `</tr>`;
            tableRows += rowHtml;
        });

        container.innerHTML = `<table class="types-chart"><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="color:red;text-align:center;width:100%;">Erro ao carregar tabela de tipos.</div>';
    }
}
