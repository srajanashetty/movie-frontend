const API_KEY = 'e6edd0b8';
const API_BASE = 'https://www.omdbapi.com/';

const ROW_CONFIG = [
    { id: 'popular-movies', label: 'New this week', searches: ['avengers', 'extraction', 'inception', 'matrix', 'interstellar', 'titanic', 'godfather', 'shawshank', 'pulp fiction', 'fight club'] },
    { id: 'action-movies', label: 'Trending Now', searches: ['pathaan', 'mission impossible', 'fast furious', 'john wick', 'marvel', 'batman', 'dune', 'top gun', 'bond', 'spider man'] },
    { id: 'comedy-movies', label: 'Action', searches: ['action', 'superhero', 'marvel', 'fast furious', 'mission impossible', 'john wick', 'expendables', 'terminator', 'rambo', 'die hard'] },
    { id: 'drama-movies', label: 'Drama', searches: ['drama', 'oscar', 'schindler', 'forrest gump', 'green mile', 'shawshank', 'godfather', 'prestige', 'departed', 'gone girl'] },
    { id: 'thriller-movies', label: 'Thriller', searches: ['thriller', 'suspense', 'se7en', 'silence of the lambs', 'shutter island', 'gone girl', 'prisoners', 'zodiac', 'memento', 'sixth sense'] }
];

const movieCache = new Map();

function getHiResPosterUrl(posterUrl) {
    if (!posterUrl || posterUrl === 'N/A') return posterUrl;
    // Many OMDb posters point to Amazon images like "..._SX300.jpg".
    // Swapping to a higher SX value noticeably improves hero/banner clarity.
    return posterUrl
        // Pattern: ..._SX300_...
        .replace(/_SX\d+_/i, '_SX1000_')
        .replace(/_SY\d+_/i, '_SY1000_')
        .replace(/_UX\d+_/i, '_UX1000_')
        .replace(/_UY\d+_/i, '_UY1000_')
        // Pattern: ..._SX300.<ext> (very common)
        .replace(/_SX\d+(\.[a-z0-9]+)$/i, '_SX1000$1')
        .replace(/_SY\d+(\.[a-z0-9]+)$/i, '_SY1000$1')
        .replace(/_UX\d+(\.[a-z0-9]+)$/i, '_UX1000$1')
        .replace(/_UY\d+(\.[a-z0-9]+)$/i, '_UY1000$1');
}

async function fetchMovie(searchTerm) {
    const cacheKey = `search_${searchTerm}`;
    if (movieCache.has(cacheKey)) {
        return movieCache.get(cacheKey);
    }

    try {
        const response = await fetch(`${API_BASE}?s=${encodeURIComponent(searchTerm)}&apikey=${API_KEY}`);
        const data = await response.json();
        
        if (data.Response === 'True' && data.Search && data.Search.length > 0) {
            const movie = data.Search[0];
            const detailResponse = await fetch(`${API_BASE}?i=${movie.imdbID}&apikey=${API_KEY}`);
            const detailData = await detailResponse.json();
            
            if (detailData.Response === 'True') {
                movieCache.set(cacheKey, detailData);
                return detailData;
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching movie:', error);
        return null;
    }
}

async function fetchMoviesForRow(searchTerms) {
    const movies = [];
    for (const term of searchTerms) {
        const movie = await fetchMovie(term);
        if (movie && movie.Poster && movie.Poster !== 'N/A') {
            movies.push(movie);
        }
        if (movies.length >= 10) break;
    }
    return movies;
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    if (movie.Poster && movie.Poster !== 'N/A') {
        const img = document.createElement('img');
        img.src = getHiResPosterUrl(movie.Poster);
        img.alt = movie.Title;
        img.loading = 'lazy';
        img.onerror = function() {
            card.innerHTML = `<div class="movie-card-placeholder">${movie.Title}</div>`;
        };
        card.appendChild(img);
    } else {
        card.innerHTML = `<div class="movie-card-placeholder">${movie.Title}</div>`;
    }
    
    card.addEventListener('click', () => setHeroMovie(movie));
    return card;
}

function setHeroMovie(movie) {
    const heroTitleText = document.getElementById('hero-title-text');
    const heroTitleHighlight = document.getElementById('hero-title-highlight');
    const heroPart = document.getElementById('hero-part');
    const heroRating = document.getElementById('hero-rating');
    const heroStreams = document.getElementById('hero-streams');
    const heroBackground = document.getElementById('hero-background');
    
    const badgeText = document.getElementById('hero-badge-text');
    if (badgeText) badgeText.textContent = (movie.Type || 'movie').toUpperCase() === 'SERIES' ? 'SERIES' : 'FILM';
    
    const title = movie.Title || 'Movie Title';
    const words = title.trim().split(/\s+/);
    if (words.length > 1) {
        heroTitleText.textContent = words.slice(0, -1).join(' ') + ' ';
        heroTitleHighlight.textContent = words[words.length - 1];
        heroTitleHighlight.style.display = 'inline-block';
    } else {
        heroTitleText.textContent = title;
        heroTitleHighlight.textContent = '';
        heroTitleHighlight.style.display = 'none';
    }
    heroPart.textContent = movie.Year ? `${movie.Year}` : '';
    heroRating.textContent = movie.imdbRating ? `${movie.imdbRating}/10` : '';
    heroStreams.textContent = movie.imdbVotes ? `${(parseInt(movie.imdbVotes) / 1000000).toFixed(1)}M votes` : '';
    
    if (movie.Poster && movie.Poster !== 'N/A') {
        heroBackground.style.backgroundImage = `url(${getHiResPosterUrl(movie.Poster)})`;
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function displayMoviesInRow(containerId, movies) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (movies.length === 0) {
        container.innerHTML = '<div class="error">No movies found</div>';
        return;
    }
    
    movies.forEach(movie => {
        container.appendChild(createMovieCard(movie));
    });
}

function scrollRow(containerId, direction) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const firstCard = container.querySelector('.movie-card');
    const cardWidth = firstCard ? firstCard.offsetWidth : 170;
    const gap = 8;
    const scrollAmount = Math.round((cardWidth + gap) * 3);
    container.scrollBy({
        left: scrollAmount * direction,
        behavior: 'smooth'
    });
}

async function init() {
    const heroMovie = await fetchMovie('money heist');
    if (heroMovie) {
        setHeroMovie(heroMovie);
    } else {
        const fallback = await fetchMovie('avengers');
        if (fallback) setHeroMovie(fallback);
    }

    try {
        for (const row of ROW_CONFIG) {
            const movies = await fetchMoviesForRow(row.searches);
            displayMoviesInRow(row.id, movies);
        }
    } catch (error) {
        console.error('Error loading movies:', error);
        document.querySelectorAll('.row-content').forEach(c => {
            if (c.innerHTML.includes('Loading')) {
                c.innerHTML = '<div class="error">Failed to load movies. Please try again later.</div>';
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
