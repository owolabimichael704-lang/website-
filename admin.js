const config = window.TOUCHLINE_SUPABASE_CONFIG || {};
const statusMessage = document.querySelector("#admin-status");
const loginPanel = document.querySelector("#login-panel");
const workspace = document.querySelector("#admin-workspace");
const loginForm = document.querySelector("#login-form");
const listingForm = document.querySelector("#listing-form");
const rowsContainer = document.querySelector("#admin-listing-rows");
const editorTitle = document.querySelector("#editor-title");
const existingImages = document.querySelector("#existing-images");
const deleteButton = document.querySelector("#delete-listing-button");
const signoutButton = document.querySelector("#signout-button");
const inventorySearch = document.querySelector("#admin-listing-search");
const inventoryStatus = document.querySelector("#admin-status-filter");
const newListingButton = document.querySelector("#new-listing-button");
let client = null;
let currentListings = [];
let currentImages = [];
let originalImages = [];
let isSaving = false;

function setEditorBusy(busy) {
	listingForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
		control.disabled = busy;
	});
	newListingButton.disabled = busy;
	rowsContainer.querySelectorAll("button").forEach((button) => {
		button.disabled = busy;
	});
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function normalizeWhatsAppNumber(value) {
	const digits = String(value).replace(/\D/g, "");
	if (digits.startsWith("00")) return digits.slice(2);
	if (digits.startsWith("0")) return `234${digits.slice(1)}`;
	return digits;
}

function setStatus(message, kind = "") {
	statusMessage.textContent = message;
	statusMessage.dataset.kind = kind;
}

function showLogin(message = "") {
	workspace.hidden = true;
	loginPanel.hidden = false;
	signoutButton.hidden = true;
	if (message) setStatus(message);
}

function showWorkspace() {
	loginPanel.hidden = true;
	workspace.hidden = false;
	signoutButton.hidden = false;
}

function resetEditor() {
	listingForm.reset();
	listingForm.elements.id.value = "";
	listingForm.elements.sort_order.value = "0";
	currentImages = [];
	originalImages = [];
	existingImages.innerHTML = "";
	editorTitle.textContent = "Add an account";
	deleteButton.hidden = true;
}

function renderExistingImages() {
	existingImages.innerHTML = currentImages.length
		? `<p class="admin-help">Current images (${currentImages.length})</p><div class="admin-image-list">${currentImages.map((url, index) => `<div class="admin-image-item"><img src="${escapeHtml(url)}" alt="Current account screenshot ${index + 1}"><button type="button" data-remove-image="${index}" aria-label="Remove screenshot ${index + 1}">Remove</button></div>`).join("")}</div>`
		: "";
}

function renderRows() {
	document.querySelector("#admin-listing-count").textContent = currentListings.length;
	const query = inventorySearch.value.trim().toLowerCase();
	const status = inventoryStatus.value;
	const filtered = currentListings.filter((listing) => {
		const matchesQuery = [listing.name, listing.platform, listing.status, listing.whatsapp_number].join(" ").toLowerCase().includes(query);
		return matchesQuery && (status === "all" || listing.status === status);
	});
	rowsContainer.innerHTML = filtered.length
		? filtered.map((listing) => `
			<article class="admin-listing-row">
				${listing.images?.[0] ? `<img src="${escapeHtml(listing.images[0])}" alt="">` : `<span class="admin-thumb-placeholder" aria-hidden="true">No image</span>`}
				<div class="admin-listing-info"><strong>${escapeHtml(listing.name)}</strong><span>${escapeHtml(listing.platform)} · ${escapeHtml(listing.currency)} ${Number(listing.price).toLocaleString()} · ${escapeHtml(listing.status)}</span></div>
				<button class="details-button" type="button" data-edit-id="${escapeHtml(listing.id)}">Edit</button>
			</article>`).join("")
		: `<p class="admin-empty">${currentListings.length ? "No listings match these filters." : "No listings yet. Add the first one using the form."}</p>`;
}

