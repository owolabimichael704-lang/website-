const accountImages = ["account1.jpg"];
const demoListings = [
	{ id: "northstar", name: "Northstar XI", platform: "PlayStation", rating: 3168, price: 145, tag: "Top rated", players: ["Messi", "Mbappé", "Bellingham"], description: "A high-tempo attack with a balanced, possession-ready midfield.", images: accountImages, record: "League-ready", condition: "Well-built squad" },
	{ id: "blueprint", name: "The Blueprint", platform: "Mobile", rating: 3094, price: 89, tag: "Great value", players: ["Neymar Jr", "Kane", "Rodri"], description: "A versatile lineup with options to change shape and tempo.", images: accountImages, record: "Flexible setup", condition: "Balanced squad" },
	{ id: "lastdance", name: "Last Dance", platform: "Xbox", rating: 3201, price: 175, tag: "Featured", players: ["Ronaldo", "Vinícius Jr", "De Bruyne"], description: "A deep roster built around explosive wide play and sharp finishing.", images: accountImages, record: "Attacking setup", condition: "Premium squad" },
	{ id: "greenroom", name: "The Green Room", platform: "PC", rating: 3012, price: 72, tag: "Entry pick", players: ["Salah", "Son", "Valverde"], description: "A lively starting point with a creative front line and room to grow.", images: accountImages, record: "Room to grow", condition: "Starter squad" },
	{ id: "nightshift", name: "Night Shift", platform: "PlayStation", rating: 3127, price: 119, tag: "Fan favorite", players: ["Lewandowski", "Foden", "Kimmich"], description: "A composed, technical squad for patient build-up and smart pressing.", images: accountImages, record: "Possession play", condition: "Well-built squad" },
	{ id: "dayone", name: "Day One Club", platform: "Mobile", rating: 2978, price: 58, tag: "Under $60", players: ["Griezmann", "Rashford", "Pedri"], description: "A budget-friendly roster with a strong core and exciting upside.", images: accountImages, record: "Smart budget", condition: "Starter squad" }
].map((listing) => ({ ...listing, isDemo: true }));
const config = window.TOUCHLINE_SUPABASE_CONFIG || {};
const supabaseClient = config.url && config.publishableKey && window.supabase?.createClient
	? window.supabase.createClient(config.url, config.publishableKey)
	: null;
let listings = supabaseClient ? [] : demoListings;

