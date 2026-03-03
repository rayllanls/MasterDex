// Global modal reference
const modal = document.getElementById('pokemon-modal');
const closeBtn = document.getElementById('close-modal');
const modalBody = document.getElementById('modal-body');

// Cores baseadas nos tipos (Reutilizando variáveis CSS do root)
const getTypeColor = (type) => {
    const rootStyles = getComputedStyle(document.documentElement);
    return rootStyles.getPropertyValue(`--type-${type}`).trim() || '#A8A878';
};

/**
 * Formata os IDs como #001, #025
 */
const formatId = (id) => {
    return `#${id.toString().padStart(3, '0')}`;
};

/**
 * Abre o Modal com os dados completos do Pokémon
 */
async function openModal(pokemonData) {
    if (!pokemonData) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const mainType = pokemonData.types[0].type.name;
    const mainColor = getTypeColor(mainType);

    let highResImg = pokemonData.sprites.other["official-artwork"].front_default;
    if (!highResImg) highResImg = pokemonData.sprites.other.dream_world.front_default;
    if (!highResImg) highResImg = pokemonData.sprites.front_default;

    // Processa os ataques aprendidos por nível
    const levelMoves = pokemonData.moves.map(m => {
        const levelUpDetail = m.version_group_details.find(d => d.move_learn_method.name === 'level-up');
        if (levelUpDetail && levelUpDetail.level_learned_at > 0) {
            return {
                name: m.move.name.replace('-', ' '),
                level: levelUpDetail.level_learned_at,
                url: m.move.url
            };
        }
        return null;
    }).filter(m => m !== null).sort((a, b) => a.level - b.level);

    // Remove duplicates
    const uniqueMoves = [];
    const seenMoves = new Set();
    for (const m of levelMoves) {
        if (!seenMoves.has(m.name)) {
            seenMoves.add(m.name);
            uniqueMoves.push(m);
        }
    }

    modalBody.innerHTML = `
        <div class="modal-header-section" style="background: linear-gradient(135deg, ${mainColor}80 0%, var(--bg-color) 100%);">
            <div class="modal-bg-pattern"></div>
            <div class="modal-image-container">
                <img src="${highResImg}" alt="${pokemonData.name}">
            </div>
            
            <div class="modal-title-group">
                <div class="modal-poke-id">${formatId(pokemonData.id)}</div>
                <div class="modal-poke-name">${pokemonData.name}</div>
                <div class="pokemon-types">
                    ${pokemonData.types.map(t => `<span class="type-badge" style="background-color: var(--type-${t.type.name})">${t.type.name}</span>`).join('')}
                </div>
            </div>
        </div>

        <div class="modal-info-grid">
            <div class="info-cards">
                <div class="info-box">
                    <div class="info-box-label"><i class="fa-solid fa-weight-hanging"></i> Peso</div>
                    <div class="info-box-value">${(pokemonData.weight / 10).toFixed(1)} kg</div>
                </div>
                <div class="info-box">
                    <div class="info-box-label"><i class="fa-solid fa-ruler-vertical"></i> Altura</div>
                    <div class="info-box-value">${(pokemonData.height / 10).toFixed(1)} m</div>
                </div>
            </div>

            <div class="abilities-section">
                <div class="section-title">Habilidades</div>
                <div class="abilities-list">
                    ${pokemonData.abilities.map(a => `<button class="ability-btn" data-url="${a.ability.url}" data-name="${a.ability.name.replace('-', ' ')}">${a.ability.name.replace('-', ' ')}${a.is_hidden ? ' <span class="ability-hidden">(oculta)</span>' : ''}</button>`).join('')}
                </div>
                <div class="ability-desc-box hidden" id="ability-description"></div>
            </div>

            <div class="stats-section">
                <div class="section-title">Base Stats</div>
                <div class="stats-container">
                    ${pokemonData.stats.map(s => {
        let statName = s.stat.name.replace('special-', 'Sp. ').toUpperCase();
        if (statName === 'HP') statName = 'HP';
        return `
                        <div class="stat-row">
                            <div class="stat-name">${statName}</div>
                            <div class="stat-val">${s.base_stat}</div>
                            <div class="stat-bar">
                                <div class="stat-fill" style="background-color: ${mainColor}; width: 0%;" data-target="${Math.min((s.base_stat / 255) * 100, 100)}%"></div>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </div>

            <div class="weaknesses-section">
                <div class="section-title">Fraquezas</div>
                <div class="pokemon-types" id="modal-weaknesses" style="justify-content: flex-start;">
                    <div class="move-tag">Calculando...</div>
                </div>
            </div>

            <div class="evolutions-section">
                <div class="section-title">Evoluções</div>
                <div class="evolutions-container" id="modal-evolutions">
                    <div class="move-tag">Buscando cadeia...</div>
                </div>
            </div>

            <div class="moves-section">
                <div class="section-title">Ataques por Nível</div>
                <div class="table-container">
                    <table class="moves-table">
                        <thead>
                            <tr>
                                <th class="col-lvl">Lv.</th>
                                <th class="col-name">Move</th>
                                <th class="col-type">Type</th>
                                <th class="col-cat">Cat.</th>
                                <th class="col-pow">Power</th>
                                <th class="col-acc">Acc.</th>
                            </tr>
                        </thead>
                        <tbody class="level-moves-list">
                            ${uniqueMoves.length > 0 ?
            '<tr><td colspan="6" class="move-tag text-center">Buscando detalhes dos ataques...</td></tr>'
            : '<tr><td colspan="6" style="color:var(--text-secondary);font-size:0.9rem;text-align:center;">Nenhum ataque por nível registrado.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const fills = modalBody.querySelectorAll('.stat-fill');
        fills.forEach(fill => {
            fill.style.width = fill.getAttribute('data-target');
        });
    }, 100);

    // Carrega Fraquezas Assincronamente
    fetchTypeWeaknesses(pokemonData.types).then(weaknesses => {
        const wContainer = document.getElementById('modal-weaknesses');
        if (wContainer) {
            if (weaknesses.length === 0) {
                wContainer.innerHTML = '<span style="color:var(--text-secondary);font-size:0.9rem;">Nenhuma fraqueza extrema</span>';
            } else {
                wContainer.innerHTML = weaknesses.map(w => `<span class="type-badge" style="background-color: var(--type-${w})">${w}</span>`).join('');
            }
        }
    });

    // Carrega Evoluções Assincronamente
    fetchPokemonSpecies(pokemonData.id).then(species => {
        if (species && species.evolution_chain) {
            fetchEvolutionChain(species.evolution_chain.url).then(evolutions => {
                const eContainer = document.getElementById('modal-evolutions');
                if (eContainer) {
                    if (evolutions.length <= 1) {
                        eContainer.innerHTML = '<span style="color:var(--text-secondary);font-size:0.9rem;">Este Pokémon não evolui.</span>';
                    } else {
                        let html = '';
                        evolutions.forEach((evo, idx) => {
                            html += `
                            <div class="evolution-item ${evo.id === pokemonData.id ? 'current' : ''}" onclick="window.navigateToPokemon(${evo.id})">
                                <div class="evo-img-bg">
                                    <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${evo.id}.png" alt="${evo.name}">
                                </div>
                                <span class="evo-name">${evo.name} <span style="font-size:0.75rem;opacity:0.6;">#${evo.id.toString().padStart(3, '0')}</span></span>
                            </div>`;

                            if (idx < evolutions.length - 1) {
                                const nextTrigger = evolutions[idx + 1].trigger;
                                html += `
                                <div class="evo-trigger">
                                    <i class="fa-solid fa-arrow-right evo-arrow"></i>
                                    ${nextTrigger ? `<span class="evo-trigger-text">(${nextTrigger})</span>` : ''}
                                </div>`;
                            }
                        });
                        eContainer.innerHTML = html;
                    }
                }
            });
        }
    });

    // Função auxiliar para renderizar ícone da categoria (Cat.) do ataque
    const getCategoryIcon = (category) => {
        if (category === 'physical') {
            return '<i class="fa-solid fa-certificate cat-physical" title="Physical"></i>'; // Explosion-like / star
        } else if (category === 'special') {
            return '<i class="fa-solid fa-bullseye cat-special" title="Special"></i>'; // Circles
        } else {
            return '<i class="fa-solid fa-moon cat-status" title="Status"></i>'; // Yin-yang / Moon
        }
    };

    // Carrega Detalhes dos Ataques Assincronamente
    const movesContainer = modalBody.querySelector('.level-moves-list');
    if (uniqueMoves.length > 0 && movesContainer) {
        Promise.all(uniqueMoves.map(async m => {
            const detail = await fetchMoveDetails(m.url);

            let desc = 'Sincronizando dados...';
            if (detail && detail.flavor_text_entries) {
                const enEntry = detail.flavor_text_entries.find(e => e.language.name === 'en');
                if (enEntry) {
                    desc = enEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');
                }
            }

            return {
                ...m,
                type: detail ? detail.type.name : 'normal',
                category: detail && detail.damage_class ? detail.damage_class.name : 'status',
                power: detail && detail.power ? detail.power : '—',
                accuracy: detail && detail.accuracy ? detail.accuracy : '—',
                desc: desc
            };
        })).then(detailedMoves => {
            movesContainer.innerHTML = detailedMoves.map(m => `
                <tr class="move-row" onclick="this.nextElementSibling.classList.toggle('active')">
                    <td class="col-lvl">${m.level}</td>
                    <td class="col-name">${m.name}</td>
                    <td class="col-type"><span class="type-badge mini" style="background-color: var(--type-${m.type})">${m.type}</span></td>
                    <td class="col-cat">${getCategoryIcon(m.category)}</td>
                    <td class="col-pow">${m.power}</td>
                    <td class="col-acc">${m.accuracy}</td>
                </tr>
                <tr class="move-desc-row">
                    <td colspan="6">
                        <div class="move-desc-content">
                            <div class="move-desc-mobile-stats">
                                <span><strong>Cat:</strong> ${getCategoryIcon(m.category)} <span style="text-transform:capitalize;">${m.category}</span></span>
                                <span><strong>Acc:</strong> ${m.accuracy}</span>
                            </div>
                            <p>${m.desc}</p>
                        </div>
                    </td>
                </tr>
            `).join('');
        });
    }
}