async function loadListings() {
	setStatus("Loading listings...");
	const { data, error } = await client.from("listings").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
	if (error) {
		setStatus(`Could not load listings: ${error.message}`, "error");
		return;
	}
	currentListings = data || [];
	renderRows();
	setStatus(`${currentListings.length} listing${currentListings.length === 1 ? "" : "s"} loaded.`, "success");
}

function editListing(id) {
	const listing = currentListings.find((item) => item.id === id);
	if (!listing) return;
	listingForm.elements.id.value = listing.id;
	listingForm.elements.name.value = listing.name;
	listingForm.elements.platform.value = listing.platform;
	listingForm.elements.rating.value = listing.rating;
	listingForm.elements.price.value = listing.price;
	listingForm.elements.currency.value = listing.currency;
	listingForm.elements.tag.value = listing.tag || "";
	listingForm.elements.condition.value = listing.condition || "";
	listingForm.elements.record.value = listing.record || "";
	listingForm.elements.players.value = (listing.players || []).join(", ");
	listingForm.elements.whatsapp_number.value = listing.whatsapp_number;
	listingForm.elements.description.value = listing.description || "";
	listingForm.elements.status.value = listing.status;
	listingForm.elements.sort_order.value = listing.sort_order || 0;
	listingForm.elements.images.value = "";
	currentImages = listing.images || [];
	originalImages = [...currentImages];
	renderExistingImages();
	editorTitle.textContent = `Edit ${listing.name}`;
	deleteButton.hidden = false;
	window.scrollTo({ top: 0, behavior: "smooth" });
}

function publicImagePath(url) {
	const marker = "/storage/v1/object/public/listing-images/";
	const index = url.indexOf(marker);
	return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

async function uploadImages(files, listingId) {
	const uploadedUrls = [];
	const uploadedPaths = [];
	try {
		for (const file of files) {
			if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
				throw new Error("Choose JPG, PNG, or WebP images no larger than 8 MB each.");
			}
			const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
			const path = `${listingId}/${crypto.randomUUID()}.${extension}`;
			const { error } = await client.storage.from("listing-images").upload(path, file, { contentType: file.type, upsert: false });
			if (error) throw error;
			uploadedPaths.push(path);
			uploadedUrls.push(client.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
		}
	} catch (error) {
		if (uploadedPaths.length) await client.storage.from("listing-images").remove(uploadedPaths);
		throw error;
	}
	return uploadedUrls;
}

async function verifyAdmin() {
	const { data: { session }, error: sessionError } = await client.auth.getSession();
	if (sessionError || !session) {
		showLogin();
		return false;
	}
	const { data, error } = await client.rpc("is_touchline_admin");
	if (error || !data) {
		await client.auth.signOut();
		showLogin("This user does not have admin access.");
		return false;
	}
	showWorkspace();
	await loadListings();
	return true;
}

if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
	showLogin("Configure the Supabase project URL and publishable key in supabase-config.js, then run supabase/schema.sql.");
} else {
	client = window.supabase.createClient(config.url, config.publishableKey);
	verifyAdmin();
}

loginForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!client) return;
	const formData = new FormData(loginForm);
	setStatus("Signing in...");
	const { error } = await client.auth.signInWithPassword({ email: formData.get("email"), password: formData.get("password") });
	if (error) {
		setStatus(`Sign-in failed: ${error.message}`, "error");
		return;
	}
	await verifyAdmin();
});

signoutButton.addEventListener("click", async () => {
	await client.auth.signOut();
	showLogin("You have signed out.");
});

newListingButton.addEventListener("click", resetEditor);
rowsContainer.addEventListener("click", (event) => {
	const button = event.target.closest("[data-edit-id]");
	if (button) editListing(button.dataset.editId);
});