const listingGrid = document.querySelector("#listing-grid");
const searchInput = document.querySelector("#search-input");
const platformFilter = document.querySelector("#platform-filter");
const sortSelect = document.querySelector("#sort-select");
const emptyState = document.querySelector("#empty-state");
const modalBackdrop = document.querySelector("#modal-backdrop");
const dialog = document.querySelector("#dialog");
const dialogContent = document.querySelector("#dialog-content");
const shortlist = new Set();
const ownerWhatsAppNumber = "2347042588980";
let lastFocusedElement = null;

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function createWhatsAppUrl(chosen, isShortlist = false) {
	const summary = chosen.map((listing) => `- ${listing.name} | ${listing.platform} | Squad rating ${listing.rating.toLocaleString()} | ${formatPrice(listing)}`).join("\n");
	const opening = isShortlist ? "Hello, I'm interested in these eFootball accounts:" : "Hello, I'm interested in this eFootball account:";
	const message = `${opening}\n${summary}\n\nCould you please confirm availability and share more details?`;
	const recipients = [...new Set(chosen.map((listing) => normalizeWhatsAppNumber(listing.whatsapp_number || ownerWhatsAppNumber)))];
	const phone = recipients.length === 1 ? recipients[0] : ownerWhatsAppNumber;
	return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeWhatsAppNumber(value) {
	const digits = String(value).replace(/\D/g, "");
	if (digits.startsWith("00")) return digits.slice(2);
	if (digits.startsWith("0")) return `234${digits.slice(1)}`;
	return digits;
}

function formatPrice(listing) {
	return new Intl.NumberFormat("en", { style: "currency", currency: listing.currency || "USD", maximumFractionDigits: 2 }).format(Number(listing.price));
}

function formatListingUpdate(listing) {
	if (listing.isDemo) return "Sample listing";
	if (!listing.updated_at) return "Update time unavailable";
	const date = new Date(listing.updated_at);
	return Number.isNaN(date.getTime()) ? "Update time unavailable" : `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)}`;
}

function setMarketStatus(message, kind = "") {
	const status = document.querySelector("#market-status");
	if (!status) return;
	status.textContent = message;
	status.dataset.kind = kind;
	status.hidden = !message;
}

async function loadLiveListings() {
	const { data, error } = await supabaseClient.from("listings").select("*").eq("status", "active").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
	if (error) {
		listings = [];
		renderListings();
		setMarketStatus(`Live listings could not be loaded: ${error.message}`, "error");
		return;
	}
	listings = (data || []).map((listing) => ({ ...listing, images: listing.images || [], players: listing.players || [], isDemo: false }));
	renderListings();
	document.querySelector("#market-note").textContent = "Listings and images are provided by sellers and are not independently verified. This site does not process payments or guarantee transfers. Account transfers may be restricted by the game's terms and can carry a risk of losing access; check applicable rules and confirm details before proceeding.";
	setMarketStatus("Listings are live and update automatically.", "success");
}

function getFilteredListings() {
	const query = searchInput.value.trim().toLowerCase();
	const platform = platformFilter.value;
	const filtered = listings.filter((listing) => {
		const searchable = [listing.name, listing.platform, listing.players.join(" "), listing.description, listing.tag].join(" ").toLowerCase();
		return (platform === "all" || listing.platform === platform) && (!query || searchable.includes(query));
	});
	if (sortSelect.value === "price-low") filtered.sort((left, right) => left.price - right.price);
	if (sortSelect.value === "price-high") filtered.sort((left, right) => right.price - left.price);
	if (sortSelect.value === "rating") filtered.sort((left, right) => right.rating - left.rating);
	return filtered;
}

function renderListings() {
	const filtered = getFilteredListings();
	document.querySelector("#result-count").textContent = filtered.length;
	listingGrid.innerHTML = filtered.map((listing, index) => `
		<article class="listing-card" style="animation-delay:${Math.min(index * 55, 220)}ms">
			<div class="card-image">
				<div class="card-image-track" aria-label="${listing.isDemo ? "Sample " : ""}account squad image for ${escapeHtml(listing.name)}">
					${listing.images.map((image) => `<button class="image-preview-trigger" type="button" data-action="preview" data-id="${listing.id}" aria-label="View account image for ${escapeHtml(listing.name)}"><img src="${image}" alt="${listing.isDemo ? "Sample " : ""}eFootball account squad lineup" loading="lazy"></button>`).join("")}
				</div>
				<span class="card-tag">${escapeHtml(listing.tag)}</span>
				<button class="favorite-button" type="button" data-action="toggle" data-id="${listing.id}" aria-label="${shortlist.has(listing.id) ? "Remove" : "Add"} ${escapeHtml(listing.name)} ${shortlist.has(listing.id) ? "from" : "to"} shortlist" aria-pressed="${shortlist.has(listing.id)}">${shortlist.has(listing.id) ? "♥" : "♡"}</button>
				<span class="card-rating"><span>★</span>${listing.rating.toLocaleString()} squad rating</span>
			</div>
			<div class="card-body">
				<div class="card-kicker"><span>${escapeHtml(listing.platform)}</span><span>${escapeHtml(listing.condition)}</span></div>
				<h3>${escapeHtml(listing.name)}</h3>
				<p class="card-description">${escapeHtml(listing.description)}</p>
				<div class="player-list">${listing.players.map((player) => `<span class="player-chip">${escapeHtml(player)}</span>`).join("")}</div>
				<div class="card-footer">
					<div><span class="price-label">ASKING PRICE</span><strong class="card-price">${formatPrice(listing)}</strong></div>
					<div class="card-actions">
						<button class="details-button" type="button" data-action="details" data-id="${listing.id}">Details</button>
						<a class="whatsapp-button" href="${createWhatsAppUrl([listing])}" target="_blank" rel="noopener noreferrer" aria-label="Message the owner about ${escapeHtml(listing.name)} on WhatsApp">WhatsApp <span aria-hidden="true">↗</span></a>
					</div>
				</div>
			</div>
		</article>`).join("");
	emptyState.hidden = filtered.length > 0;
	listingGrid.hidden = filtered.length === 0;
	updateShortlistCount();
}

function updateShortlistCount() {
	const count = shortlist.size;
	document.querySelector("#shortlist-count").textContent = count;
	document.querySelector("#bar-count").textContent = count;
	document.querySelector("#bar-label").textContent = count === 1 ? "account shortlisted" : "accounts shortlisted";
	document.querySelector("#shortlist-bar").hidden = count === 0;
}

function showDialog(content) {
	lastFocusedElement = document.activeElement;
	dialogContent.innerHTML = content;
	modalBackdrop.hidden = false;
	document.body.style.overflow = "hidden";
	dialog.focus();
}

function closeDialog() {
	modalBackdrop.hidden = true;
	document.body.style.overflow = "";
	dialogContent.innerHTML = "";
	dialog.classList.remove("image-preview-dialog");
	if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
}

function renderImagePreview(listing, imageIndex = 0) {
	if (!listing) return;
	const index = ((imageIndex % listing.images.length) + listing.images.length) % listing.images.length;
	dialog.classList.add("image-preview-dialog");
	const imageDescription = `${listing.isDemo ? "Sample " : ""}eFootball account squad lineup for ${escapeHtml(listing.name)}`;
	const imageCaption = listing.isDemo ? "Sample squad image" : "Seller-provided screenshot";
	showDialog(`<h2 id="dialog-title" class="sr-only">${escapeHtml(listing.name)} account image</h2><div class="image-preview-viewer">${listing.images.length > 1 ? `<button class="image-preview-nav image-preview-previous" type="button" data-action="image-step" data-step="-1" aria-label="Previous image">‹</button>` : ""}<img class="image-preview-full" src="${escapeHtml(listing.images[index])}" alt="${imageDescription}">${listing.images.length > 1 ? `<button class="image-preview-nav image-preview-next" type="button" data-action="image-step" data-step="1" aria-label="Next image">›</button>` : ""}</div><p class="image-preview-caption">${escapeHtml(listing.name)} · ${imageCaption} · ${index + 1} of ${listing.images.length}</p>`);
	dialog.dataset.previewListingId = listing.id;
	dialog.dataset.previewIndex = String(index);
}

function renderDetails(id) {
	const listing = listings.find((item) => item.id === id);
	if (!listing) return;
	const images = listing.images || [];
	showDialog(`
		<p class="eyebrow eyebrow-dark">LISTING DETAILS <span class="heading-line"></span></p>
		<h2 id="dialog-title">${escapeHtml(listing.name)}<em>.</em></h2>
		<div class="detail-hero"><div class="detail-image-track" aria-label="${listing.isDemo ? "Sample " : ""}account squad images for ${escapeHtml(listing.name)}">${images.map((image, index) => `<button class="image-preview-trigger" type="button" data-action="preview" data-id="${escapeHtml(listing.id)}" data-image-index="${index}" aria-label="View image ${index + 1} for ${escapeHtml(listing.name)}"><img src="${escapeHtml(image)}" alt="${listing.isDemo ? "Sample " : "Seller-provided "}eFootball account squad lineup" loading="lazy"></button>`).join("") || `<p class="detail-no-image">No account images provided.</p>`}</div><span class="detail-score">★ ${listing.rating.toLocaleString()} SQUAD RATING</span></div>
		<p class="dialog-lede">${escapeHtml(listing.description)}</p>
		<div class="detail-metrics"><div><span>Platform</span><strong>${escapeHtml(listing.platform)}</strong></div><div><span>Squad type</span><strong>${escapeHtml(listing.condition)}</strong></div><div><span>Profile</span><strong>${escapeHtml(listing.record)}</strong></div></div>
		<p class="eyebrow eyebrow-dark">STANDOUT PLAYERS</p>
		<div class="detail-players">${listing.players.map((player) => `<span class="player-chip">${escapeHtml(player)}</span>`).join("")}</div>
		<div class="detail-actions"><div><span class="price-label">ASKING PRICE</span><strong>${formatPrice(listing)}</strong></div><a class="button button-lime" href="${createWhatsAppUrl([listing])}" target="_blank" rel="noopener noreferrer">Message owner on WhatsApp <span aria-hidden="true">↗</span></a></div>
		<p class="listing-updated">${escapeHtml(formatListingUpdate(listing))} · ${listing.isDemo ? "Example content, not a verified offer" : "Images and details supplied by the seller"}</p>
		<p class="small-print">This site does not process payments or verify ownership. Account transfers may be restricted by the game's terms and can carry a risk of losing access. Confirm details and applicable rules with care; never share passwords or verification codes.</p>`);
}

function renderShortlist() {
	const chosen = listings.filter((listing) => shortlist.has(listing.id));
	const total = chosen.reduce((sum, listing) => sum + Number(listing.price), 0);
	const currencies = new Set(chosen.map((listing) => listing.currency || "USD"));
	const sellerGroups = [...chosen.reduce((groups, listing) => {
		const phone = listing.whatsapp_number || ownerWhatsAppNumber;
		if (!groups.has(phone)) groups.set(phone, []);
		groups.get(phone).push(listing);
		return groups;
	}, new Map()).values()];
	const items = chosen.map((listing) => `
		<div class="shortlist-item"><img src="${listing.images[0]}" alt=""><div><strong>${escapeHtml(listing.name)}</strong><span>${escapeHtml(listing.platform)} · ${listing.rating.toLocaleString()} rating</span></div><b>${formatPrice(listing)}</b><button class="remove-item" type="button" data-action="remove" data-id="${listing.id}" aria-label="Remove ${escapeHtml(listing.name)} from shortlist">×</button></div>`).join("");
	const sellerLinks = sellerGroups.map((group) => `<a class="button button-lime" href="${createWhatsAppUrl(group, true)}" target="_blank" rel="noopener noreferrer">Message seller about ${group.length} ${group.length === 1 ? "account" : "accounts"} <span aria-hidden="true">↗</span></a>`).join("");
	showDialog(`
		<p class="eyebrow eyebrow-dark">YOUR SAVED SQUADS <span class="heading-line"></span></p>
		<h2 id="dialog-title">The shortlist<em>.</em></h2>
		${chosen.length ? `<div class="shortlist-items">${items}</div>${currencies.size === 1 ? `<div class="shortlist-total"><span>Combined asking prices</span><strong>${formatPrice({ price: total, currency: chosen[0].currency || "USD" })}</strong></div>` : `<p class="shortlist-currency-note">Your shortlist includes multiple currencies; compare each asking price separately.</p>`}<div class="shortlist-contact-links">${sellerLinks}</div><p class="small-print">Each message opens a WhatsApp conversation with that listing's seller. No payment is processed on this site.</p>` : `<p class="shortlist-empty">Nothing saved just yet. Browse the market and tap the heart on any squad to keep it here.</p><a class="button button-dark" href="#market" data-action="close-and-browse">Browse accounts <span aria-hidden="true">↘</span></a>`}`);
}

function toggleShortlist(id) {
	if (shortlist.has(id)) shortlist.delete(id);
	else shortlist.add(id);
	renderListings();
	if (!modalBackdrop.hidden && dialogContent.querySelector(".shortlist-items, .shortlist-empty")) renderShortlist();
}

if (listingGrid) {
listingGrid.addEventListener("click", (event) => {
	const button = event.target.closest("[data-action]");
	if (!button) return;
	if (button.dataset.action === "toggle") toggleShortlist(button.dataset.id);
	if (button.dataset.action === "details") renderDetails(button.dataset.id);
	if (button.dataset.action === "preview") renderImagePreview(listings.find((listing) => listing.id === button.dataset.id), Number(button.dataset.imageIndex || 0));
});

dialogContent.addEventListener("click", (event) => {
	const button = event.target.closest("[data-action]");
	if (!button) return;
	if (button.dataset.action === "remove") toggleShortlist(button.dataset.id);
	if (button.dataset.action === "close-and-browse") closeDialog();
	if (button.dataset.action === "preview") renderImagePreview(listings.find((listing) => listing.id === button.dataset.id), Number(button.dataset.imageIndex || 0));
	if (button.dataset.action === "image-step") {
		const listing = listings.find((item) => item.id === dialog.dataset.previewListingId);
		if (listing) renderImagePreview(listing, Number(dialog.dataset.previewIndex) + Number(button.dataset.step));
	}
});

document.querySelector("#shortlist-open").addEventListener("click", renderShortlist);
document.querySelector("#bar-review").addEventListener("click", renderShortlist);
document.querySelector("#dialog-close").addEventListener("click", closeDialog);
modalBackdrop.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeDialog(); });
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && !modalBackdrop.hidden) closeDialog();
	if (event.key === "/" && modalBackdrop.hidden && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
		event.preventDefault();
		searchInput.focus();
	}
});