// Global Navigate to handle Evolution clicks inside the modal
window.navigateToPokemon = async (id) => {
    // Show quick loading inside modal
    modalBody.innerHTML = `
        <div class="loading-state" style="height:100%; justify-content:center;">
            <div class="spinner-masterball" style="width:40px;height:40px;"><div class="top-half"></div><div class="center-band"><div class="center-button"></div></div><div class="bottom-half"></div></div>
            <p style="margin-top:1rem;">Carregando...</p>
        </div>
    `;
    try {
        const data = await fetchPokemonCompleteDetails(id);
        openModal(data);
    } catch (e) {
        console.error("Falha ao abrir evolução", e);
    }
};

// Fechamento pelo botão X
closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restaura scroll
});

// Fechamento clicando fora
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
});

// Clickable Abilities - fetch and show description
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.ability-btn');
    if (!btn) return;

    const descBox = document.getElementById('ability-description');
    if (!descBox) return;

    // Toggle if already showing this ability
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        descBox.classList.add('hidden');
        return;
    }

    // Remove active from all
    document.querySelectorAll('.ability-btn.active').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    descBox.classList.remove('hidden');
    descBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

    try {
        const resp = await fetch(btn.dataset.url);
        const data = await resp.json();

        // Try PT-BR first, then EN
        let effectText = '';
        const ptEntry = data.flavor_text_entries.find(e => e.language.name === 'en');
        if (ptEntry) effectText = ptEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');

        let shortEffect = '';
        const enEffect = data.effect_entries.find(e => e.language.name === 'en');
        if (enEffect) shortEffect = enEffect.short_effect;

        descBox.innerHTML = `
            <div class="ability-desc-name">${btn.dataset.name}</div>
            <p class="ability-desc-text">${shortEffect || effectText || 'Descrição não disponível.'}</p>
        `;
    } catch {
        descBox.innerHTML = 'Erro ao buscar habilidade.';
    }
});
