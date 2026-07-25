// State Management
let allProducts = [];
let filteredProducts = [];
let currentCategory = 'ALL';
let currentFilter = 'all';
let selectedProductIds = new Set();
let candidateMap = {};
let selectedImageMap = {};

let activeItemForModal = null;
let activeModalCandidate = null;

// Cloudinary Configuration State
let cloudinaryConfig = {
    cloudName: localStorage.getItem('avani_cloud_name') || '',
    uploadPreset: localStorage.getItem('avani_upload_preset') || '',
    apiKey: localStorage.getItem('avani_api_key') || '',
    apiSecret: localStorage.getItem('avani_api_secret') || ''
};

// DOM may already be ready since this script is at the bottom of <body>
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { console.log('[Avani] DOMContentLoaded fired'); initApp(); });
} else {
    console.log('[Avani] DOM already ready, calling initApp() directly');
    initApp();
}

async function initApp() {
    console.log('[Avani] initApp() starting...');
    updateCloudinaryStatusUI();
    setupEventListeners();
    await fetchProductsFromSupabase();
}

/**
 * Build an image URL that will actually load in the browser.
 * - Unsplash / Wikimedia / known CDNs → load directly (no CORS issues)
 * - Everything else → route through wsrv.nl (free open-source image proxy)
 *   or fall back to local /api/proxy-image
 */