searchInput.addEventListener("input", renderListings);
platformFilter.addEventListener("change", renderListings);
sortSelect.addEventListener("change", renderListings);

function resetFilters() {
	searchInput.value = "";
	platformFilter.value = "all";
	sortSelect.value = "featured";
	renderListings();
}
document.querySelector("#reset-filters").addEventListener("click", resetFilters);
document.querySelector("#empty-reset").addEventListener("click", resetFilters);
renderListings();
if (supabaseClient) {
	setMarketStatus("Connecting to live listings...");
	loadLiveListings();
	supabaseClient.channel("live-listings").on("postgres_changes", { event: "*", schema: "public", table: "listings" }, loadLiveListings).subscribe();
} else {
	setMarketStatus("Demo listings are shown. Configure Supabase to publish live listings.", "demo");
}
}

const menuToggle = document.querySelector("#menu-toggle");
const mainNav = document.querySelector("#main-nav");
menuToggle.addEventListener("click", () => {
	const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
	menuToggle.setAttribute("aria-expanded", String(!isOpen));
	menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
	mainNav.classList.toggle("is-open", !isOpen);
});
mainNav.addEventListener("click", (event) => {
	if (event.target.closest("a")) {
		mainNav.classList.remove("is-open");
		menuToggle.setAttribute("aria-expanded", "false");
		menuToggle.setAttribute("aria-label", "Open navigation");
	}
});