inventorySearch.addEventListener("input", renderRows);
inventoryStatus.addEventListener("change", renderRows);
existingImages.addEventListener("click", (event) => {
	const button = event.target.closest("[data-remove-image]");
	if (!button) return;
	currentImages.splice(Number(button.dataset.removeImage), 1);
	renderExistingImages();
});

listingForm.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!client || isSaving) return;
	const values = new FormData(listingForm);
	const id = values.get("id") || crypto.randomUUID();
	const files = Array.from(values.getAll("images")).filter((value) => value instanceof File && value.size > 0);
	const previousImages = originalImages;
	if (values.get("status") === "active" && files.length === 0 && previousImages.length === 0) {
		setStatus("Add at least one account screenshot before publishing this listing.", "error");
		listingForm.elements.images.focus();
		return;
	}
	isSaving = true;
	setEditorBusy(true);
	let uploadedUrls = [];
	setStatus("Saving listing...");
	try {
		uploadedUrls = files.length ? await uploadImages(files, id) : [];
		const listingImages = files.length ? uploadedUrls : currentImages;
		const listing = {
			name: String(values.get("name")).trim(),
			platform: values.get("platform"),
			rating: Number(values.get("rating")),
			price: Number(values.get("price")),
			currency: values.get("currency"),
			tag: String(values.get("tag")).trim() || "Available",
			condition: String(values.get("condition")).trim() || "Account listing",
			record: String(values.get("record")).trim(),
			players: String(values.get("players")).split(",").map((player) => player.trim()).filter(Boolean),
			whatsapp_number: normalizeWhatsAppNumber(values.get("whatsapp_number")),
			description: String(values.get("description")).trim(),
			status: values.get("status"),
			sort_order: Number(values.get("sort_order")) || 0,
			images: listingImages
		};
		const result = values.get("id")
			? await client.from("listings").update(listing).eq("id", id).select().single()
			: await client.from("listings").insert({ id, ...listing }).select().single();
		if (result.error) throw result.error;
		const removedImages = previousImages.filter((image) => files.length || !listingImages.includes(image));
		let imageCleanupWarning = false;
		const oldPaths = removedImages.map(publicImagePath).filter(Boolean);
		if (oldPaths.length) {
			const { error } = await client.storage.from("listing-images").remove(oldPaths);
			imageCleanupWarning = Boolean(error);
		}
		resetEditor();
		await loadListings();
		setStatus(imageCleanupWarning ? "Listing saved, but old image files could not all be removed." : "Listing saved and market updated.", imageCleanupWarning ? "error" : "success");
	} catch (error) {
		const uploadedPaths = uploadedUrls.map(publicImagePath).filter(Boolean);
		if (uploadedPaths.length) await client.storage.from("listing-images").remove(uploadedPaths);
		setStatus(`Could not save listing: ${error.message}`, "error");
	} finally {
		isSaving = false;
		setEditorBusy(false);
	}
});

deleteButton.addEventListener("click", async () => {
	const id = listingForm.elements.id.value;
	const listing = currentListings.find((item) => item.id === id);
	if (!listing || isSaving || !window.confirm(`Delete ${listing.name}? This cannot be undone.`)) return;
	isSaving = true;
	setEditorBusy(true);
	setStatus("Deleting listing...");
	try {
		const { error } = await client.from("listings").delete().eq("id", id);
		if (error) throw error;
		const paths = (listing.images || []).map(publicImagePath).filter(Boolean);
		const cleanupResult = paths.length ? await client.storage.from("listing-images").remove(paths) : { error: null };
		resetEditor();
		await loadListings();
		setStatus(cleanupResult.error ? "Listing deleted, but some image files could not be removed." : "Listing deleted.", cleanupResult.error ? "error" : "success");
	} catch (error) {
		setStatus(`Could not delete listing: ${error.message}`, "error");
	} finally {
		isSaving = false;
		setEditorBusy(false);
	}
});