function getDisplayUrl(url) {
    if (!url) return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#151c2c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="14">No Image</text></svg>');

    // These domains allow direct hotlinking — no proxy needed
    const directDomains = ['images.unsplash.com', 'source.unsplash.com', 'upload.wikimedia.org', 'commons.wikimedia.org'];
    try {
        const hostname = new URL(url).hostname;
        if (directDomains.some(d => hostname.endsWith(d))) {
            return url;
        }
    } catch (e) { /* not a valid URL, proxy it */ }

    // Use wsrv.nl — a free, fast, open-source image proxy (https://github.com/weserv/images)
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=80&default=1`;
}

function updateCloudinaryStatusUI() {
    const textEl = document.getElementById('cloudinary-status-text');
    if (cloudinaryConfig.cloudName && (cloudinaryConfig.uploadPreset || cloudinaryConfig.apiKey)) {
        textEl.textContent = `Active (${cloudinaryConfig.cloudName})`;
        textEl.style.color = '#10b981';
    } else {
        textEl.textContent = 'Not Configured (Direct Supabase)';
        textEl.style.color = '#9ca3af';
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            updateFolderView();
        });
    });

    document.getElementById('search-input').addEventListener('input', () => applyFilters());

    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.dataset.filter;
            applyFilters();
        });
    });
}

async function fetchProductsFromSupabase() {
    showToast('Connecting to Supabase...', 'info');
    console.log('[Avani] Fetching products from /api/items...');
    try {
        const resp = await fetch('/api/items');
        const data = await resp.json();
        console.log('[Avani] API response:', data.success, 'count:', data.count);
        if (data.success) {
            allProducts = data.items;
            console.log('[Avani] First item:', allProducts[0]?.name, 'image_url:', allProducts[0]?.image_url);
            console.log('[Avani] getDisplayUrl result:', getDisplayUrl(allProducts[0]?.image_url));
            updateCategoryCounts();
            applyFilters();
            showToast(`Loaded ${allProducts.length} marketplace items`, 'success');
        } else {
            showToast('Failed to fetch: ' + data.error, 'error');
            console.error('[Avani] Fetch failed:', data.error);
        }
    } catch (err) {
        showToast('Server connection error — is server.py running?', 'error');
        console.error('[Avani] Fetch error:', err);
    }
}

function updateCategoryCounts() {
    const counts = { ALL: allProducts.length, Seeds: 0, Fertilizer: 0, Tools: 0, Pesticides: 0, Other: 0 };
    allProducts.forEach(p => {
        if (counts.hasOwnProperty(p.category)) counts[p.category]++;
        else counts.Other++;
    });
    document.getElementById('count-all').textContent = counts.ALL;
    document.getElementById('count-seeds').textContent = counts.Seeds;
    document.getElementById('count-fertilizer').textContent = counts.Fertilizer;
    document.getElementById('count-tools').textContent = counts.Tools;
    document.getElementById('count-pesticides').textContent = counts.Pesticides;
    document.getElementById('count-other').textContent = counts.Other;
}

function updateFolderView() {
    const titleEl = document.getElementById('current-folder-title');
    const subtitleEl = document.getElementById('current-folder-subtitle');
    if (currentCategory === 'ALL') {
        titleEl.textContent = 'All Marketplace Products';
        subtitleEl.textContent = `Showing all ${allProducts.length} items across categories`;
    } else {
        titleEl.textContent = `${currentCategory} Drive Folder`;
        const count = allProducts.filter(p => p.category === currentCategory).length;
        subtitleEl.textContent = `Showing ${count} items in ${currentCategory}`;
    }
    applyFilters();
}

function applyFilters() {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    filteredProducts = allProducts.filter(p => {
        const matchCat = currentCategory === 'ALL' ||
            (currentCategory === 'Other' ? !['Seeds','Fertilizer','Tools','Pesticides'].includes(p.category) : p.category === currentCategory);
        const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
        let matchPill = true;
        if (currentFilter === 'customized') matchPill = !!selectedImageMap[p.id];
        else if (currentFilter === 'pending') matchPill = !selectedImageMap[p.id];
        return matchCat && matchSearch && matchPill;
    });
    renderGrid();
}

function renderGrid() {
    const grid = document.getElementById('drive-grid');
    grid.innerHTML = '';

    if (filteredProducts.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-dim)">
            <i class="fa-solid fa-folder-open" style="font-size:48px;margin-bottom:12px"></i>
            <p>No products found.</p></div>`;
        return;
    }

    filteredProducts.forEach((product, idx) => {
        const isSelected = selectedProductIds.has(product.id);
        const rawUrl = selectedImageMap[product.id] || product.image_url;
        const isArray = Array.isArray(rawUrl);
        const primaryUrl = isArray ? rawUrl[0] : rawUrl;
        const selectedCount = isArray ? rawUrl.length : (selectedImageMap[product.id] ? 1 : 0);
        const imgSrc = getDisplayUrl(primaryUrl);
        const candidatesCount = candidateMap[product.id] ? candidateMap[product.id].length : 0;

        if (idx < 2) console.log(`[Avani] Card #${idx}: "${product.name}" rawUrl="${primaryUrl}" → imgSrc="${imgSrc}"`);

        // Escape HTML to prevent broken rendering from special chars in product names
        const safeName = escapeHtml(product.name);
        const safeId = escapeHtml(product.id);
        const safeAlt = escapeHtml(product.name);

        const card = document.createElement('div');
        card.className = `product-card${isSelected ? ' selected' : ''}`;
        card.id = `card-${product.id}`;
        card.style.cssText = 'min-height:280px;background:#151c2c;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #243049;position:relative;';

        const candidateBadge = selectedCount > 1
            ? `<span style="position:absolute;top:8px;right:8px;background:#10b981;color:white;font-size:11px;padding:3px 8px;border-radius:12px;font-weight:600;z-index:5;">✓ ${selectedCount} Selected</span>`
            : (candidatesCount > 0
                ? `<span style="position:absolute;top:8px;right:8px;background:#7c3aed;color:white;font-size:11px;padding:2px 8px;border-radius:12px;z-index:5;">🕷 ${candidatesCount}</span>`
                : '');

        card.innerHTML = `
            <input type="checkbox" style="position:absolute;top:10px;left:10px;z-index:5;width:18px;height:18px;accent-color:#10b981;" ${isSelected ? 'checked' : ''}
                   data-product-id="${safeId}">
            <div style="height:170px;background:#0d121d;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                <img src="${imgSrc}" alt="${safeAlt}" loading="lazy" referrerpolicy="no-referrer"
                     style="width:100%;height:100%;object-fit:cover;"
                     onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">
                <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;color:#6b7280;font-size:13px;flex-direction:column;position:absolute;top:0;left:0;">
                    <span style="font-size:32px;margin-bottom:4px;">🖼</span>
                    <span>Image loading...</span>
                </div>
                <span style="position:absolute;bottom:8px;left:8px;background:rgba(16,185,129,0.15);color:#10b981;font-size:11px;padding:3px 10px;border-radius:8px;font-weight:600;">${escapeHtml(product.category)}</span>
                ${candidateBadge}
            </div>
            <div style="padding:14px 16px;flex:1;display:flex;flex-direction:column;gap:8px;">
                <div style="color:#e2e8f0;font-weight:600;font-size:14px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#10b981;font-weight:700;font-size:15px;">Rs. ${product.price}</span>
                    <span style="color:#9ca3af;font-size:12px;">${escapeHtml(product.unit || 'Pack')}</span>
                </div>
                <button style="width:100%;padding:8px 12px;border:1px solid #243049;border-radius:8px;background:transparent;color:#e2e8f0;cursor:pointer;font-size:13px;margin-top:auto;"
                        data-action="scrape" data-product-id="${safeId}">
                    ✨ ${candidatesCount > 0 ? 'Choose Image' : 'Scrape Images'}
                </button>
            </div>`;

        // Use event delegation instead of inline handlers (safer with special characters)
        card.querySelector('input[type="checkbox"]').addEventListener('change', function() {
            toggleItemSelect(product.id, this.checked);
        });
        card.querySelector('button[data-action="scrape"]').addEventListener('click', function() {
            openCandidateModalForProduct(product.id);
        });

        grid.appendChild(card);
    });
    updateSelectedCounter();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function toggleItemSelect(productId, checked) {
    checked ? selectedProductIds.add(productId) : selectedProductIds.delete(productId);
    const card = document.getElementById(`card-${productId}`);
    if (card) card.classList.toggle('selected', checked);
    updateSelectedCounter();
}

