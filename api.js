const API_BASE = 'https://pokeapi.co/api/v2';
const POKEMON_COUNT = 1025; // Até a Geração 9 (aprox)

// Mapeamento de Gerações e seus respectivos IDs de início e fim
const GENERATIONS = [
    { id: 1, name: 'Gen I', start: 1, end: 151 },
    { id: 2, name: 'Gen II', start: 152, end: 251 },
    { id: 3, name: 'Gen III', start: 252, end: 386 },
    { id: 4, name: 'Gen IV', start: 387, end: 493 },
    { id: 5, name: 'Gen V', start: 494, end: 649 },
    { id: 6, name: 'Gen VI', start: 650, end: 721 },
    { id: 7, name: 'Gen VII', start: 722, end: 809 },
    { id: 8, name: 'Gen VIII', start: 810, end: 905 },
    { id: 9, name: 'Gen IX', start: 906, end: 1025 }
];

// Cache simples para evitar requisições redundantes
const pokemonCache = new Map();
const listCache = new Map();

/**
 * Busca a lista básica de Pokémon para uma dada geração
 */
async function fetchGeneration(genId) {
    if (listCache.has(genId)) {
        return listCache.get(genId);
    }

    const gen = GENERATIONS.find(g => g.id === genId);
    if (!gen) throw new Error('Generation not found');

    const limit = gen.end - gen.start + 1;
    const offset = gen.start - 1;

    try {
        const response = await fetch(`${API_BASE}/pokemon?limit=${limit}&offset=${offset}`);
        const data = await response.json();

        // Atribuindo IDs com base na URL
        const results = data.results.map(p => {
            const urlParts = p.url.split('/');
            const id = parseInt(urlParts[urlParts.length - 2]);
            return { ...p, id };
        });

        listCache.set(genId, results);
        return results;
    } catch (error) {
        console.error(`Error fetching generation ${genId}:`, error);
        throw error;
    }
}

/**
 * Busca dados detalhados de multiplos Pokémons simultaneamente para a grid principal
 * @param {Array} pokemonList Lista de objetos com {name, url, id} 
 */
async function fetchPokemonDetailsGroup(pokemonList) {
    const promises = pokemonList.map(async (p) => {
        if (pokemonCache.has(p.id)) return pokemonCache.get(p.id);

        try {
            const res = await fetch(`${API_BASE}/pokemon/${p.id}`);
            const data = await res.json();
            pokemonCache.set(p.id, data);
            return data;
        } catch (error) {
            console.error(`Error fetching detais for ${p.id}:`, error);
            return null;
        }
    });

    return await Promise.all(promises);
}

/**
 * Busca detalhes completos de um Pokémon específico por ID ou Nome (Usado no Modal / Busca direta)
 */
async function fetchPokemonCompleteDetails(identifier) {
    // Tenta numero primeiro se pesquisou por string de numeros
    let isNum = /^\d+$/.test(identifier);
    let cacheKey = isNum ? parseInt(identifier) : identifier.toLowerCase();

    // Se no cache tem pelo ID, verifica.
    if (typeof cacheKey === 'number' && pokemonCache.has(cacheKey)) {
        return pokemonCache.get(cacheKey);
    }

    // Se no cache tem pelo nome (achando no Map)
    if (typeof cacheKey === 'string') {
        for (let [id, val] of pokemonCache.entries()) {
            if (val.name === cacheKey) return val;
        }
    }

    try {
        const res = await fetch(`${API_BASE}/pokemon/${cacheKey}`);
        if (!res.ok) throw new Error('Pokemon not found');
        const data = await res.json();
        pokemonCache.set(data.id, data);
        return data;
    } catch (error) {
        console.error(`Error fetching complete details for ${identifier}:`, error);
        throw error;
    }
}

/**
 * Busca os dados de Espécie (para obter a Evolution Chain)
 */
async function fetchPokemonSpecies(id) {
    try {
        const res = await fetch(`${API_BASE}/pokemon-species/${id}/`);
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        console.error(`Error fetching species ${id}:`, error);
        return null;
    }
}

/**
 * Busca a cadeia de evolução a partir da URL da espécie e formata
 */
async function fetchEvolutionChain(evolutionUrl) {
    try {
        const res = await fetch(evolutionUrl);
        const data = await res.json();

        // Função recursiva para extrair todos os pokemons da cadeia
        const evolutions = [];
        const extractEvo = (node, evolutionDetails = null) => {
            const speciesUrlParts = node.species.url.split('/');
            const id = parseInt(speciesUrlParts[speciesUrlParts.length - 2]);

            let triggerText = '';
            if (evolutionDetails && evolutionDetails.length > 0) {
                const details = evolutionDetails[0];
                if (details.trigger.name === 'level-up' && details.min_level) {
                    triggerText = `Lv. ${details.min_level}`;
                } else if (details.item) {
                    triggerText = details.item.name.replace('-', ' ');
                } else if (details.trigger.name === 'trade') {
                    triggerText = 'Trade';
                } else if (details.min_happiness) {
                    triggerText = 'Happiness';
                } else {
                    triggerText = '?';
                }
            }

            evolutions.push({
                name: node.species.name,
                id: id,
                trigger: triggerText
            });

            node.evolves_to.forEach(child => extractEvo(child, child.evolution_details));
        };
        extractEvo(data.chain);
        return evolutions;
    } catch (error) {
        console.error("Error fetching evolution chain:", error);
        return [];
    }
}

/**
 * Busca detalhes complementares de um ataque especifico (Power, PP, Type, Class, Desc)
 */
async function fetchMoveDetails(moveUrl) {
    try {
        const res = await fetch(moveUrl);
        return await res.json();
    } catch (e) {
        console.error("Error fetching move", e);
        return null;
    }
}

/**
 * Calcula as fraquezas combinando os tipos do Pokémon
 */
async function fetchTypeWeaknesses(types) {
    const weaknesses = new Set();
    const resistances = new Set();
    const immunities = new Set();

    for (const t of types) {
        try {
            const res = await fetch(t.type.url);
            const data = await res.json();

            data.damage_relations.double_damage_from.forEach(type => weaknesses.add(type.name));
            data.damage_relations.half_damage_from.forEach(type => resistances.add(type.name));
            data.damage_relations.no_damage_from.forEach(type => immunities.add(type.name));
        } catch (error) {
            console.error("Error fetching type data:", error);
        }
    }

    // Filtra fraquezas que são resistidas ou imunes pelo outro tipo (se for dual type)
    const finalWeaknesses = [...weaknesses].filter(w => !resistances.has(w) && !immunities.has(w));
    return finalWeaknesses;
}