function toggleSelectAll(checked) {
    filteredProducts.forEach(p => checked ? selectedProductIds.add(p.id) : selectedProductIds.delete(p.id));
    renderGrid();
}

function updateSelectedCounter() {
    document.getElementById('selected-counter').textContent = selectedProductIds.size;
}

let activeModalCandidates = new Set();

// ─── Scraper Modal ───────────────────────────────────────────

async function openCandidateModalForProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    activeItemForModal = product;
    activeModalCandidates = new Set();

    // If images already selected for this product, pre-populate activeModalCandidates
    const existing = selectedImageMap[productId];
    if (existing) {
        if (Array.isArray(existing)) {
            existing.forEach(u => activeModalCandidates.add(u));
        } else {
            activeModalCandidates.add(existing);
        }
    }

    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-category').textContent = product.category;
    document.getElementById('modal-product-desc').textContent = product.description || 'No description.';
    document.getElementById('candidate-modal').classList.add('active');

    if (candidateMap[productId] && candidateMap[productId].length > 0) {
        renderCandidatesInModal(candidateMap[productId]);
    } else {
        await scrapeCandidatesForProduct(product);
    }
}

async function scrapeCandidatesForProduct(product) {
    const grid = document.getElementById('candidate-grid');
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;margin-bottom:12px;color:var(--primary-emerald)"></i>
        <p>Scraping live images for <strong>${escapeHtml(product.name)}</strong>…</p></div>`;

    try {
        const resp = await fetch('/api/scrape-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: product.name, category: product.category, description: product.description })
        });
        const data = await resp.json();
        if (data.success && data.candidates.length > 0) {
            candidateMap[product.id] = data.candidates;
            // By default, auto-select the first candidate if none selected
            if (activeModalCandidates.size === 0 && data.candidates.length > 0) {
                activeModalCandidates.add(data.candidates[0].url);
            }
            renderCandidatesInModal(data.candidates);
            renderGrid();
        } else {
            grid.innerHTML = `<p style="color:var(--text-dim);text-align:center;grid-column:1/-1">No candidates found. Click Re-scrape.</p>`;
        }
    } catch (err) {
        grid.innerHTML = `<p style="color:#ef4444;text-align:center;grid-column:1/-1">Error: ${err.message}</p>`;
    }
}

function renderCandidatesInModal(candidates) {
    const grid = document.getElementById('candidate-grid');
    grid.innerHTML = '';

    const countEl = document.getElementById('modal-selected-count');
    if (countEl) countEl.textContent = activeModalCandidates.size;

    candidates.forEach(cand => {
        const isSelected = activeModalCandidates.has(cand.url);
        const el = document.createElement('div');
        el.className = 'candidate-item' + (isSelected ? ' selected' : '');
        el.style.position = 'relative';
        el.innerHTML = `
            <img src="${getDisplayUrl(cand.thumbnail || cand.url)}" alt="${escapeHtml(cand.title)}" referrerpolicy="no-referrer"
                 onerror="this.onerror=null;this.src=getDisplayUrl(null)">
            <span class="source-badge">${escapeHtml(cand.source)}</span>
            <div style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:${isSelected ? '#10b981' : 'rgba(0,0,0,0.5)'};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;border:1px solid white;">
                ${isSelected ? '✓' : ''}
            </div>`;

        el.addEventListener('click', () => {
            if (activeModalCandidates.has(cand.url)) {
                activeModalCandidates.delete(cand.url);
            } else {
                activeModalCandidates.add(cand.url);
            }
            renderCandidatesInModal(candidates);
        });
        grid.appendChild(el);
    });
}

function selectAllCandidatesInModal() {
    if (!activeItemForModal || !candidateMap[activeItemForModal.id]) return;
    const cands = candidateMap[activeItemForModal.id];
    const allSelected = cands.every(c => activeModalCandidates.has(c.url));
    if (allSelected) {
        activeModalCandidates.clear();
    } else {
        cands.forEach(c => activeModalCandidates.add(c.url));
    }
    renderCandidatesInModal(cands);
}

function confirmCandidateSelection() {
    if (!activeItemForModal || activeModalCandidates.size === 0) {
        showToast('Please select at least one image candidate.', 'info');
        return;
    }
    const selArray = Array.from(activeModalCandidates);
    selectedImageMap[activeItemForModal.id] = selArray.length === 1 ? selArray[0] : selArray;
    selectedProductIds.add(activeItemForModal.id);
    showToast(`Selected ${selArray.length} image(s) for ${activeItemForModal.name}`, 'success');
    closeCandidateModal();
    renderGrid();
}

function closeCandidateModal() {
    document.getElementById('candidate-modal').classList.remove('active');
}

async function rescrapeCurrentItem() {
    if (activeItemForModal) await scrapeCandidatesForProduct(activeItemForModal);
}

// ─── Batch Scraping (ALL 75 Products in Chunks) ──────────────

async function triggerBatchScrape() {
    const itemsToScrape = filteredProducts.length > 0 ? filteredProducts : allProducts;
    if (itemsToScrape.length === 0) {
        showToast('No products available to scrape.', 'info');
        return;
    }

    showToast(`Starting batch scrape for ALL ${itemsToScrape.length} products...`, 'info');

    const chunkSize = 15;
    let totalScraped = 0;

    for (let i = 0; i < itemsToScrape.length; i += chunkSize) {
        const chunk = itemsToScrape.slice(i, i + chunkSize);
        const batchNum = Math.floor(i / chunkSize) + 1;
        const totalBatches = Math.ceil(itemsToScrape.length / chunkSize);

        showToast(`Scraping batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + chunkSize, itemsToScrape.length)} of ${itemsToScrape.length})...`, 'info');

        try {
            const resp = await fetch('/api/scrape-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: chunk })
            });
            const data = await resp.json();
            if (data.success) {
                Object.assign(candidateMap, data.results);
                for (const [id, cands] of Object.entries(data.results)) {
                    if (cands && cands.length > 0) {
                        selectedImageMap[id] = cands[0].url;
                        selectedProductIds.add(id);
                    }
                }
                totalScraped += Object.keys(data.results).length;
                renderGrid();
            }
        } catch (err) {
            console.error('Batch error:', err);
        }
    }

    showToast(`Completed scraping imagery for ALL ${totalScraped} products!`, 'success');
}

// ─── Cloudinary Config ───────────────────────────────────────

function openCloudinaryModal() {
    document.getElementById('cfg-cloud-name').value = cloudinaryConfig.cloudName;
    document.getElementById('cfg-upload-preset').value = cloudinaryConfig.uploadPreset;
    document.getElementById('cfg-api-key').value = cloudinaryConfig.apiKey;
    document.getElementById('cfg-api-secret').value = cloudinaryConfig.apiSecret;
    document.getElementById('cloudinary-modal').classList.add('active');
}

function closeCloudinaryModal() {
    document.getElementById('cloudinary-modal').classList.remove('active');
}

function saveCloudinaryConfig() {
    cloudinaryConfig.cloudName = document.getElementById('cfg-cloud-name').value.trim();
    cloudinaryConfig.uploadPreset = document.getElementById('cfg-upload-preset').value.trim();
    cloudinaryConfig.apiKey = document.getElementById('cfg-api-key').value.trim();
    cloudinaryConfig.apiSecret = document.getElementById('cfg-api-secret').value.trim();
    localStorage.setItem('avani_cloud_name', cloudinaryConfig.cloudName);
    localStorage.setItem('avani_upload_preset', cloudinaryConfig.uploadPreset);
    localStorage.setItem('avani_api_key', cloudinaryConfig.apiKey);
    localStorage.setItem('avani_api_secret', cloudinaryConfig.apiSecret);
    updateCloudinaryStatusUI();
    closeCloudinaryModal();
    showToast('Cloudinary settings saved!', 'success');
}

// ─── Submit & Sync ───────────────────────────────────────────

async function submitSelectedImages() {
    if (selectedProductIds.size === 0) {
        showToast('Select at least one product first.', 'info');
        return;
    }
    const selections = [];
    selectedProductIds.forEach(id => {
        const prod = allProducts.find(p => p.id === id);
        const url = selectedImageMap[id] || (prod ? prod.image_url : null);
        if (prod && url) selections.push({ id: prod.id, name: prod.name, category: prod.category, image_url: url });
    });

    showToast(`Uploading ${selections.length} items…`, 'info');
    document.getElementById('btn-submit-all').disabled = true;
    try {
        const resp = await fetch('/api/submit-selections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selections, cloud_name: cloudinaryConfig.cloudName,
                api_key: cloudinaryConfig.apiKey, api_secret: cloudinaryConfig.apiSecret,
                upload_preset: cloudinaryConfig.uploadPreset
            })
        });
        const data = await resp.json();
        if (data.success) {
            showToast(`Updated ${data.updated_count} items in Supabase!`, 'success');
            await fetchProductsFromSupabase();
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Submit failed: ' + err.message, 'error');
    } finally {
        document.getElementById('btn-submit-all').disabled = false;
    }
}

// ─── Toast ───────────────────────────────────────────────────

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-triangle-exclamation' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
