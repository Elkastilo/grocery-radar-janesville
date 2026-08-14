const categories = [
  "meat",
  "dairy",
  "produce",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "bakery",
  "household",
  "personal care",
  "baby",
  "pet",
  "other"
];

const productStatuses = [
  "active",
  "needs_review",
  "hidden",
  "merged"
];

const pinForm = document.querySelector("#adminPinForm");
const pinInput = document.querySelector("#adminPin");
const adminNotifications = document.querySelector("#adminNotifications");
const betaReadinessGenerated = document.querySelector("#betaReadinessGenerated");
const betaReadinessSummary = document.querySelector("#betaReadinessSummary");
const phoneTestingCard = document.querySelector("#phoneTestingCard");
const betaChecklist = document.querySelector("#betaChecklist");
const analyticsSummary = document.querySelector("#analyticsSummary");
const analyticsContent = document.querySelector("#analyticsContent");
const sponsorForm = document.querySelector("#sponsorForm");
const sponsorMessage = document.querySelector("#sponsorMessage");
const sponsorsContent = document.querySelector("#sponsorsContent");
const reviewReports = document.querySelector("#reviewReports");
const approvedReports = document.querySelector("#approvedReports");
const historyReports = document.querySelector("#historyReports");
const adminUsers = document.querySelector("#adminUsers");
const usernameBlockForm = document.querySelector("#usernameBlockForm");
const usernameBlockedPhrases = document.querySelector("#usernameBlockedPhrases");
const adminAccessCleanup = document.querySelector("#adminAccessCleanup");
const adminStoreForm = document.querySelector("#adminStoreForm");
const adminStoreMessage = document.querySelector("#adminStoreMessage");
const storeRequestsList = document.querySelector("#storeRequestsList");
const adminStoresList = document.querySelector("#adminStoresList");
const storeRequestCount = document.querySelector("#storeRequestCount");
const adminSuggestionsList = document.querySelector("#adminSuggestionsList");
const suggestionsCount = document.querySelector("#suggestionsCount");
const productToolsContent = document.querySelector("#productToolsContent");
const emailSetupStatus = document.querySelector("#emailSetupStatus");
const emailTestForm = document.querySelector("#emailTestForm");
const emailTestTo = document.querySelector("#emailTestTo");
const emailTestMessage = document.querySelector("#emailTestMessage");
const runEmailDiagnosticButton = document.querySelector("#runEmailDiagnosticButton");
const emailDiagnosticResult = document.querySelector("#emailDiagnosticResult");
const manualEntryForm = document.querySelector("#manualEntryForm");
const manualStore = document.querySelector("#manualStore");
const manualCategory = document.querySelector("#manualCategory");
const manualProofType = document.querySelector("#manualProofType");
const manualProofPhotoField = document.querySelector("#manualProofPhotoField");
const manualProofPhotoInput = document.querySelector("#manualProofPhotoInput");
const manualProofPhotoStatus = document.querySelector("#manualProofPhotoStatus");
const manualProofPhotoRequirement = document.querySelector("#manualProofPhotoRequirement");
const manualEntryMessage = document.querySelector("#manualEntryMessage");
const priceImportModeTabs = document.querySelector("#priceImportModeTabs");
const priceImportUploadForm = document.querySelector("#priceImportUploadForm");
const priceIntakeSourceOnlyForm = document.querySelector("#priceIntakeSourceOnlyForm");
const priceImportDropZone = document.querySelector("#priceImportDropZone");
const priceImportProofInput = document.querySelector("#priceImportProofInput");
const priceImportUploadPreview = document.querySelector("#priceImportUploadPreview");
const priceImportSourceTextForm = document.querySelector("#priceImportSourceTextForm");
const priceImportReceiptTextForm = document.querySelector("#priceImportReceiptTextForm");
const priceImportReceiptSummary = document.querySelector("#priceImportReceiptSummary");
const priceImporterMessage = document.querySelector("#priceImporterMessage");
const priceImportCleanupReport = document.querySelector("#priceImportCleanupReport");
const proofInboxList = document.querySelector("#proofInboxList");
const proofInboxCount = document.querySelector("#proofInboxCount");
const priceImportProofList = document.querySelector("#priceImportProofList");
const priceImportSelectedBatchLabel = document.querySelector("#priceImportSelectedBatchLabel");
const priceImportRowForm = document.querySelector("#priceImportRowForm");
const priceImportRows = document.querySelector("#priceImportRows");
const priceImporterCount = document.querySelector("#priceImporterCount");
const priceImportApproveSelected = document.querySelector("#priceImportApproveSelected");
const priceImportRejectSelected = document.querySelector("#priceImportRejectSelected");
const priceImportReviewFilters = document.querySelector("#priceImportReviewFilters");
const priceImportBulkEditForm = document.querySelector("#priceImportBulkEditForm");
const priceImportSelectedCount = document.querySelector("#priceImportSelectedCount");
const priceImportRemoveSelected = document.querySelector("#priceImportRemoveSelected");
const priceImportUndoBatch = document.querySelector("#priceImportUndoBatch");
const priceImportHistory = document.querySelector("#priceImportHistory");
const priceImportResetRow = document.querySelector("#priceImportResetRow");
const adminMessage = document.querySelector("#adminMessage");
const adminSessionStatus = document.querySelector("#adminSessionStatus");
const operationsCenter = document.querySelector("#operationsCenter");
const operationsMessage = document.querySelector("#operationsMessage");
const operationsRefreshButton = document.querySelector("#operationsRefreshButton");
const operationsAutoRefresh = document.querySelector("#operationsAutoRefresh");
const inboxList = document.querySelector("#inboxList");
const inboxMessage = document.querySelector("#inboxMessage");
const inboxFilters = document.querySelector("#inboxFilters");
const reviewNextButton = document.querySelector("#reviewNextButton");
const receiptReviewWorkspace = document.querySelector("#receiptReviewWorkspace");
const workersList = document.querySelector("#workersList");
const workerShiftControls = document.querySelector("#workerShiftControls");
const v2FeedbackList = document.querySelector("#v2FeedbackList");
const v2AnnouncementsList = document.querySelector("#v2AnnouncementsList");
const adminNotificationBell = document.querySelector("#adminNotificationBell");
const adminBellCount = document.querySelector("#adminBellCount");
const adminV2NotificationPanel = document.querySelector("#adminV2NotificationPanel");
const catalogImportForm = document.querySelector("#catalogImportForm");
const catalogImagesForm = document.querySelector("#catalogImagesForm");
const catalogImportMessage = document.querySelector("#catalogImportMessage");
const catalogImportResults = document.querySelector("#catalogImportResults");
const aiSettingsForm = document.querySelector("#aiSettingsForm");
const aiSettingsMessage = document.querySelector("#aiSettingsMessage");
const aiUsageSummary = document.querySelector("#aiUsageSummary");
const bulkPriceIntakeForm = document.querySelector("#bulkPriceIntakeForm");
const bulkPriceIntakeMessage = document.querySelector("#bulkPriceIntakeMessage");
const bulkPriceIntakeResults = document.querySelector("#bulkPriceIntakeResults");
const bulkProductImagesForm = document.querySelector("#bulkProductImagesForm");
const bulkProductImagesMessage = document.querySelector("#bulkProductImagesMessage");
const bulkProductImagesResults = document.querySelector("#bulkProductImagesResults");

let allReports = [];
let allUsers = [];
let adminAccessData = { accounts: [] };
let usernameModerationData = { phrases: [] };
let allStores = [];
let allStoreRequests = [];
let allSuggestions = [];
let productTools = null;
let betaReadiness = null;
let analyticsData = null;
let sponsorData = null;
let priceImporterData = null;
let operationsData = null;
let operationsWidgetLayout = { order: [], hidden: [], sizes: {} };
let operationsRefreshTimer = null;
let adminSession = { loggedIn: false, is_admin: false };
let adminV2HomeData = null;
let adminV2InboxData = { items: [] };
let adminV2WorkersData = { workers: [] };
let adminV2FeedbackData = { feedback: [] };
let adminV2AnnouncementsData = { announcements: [] };
let activeInboxFilter = "all";
let activeReviewState = null;
const reviewRowSaveQueues = new Map();
let activePriceImportMode = "weekly_ad";
let selectedPriceImportBatchId = "";
let selectedPriceImportRows = new Set();
let priceImportFilters = {
  status: "active",
  store: "",
  source: "",
  confidence: "",
  duplicate: "",
  sort: "risk"
};
let adminHistoryFilter = "";
let pendingAdminRoute = {};
let proofInboxFilter = "needs_review";

const rejectionReasons = [
  "No photo uploaded even though photo proof was selected",
  "Wrong store",
  "Wrong item",
  "Wrong price",
  "Blurry or unreadable photo",
  "Duplicate report",
  "Expired sale",
  "Suspicious or fake report",
  "Inappropriate content",
  "Other"
];

const banReasons = [
  "Fake price reports",
  "Repeated rejected reports",
  "Abusive username",
  "Harassment",
  "Spam",
  "Multiple fake accounts",
  "Reward abuse",
  "Inappropriate uploads",
  "Other"
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(date);
}

function dateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function dateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function formatBytes(value) {
  const bytes = Number(value) || 0;

  if (!bytes) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function setMessage(element, text, type = "info") {
  element.textContent = text;
  element.dataset.type = type;
}

function setAdminMessage(text, type = "info") {
  setMessage(adminMessage, text, type);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

function getPin() {
  return pinInput.value.trim();
}

function adminQuery() {
  return "";
}

function adminUploadUrl(photoPath) {
  const filename = String(photoPath || "").split("/").pop();
  return filename ? `/api/admin/uploads/${encodeURIComponent(filename)}${adminQuery()}` : "";
}

function renderAdminSessionStatus() {
  if (!adminSessionStatus) {
    return;
  }
  const operationsTab = document.querySelector('[data-admin-tab="operationsTab"]');

  if (!adminSession?.loggedIn) {
    adminSessionStatus.innerHTML = '<span class="badge confidence-low">Not logged in as admin</span>';
    if (operationsTab) {
      operationsTab.classList.add("is-restricted");
      operationsTab.title = "Log in as Super Admin to open Operations Center.";
    }
    return;
  }

  const role = adminSession.staff_role || adminSession.admin_role || (adminSession.is_super_admin ? "owner" : adminSession.is_admin ? "manager" : "user");
  const roleLabel = titleCase(role);
  const badgeClass = adminSession.is_super_admin
    ? "confidence-high"
    : adminSession.is_admin ? "status-ready" : "confidence-low";

  adminSessionStatus.innerHTML = `
    <span class="badge ${badgeClass}">${escapeHtml(roleLabel)}</span>
    <span class="admin-session-user">${escapeHtml(adminSession.user?.username || adminSession.username || "")}</span>
  `;

  const managerAllowed = ["owner", "manager"].includes(role);
  for (const element of document.querySelectorAll("[data-manager-only]")) {
    element.hidden = !managerAllowed;
  }
  for (const element of document.querySelectorAll("[data-owner-only]")) {
    element.hidden = role !== "owner";
  }
  document.body.classList.toggle("focus-review", Boolean(adminSession.work_preferences?.focus_mode));
  document.body.classList.toggle("admin-large-text", Boolean(adminSession.work_preferences?.larger_text));

  if (operationsTab) {
    operationsTab.classList.toggle("is-restricted", !adminSession.is_super_admin);
    operationsTab.title = adminSession.is_super_admin
      ? "Open Operations Center"
      : "Super Admin access is required.";
  }
}

function switchAdminTab(tabId) {
  for (const button of document.querySelectorAll("[data-admin-tab]")) {
    button.classList.toggle("is-active", button.dataset.adminTab === tabId);
  }

  for (const panel of document.querySelectorAll(".admin-panel")) {
    panel.classList.toggle("is-active", panel.id === tabId);
  }
}

function highlightAdminItem(type, id) {
  if (!type || !id) {
    return false;
  }

  const selectorByType = {
    report: `[data-report-card="${id}"]`,
    user: `[data-user-card="${id}"]`,
    store_request: `[data-store-request-card="${id}"]`,
    suggestion: `[data-suggestion-card="${id}"]`,
    product: `[data-product-admin-card="${id}"]`,
    price_import_batch: `[data-price-import-batch="${id}"]`
  };
  const target = document.querySelector(selectorByType[type] || "");

  if (target) {
    target.classList.add("is-highlighted");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  return false;
}

function highlightAdminTarget(options = {}) {
  const targets = [
    ["report", options.reportId],
    ["user", options.userId],
    ["store_request", options.storeRequestId],
    ["suggestion", options.suggestionId],
    ["product", options.productId],
    ["price_import_batch", options.priceImportBatchId]
  ];

  for (const [type, id] of targets) {
    if (highlightAdminItem(type, id)) {
      return;
    }
  }

  if (targets.some(([, id]) => id)) {
    setAdminMessage("That notification item is no longer visible. Opened the closest admin section instead.", "info");
  }
}

function openAdminTab(tabId, options = {}) {
  pendingAdminRoute = options;
  adminHistoryFilter = options.filter || "";
  switchAdminTab(tabId);

  if (tabId === "pricesTab") {
    renderReportTabs();
  }

  if (tabId === "priceImporterTab") {
    renderPriceImporter();
  }

  if (tabId === "operationsTab") {
    loadOperationsCenter();
  }

  if (tabId === "advancedTab" && (adminSession.staff_role || adminSession.admin_role) === "owner") {
    loadAiSettings();
  }

  window.setTimeout(() => highlightAdminTarget(options), 80);
}

function goToAdminTab(tabId, options = {}) {
  openAdminTab(tabId, options);
}

async function markAdminNotificationRead(notificationId) {
  try {
    await fetchJson(`/api/admin/notifications/${notificationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin() })
    });
  } catch (error) {
    // Notification read state should not block routing.
  }
}

function optionRows(options, selected = "") {
  return options
    .map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`)
    .join("");
}

function productOptions(selected = "") {
  const products = productTools?.products || [];
  return '<option value="">Unlinked</option>' + products
    .filter((product) => product.status !== "hidden" && product.status !== "merged")
    .map((product) => `
      <option value="${product.id}" ${String(product.id) === String(selected || "") ? "selected" : ""}>
        ${escapeHtml(product.display_name)} (${escapeHtml(product.status)})
      </option>
    `)
    .join("");
}

function storeOptions(selected = "") {
  return '<option value="">Choose store</option>' + allStores
    .filter((store) => store.active !== 0 && store.active !== false)
    .map((store) => `
      <option value="${store.id}" ${String(store.id) === String(selected || "") ? "selected" : ""}>
        ${escapeHtml(store.name)}
      </option>
    `)
    .join("");
}

function storeOptionsWithEmpty(emptyLabel = "Choose store", selected = "") {
  return `<option value="">${escapeHtml(emptyLabel)}</option>` + allStores
    .filter((store) => store.active !== 0 && store.active !== false)
    .map((store) => `
      <option value="${store.id}" ${String(store.id) === String(selected || "") ? "selected" : ""}>
        ${escapeHtml(store.name)}
      </option>
    `)
    .join("");
}

function populatePriceIntakeControls() {
  for (const select of document.querySelectorAll("[data-intake-store-select]")) {
    const selected = select.value;
    const emptyLabel = select.closest("#priceImportBulkEditForm") ? "No change" : "Choose store";
    select.innerHTML = storeOptionsWithEmpty(emptyLabel, selected);
  }

  if (priceImportBulkEditForm?.elements.category) {
    const selected = priceImportBulkEditForm.elements.category.value;
    priceImportBulkEditForm.elements.category.innerHTML = '<option value="">No change</option>' + optionRows(categories, selected);
  }
}

function productFormFields(product = {}) {
  return `
    <label><span>Name</span><input data-product-field="display_name" type="text" maxlength="160" value="${escapeHtml(product.display_name || "")}"></label>
    <label><span>Canonical name</span><input data-product-field="canonical_name" type="text" maxlength="160" value="${escapeHtml(product.canonical_name || "")}" placeholder="lowercase search name"></label>
    <label><span>Category</span><select data-product-field="category">${optionRows(categories, product.category || "other")}</select></label>
    <label><span>Default size</span><input data-product-field="default_size_text" type="text" maxlength="80" value="${escapeHtml(product.default_size_text || "")}"></label>
    <label><span>Default quantity</span><input data-product-field="default_quantity" type="number" min="0.01" step="0.01" value="${product.default_quantity ?? ""}"></label>
    <label><span>Default unit</span><input data-product-field="default_unit" type="text" maxlength="30" value="${escapeHtml(product.default_unit || "")}" placeholder="each, lb, oz"></label>
    <label><span>Preferred brand</span><input data-product-field="preferred_brand" type="text" maxlength="80" value="${escapeHtml(product.preferred_brand || "")}"></label>
    <label><span>Variant</span><input data-product-field="variant" type="text" maxlength="100" value="${escapeHtml(product.variant || "")}"></label>
    <label><span>UPC</span><input data-product-field="upc" type="text" maxlength="40" value="${escapeHtml(product.upc || "")}"></label>
    <label><span>Status</span><select data-product-field="status">${optionRows(productStatuses, product.status || "active")}</select></label>
    <label class="span-full"><span>Aliases</span><textarea data-product-field="common_aliases" rows="2" maxlength="1000">${escapeHtml(product.common_aliases || "")}</textarea></label>
    <label class="span-full"><span>Description</span><textarea data-product-field="description" rows="2" maxlength="1000">${escapeHtml(product.description || "")}</textarea></label>
    <label class="span-full"><span>Ingredient/allergy source</span><input data-product-field="ingredient_info_url" type="url" maxlength="300" value="${escapeHtml(product.ingredient_info_url || "")}"></label>
    <label class="span-full"><span>Allergen note</span><input data-product-field="allergen_note" type="text" maxlength="500" value="${escapeHtml(product.allergen_note || "")}"></label>
    <label class="span-full"><span>Admin safety note</span><input data-product-field="admin_safety_note" type="text" maxlength="500" value="${escapeHtml(product.admin_safety_note || "")}"></label>
    <label class="span-full"><span>Admin note</span><input data-product-field="admin_note" type="text" maxlength="500" value="${escapeHtml(product.admin_note || "")}"></label>
  `;
}

function populateCategorySelect(select) {
  select.innerHTML = "";

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = titleCase(category);
    select.appendChild(option);
  }
}

async function loadStores() {
  const data = await fetchJson("/api/stores");
  manualStore.innerHTML = '<option value="">Choose store</option>';

  for (const store of data.stores) {
    const option = document.createElement("option");
    option.value = store.id;
    option.textContent = store.name;
    manualStore.appendChild(option);
  }
}

async function loadAdminData() {
  if (getPin()) {
    localStorage.setItem("groceryRadarAdminPin", getPin());
  }

  setAdminMessage("Loading admin data...");
  const authData = await fetchJson("/api/auth/me");
  adminSession = authData || { loggedIn: false, is_admin: false };
  const role = authData.staff_role || authData.admin_role || (authData.is_super_admin ? "owner" : authData.is_admin ? "manager" : "user");
  const managerAllowed = ["owner", "manager"].includes(role);
  const safeFetch = async (url, fallback) => {
    try { return await fetchJson(url); } catch (error) {
      if ([401, 403].includes(error.status)) return fallback;
      throw error;
    }
  };
  const adminAccessPromise = authData?.is_super_admin
    ? fetchJson(`/api/admin/admin-accounts${adminQuery()}`)
    : Promise.resolve({
        accounts: [],
        cleanup_needed: false,
        recommendation: "Owner / Super Admin access is required to view or change admin roles."
      });
  const [notificationData, betaData, analyticsResponse, sponsorResponse, emailData, reportData, userData, adminAccessResponse, usernameData, storeData, suggestionData, productData, priceImportData, v2Home, v2Inbox, v2Workers, v2Feedback, v2Announcements] = await Promise.all([
    fetchJson(`/api/admin/notifications${adminQuery()}`),
    managerAllowed ? fetchJson(`/api/admin/beta-readiness${adminQuery()}`) : Promise.resolve({}),
    managerAllowed ? fetchJson(`/api/admin/analytics${adminQuery()}`) : Promise.resolve({}),
    managerAllowed ? fetchJson(`/api/admin/sponsors${adminQuery()}`) : Promise.resolve({ sponsors: [] }),
    role === "owner" ? fetchJson(`/api/admin/email/status${adminQuery()}`) : Promise.resolve({}),
    fetchJson(`/api/admin/reports${adminQuery()}`),
    managerAllowed ? fetchJson(`/api/admin/users${adminQuery()}`) : Promise.resolve({ users: [] }),
    adminAccessPromise,
    managerAllowed ? fetchJson(`/api/admin/username-moderation${adminQuery()}`) : Promise.resolve({ phrases: [] }),
    fetchJson(`/api/admin/stores${adminQuery()}`),
    managerAllowed ? fetchJson(`/api/admin/suggestions${adminQuery()}`) : Promise.resolve({ suggestions: [] }),
    fetchJson(`/api/admin/product-tools${adminQuery()}`),
    fetchJson(`/api/admin/price-imports${adminQuery()}`),
    safeFetch(`/api/admin/v2/home${adminQuery()}`, null),
    safeFetch(`/api/admin/v2/inbox${adminQuery()}`, { items: [] }),
    managerAllowed ? fetchJson(`/api/admin/v2/workers${adminQuery()}`) : Promise.resolve({ workers: [] }),
    managerAllowed ? safeFetch(`/api/admin/v2/feedback${adminQuery()}`, { feedback: [] }) : Promise.resolve({ feedback: [] }),
    managerAllowed ? safeFetch(`/api/admin/v2/announcements${adminQuery()}`, { announcements: [] }) : Promise.resolve({ announcements: [] })
  ]);

  allReports = reportData.reports || [];
  allUsers = userData.users || [];
  adminAccessData = adminAccessResponse || { accounts: [] };
  usernameModerationData = usernameData || { phrases: [] };
  allStores = storeData.stores || [];
  allStoreRequests = storeData.store_requests || [];
  allSuggestions = suggestionData.suggestions || [];
  productTools = productData || {};
  betaReadiness = betaData || {};
  analyticsData = analyticsResponse || {};
  sponsorData = sponsorResponse || {};
  priceImporterData = priceImportData || { batches: [] };
  adminV2HomeData = v2Home;
  adminV2InboxData = v2Inbox || { items: [] };
  adminV2WorkersData = v2Workers || { workers: [] };
  adminV2FeedbackData = v2Feedback || { feedback: [] };
  adminV2AnnouncementsData = v2Announcements || { announcements: [] };
  renderAdminSessionStatus();

  populatePriceIntakeControls();
  renderDashboard(notificationData.notifications, adminV2HomeData);
  renderAdminNotificationPanel(notificationData.notifications);
  renderInbox();
  renderWorkers();
  renderV2Feedback();
  renderV2Announcements();
  renderBetaReadiness(betaReadiness);
  renderAnalytics(analyticsData);
  renderSponsors(sponsorData);
  renderEmailSetup(emailData, notificationData.notifications?.last_email_diagnostic || null);
  renderReportTabs();
  renderUsernameModeration();
  renderAdminAccessCleanup(adminAccessData);
  renderUsers(allUsers);
  renderStores();
  renderSuggestions();
  renderProductTools();
  renderPriceImporter();
  setAdminMessage("Admin data loaded.", "success");
}

function renderDashboard(notifications = {}, home = null) {
  if (home) {
    const attention = home.needs_attention || {};
    const today = home.today || {};
    const live = home.live || {};
    const role = home.role || "reviewer";
    const attentionCount = Number(attention.proofs_waiting || 0) + Number(attention.worker_escalations || 0) + Number(attention.price_disputes || 0) + Number(attention.system_problems || 0);
    const isManager = ["owner", "manager"].includes(role);
    adminNotifications.innerHTML = `
      <section class="admin-home-section">
        <p class="field-help">Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${escapeHtml(home.greeting_name || "")}</p>
        <h2>${isManager ? `${attentionCount} thing${attentionCount === 1 ? "" : "s"} need attention` : `${attention.proofs_waiting || 0} proofs waiting`}</h2>
        <button class="primary-button large-primary-action" type="button" data-start-review>${isManager ? "Review Next Proof" : "Start Reviewing"}</button>
        ${home.team?.unfinished_reviews ? '<button class="quiet-button" type="button" data-start-review>Continue unfinished review</button>' : ""}
      </section>
      <section class="admin-home-section"><h3>Today</h3><div class="simple-status-list">
        <div class="simple-status-row"><span>Receipts reviewed</span><strong>${escapeHtml(today.receipts_reviewed || 0)}</strong></div>
        <div class="simple-status-row"><span>Prices approved</span><strong>${escapeHtml(today.prices_approved || 0)}</strong></div>
        ${isManager ? `<div class="simple-status-row"><span>People using Grocery Radar</span><strong>${escapeHtml(live.active_now || 0)}</strong></div>` : ""}
      </div></section>
      ${isManager ? `<section class="admin-home-section"><h3>Manage</h3><div class="manage-grid">${[["Products","productToolsTab"],["Stores","storesTab"],["Users","usersTab"],["Workers","workersTab"],["Advanced","advancedTab"]].map(([label,tab]) => `<button class="attention-card" type="button" data-jump-tab="${tab}"><strong>${label}</strong></button>`).join("")}</div></section>` : `<section class="admin-home-section"><h3>Work</h3><div class="manage-grid"><button class="attention-card" type="button" data-jump-tab="workersTab"><strong>My Hours</strong></button><button class="attention-card" type="button" data-open-home-notifications><strong>Notifications</strong></button></div><div class="card-actions"><button class="quiet-button" type="button" data-shift-home="clock-in">Clock In</button><button class="quiet-button" type="button" data-shift-home="take-break">Take Break</button><button class="quiet-button" type="button" data-shift-home="return">Return</button><button class="quiet-button" type="button" data-shift-home="clock-out">Clock Out</button></div></section>`}
    `;
    for (const button of adminNotifications.querySelectorAll("[data-jump-tab]")) button.addEventListener("click", () => openAdminTab(button.dataset.jumpTab));
    for (const button of adminNotifications.querySelectorAll("[data-start-review]")) button.addEventListener("click", startReviewNext);
    for (const button of adminNotifications.querySelectorAll("[data-shift-home]")) button.addEventListener("click", () => updateShift(button.dataset.shiftHome));
    adminNotifications.querySelector("[data-open-home-notifications]")?.addEventListener("click", () => adminNotificationBell?.click());
    const unread = Number(notifications.unread_admin_notifications || notifications.recent_admin_notifications?.filter((item) => !item.is_read).length || 0);
    if (adminBellCount) adminBellCount.textContent = `${unread} unread`;
    adminNotificationBell?.classList.toggle("has-unread", unread > 0);
    return;
  }
  const lastDiagnostic = notifications.last_email_diagnostic;
  const diagnosticLabel = lastDiagnostic
    ? lastDiagnostic.send?.ok ? "Passed" : "Needs attention"
    : "Not run";
  const rows = [
    { label: "Pending proofs", value: notifications.pending_proofs || 0, tab: "priceImporterTab" },
    { label: "Approved prices", value: notifications.public_approved_prices || 0, tab: "pricesTab" },
    { label: "Users", value: notifications.total_registered_users || 0, tab: "usersTab" },
    { label: "Active contributors", value: notifications.active_contributors || 0, tab: "analyticsTab" },
    { label: "Admin accounts", value: notifications.admin_accounts || 0, tab: "usersTab" },
    { label: "Duplicate/flagged proofs", value: notifications.duplicate_flagged_proofs || 0, tab: "priceImporterTab" },
    { label: "Needs clearer photo", value: notifications.needs_clearer_photo_proofs || 0, tab: "priceImporterTab" },
    { label: "Rejected proofs", value: notifications.rejected_proofs || 0, tab: "priceImporterTab" },
    { label: "Points awarded this week", value: notifications.points_awarded_this_week || 0, tab: "analyticsTab" },
    { label: "Public approved products", value: notifications.public_approved_products || 0, tab: "productToolsTab" },
    { label: "Pending price reviews", value: notifications.pending_reviews || 0, tab: "reviewTab" },
    { label: "Proofs used for prices", value: notifications.proofs_used_for_prices || 0, tab: "priceImporterTab" },
    { label: "Email status", value: notifications.email_configured ? "Configured" : "Not configured", tab: "emailTab" },
    { label: "Last diagnostic", value: diagnosticLabel, tab: "emailTab" }
  ];
  const recentAdminNotifications = notifications.recent_admin_notifications || [];

  adminNotifications.innerHTML = `${notifications.admin_cleanup_warning ? `
      <article class="admin-card compact-card span-full warning">
        <h3>Admin access warning</h3>
        <p>${escapeHtml(notifications.admin_cleanup_warning)}</p>
        <button class="secondary-button" type="button" data-jump-tab="usersTab">Open Admin Access Cleanup</button>
      </article>
    ` : ""}` + rows
    .map((row) => `
      <article class="notification-card actionable-card" role="button" tabindex="0" data-dashboard-tab="${escapeHtml(row.tab)}" data-dashboard-filter="${escapeHtml(row.filter || "")}">
        <strong>${escapeHtml(row.value)}</strong>
        <span>${escapeHtml(row.label)}</span>
        <span class="notification-open-affordance" aria-hidden="true">Open →</span>
      </article>
    `)
    .join("") + `
      <article class="notification-card action-card">
        <button class="secondary-button" type="button" data-jump-tab="reviewTab">Review pending reports</button>
        <button class="quiet-button" type="button" data-jump-tab="manualTab">Add manual price</button>
        <button class="quiet-button" type="button" data-jump-tab="usersTab">View users</button>
        <button class="quiet-button" type="button" data-jump-tab="storesTab">View store requests</button>
        <button class="quiet-button" type="button" data-jump-tab="emailTab">Run email diagnostic</button>
        <button class="secondary-button" type="button" data-jump-tab="betaReadinessTab">Open beta checklist</button>
      </article>
      <article class="admin-card compact-card span-full">
        <h3>Recent admin notifications</h3>
        <div class="admin-list">
          ${recentAdminNotifications.length ? recentAdminNotifications.map((notification) => `
            <button class="notification-list-button ${notification.is_read ? "" : "is-unread"}" type="button"
              data-admin-notification="${notification.id}"
              data-admin-target-tab="${escapeHtml(notification.target_tab || "dashboardTab")}"
              data-admin-related-type="${escapeHtml(notification.related_type || "")}"
              data-admin-related-id="${escapeHtml(notification.related_id || "")}">
              <strong>${escapeHtml(notification.title)}</strong>
              <span>${escapeHtml(notification.message)} · ${escapeHtml(formatDate(notification.created_at))}</span>
              <span class="notification-open-affordance" aria-hidden="true">Open →</span>
            </button>
          `).join("") : '<div class="empty-state">No admin notifications yet.</div>'}
        </div>
      </article>
    `;

  for (const card of adminNotifications.querySelectorAll("[data-dashboard-tab]")) {
    card.addEventListener("click", () => openAdminTab(card.dataset.dashboardTab, { filter: card.dataset.dashboardFilter || "" }));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAdminTab(card.dataset.dashboardTab, { filter: card.dataset.dashboardFilter || "" });
      }
    });
  }

  for (const button of adminNotifications.querySelectorAll("[data-jump-tab]")) {
    button.addEventListener("click", () => openAdminTab(button.dataset.jumpTab));
  }

  for (const button of adminNotifications.querySelectorAll("[data-admin-notification]")) {
    button.addEventListener("click", async () => {
      await markAdminNotificationRead(button.dataset.adminNotification);
      const relatedType = button.dataset.adminRelatedType;
      const relatedId = button.dataset.adminRelatedId;
      openAdminTab(button.dataset.adminTargetTab || "dashboardTab", {
        reportId: relatedType === "report" ? relatedId : "",
        userId: relatedType === "user" ? relatedId : "",
        storeRequestId: relatedType === "store_request" ? relatedId : "",
        suggestionId: relatedType === "suggestion" ? relatedId : "",
        priceImportBatchId: relatedType === "price_import_batch" ? relatedId : "",
        filter: button.dataset.adminTargetTab === "pricesTab" ? "disputed" : ""
      });
    });
  }
}

function inboxItems() {
  const items = adminV2InboxData.items || [];
  return activeInboxFilter === "all" ? items : items.filter((item) => item.type === activeInboxFilter);
}

function renderAdminNotificationPanel(notifications = {}) {
  if (!adminV2NotificationPanel) return;
  const rows = notifications.recent_admin_notifications || [];
  adminV2NotificationPanel.innerHTML = `<div class="admin-panel-heading"><h2>Notifications</h2><button class="quiet-button" type="button" data-close-notifications aria-label="Close notifications">Close</button></div><div class="admin-list">${rows.length ? rows.map((item) => `<button class="notification-list-button ${item.is_read ? "" : "is-unread"}" type="button" data-panel-notification="${item.id}" data-target-url="${escapeHtml(item.target_url || "")}" data-target-tab="${escapeHtml(item.target_tab || "dashboardTab")}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)} · ${escapeHtml(formatDate(item.created_at))}</span></button>`).join("") : '<div class="empty-state">No admin notifications yet.</div>'}</div>`;
  adminV2NotificationPanel.querySelector("[data-close-notifications]")?.addEventListener("click", closeAdminNotifications);
  for (const button of adminV2NotificationPanel.querySelectorAll("[data-panel-notification]")) {
    button.addEventListener("click", async () => {
      await markAdminNotificationRead(button.dataset.panelNotification);
      closeAdminNotifications();
      if (button.dataset.targetUrl?.startsWith("/admin.html")) window.location.assign(button.dataset.targetUrl);
      else openAdminTab(button.dataset.targetTab || "dashboardTab");
    });
  }
}

function closeAdminNotifications() {
  if (!adminV2NotificationPanel) return;
  adminV2NotificationPanel.hidden = true;
  adminNotificationBell?.setAttribute("aria-expanded", "false");
}

function renderInbox() {
  if (!inboxList) return;
  const items = inboxItems();
  inboxList.innerHTML = items.length ? items.map((item) => `
    <article class="inbox-card" data-inbox-item="${escapeHtml(item.id)}">
      <div class="inbox-card-main">
        <span class="badge ${item.type === "needs_help" ? "status-warning" : "status-ready"}">${escapeHtml(titleCase(item.type))}</span>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.subtitle ? `<span>${escapeHtml(item.subtitle)}</span>` : ""}
        <span>${escapeHtml(formatDate(item.submitted_at))}${item.possible_price_count ? ` · ${item.possible_price_count} possible prices` : ""}</span>
        <span class="plain-status">Status: ${escapeHtml(item.status)}</span>
        ${item.claimed_by_username ? `<span>Currently being reviewed by ${escapeHtml(item.claimed_by_username)}</span>` : ""}
        ${item.escalation_reason ? `<span class="warning">Help needed: ${escapeHtml(item.escalation_reason)}</span>` : ""}
      </div>
      <button class="primary-button" type="button" data-open-inbox="${escapeHtml(item.id)}">${item.type === "dispute" ? "Resolve" : "Review"}</button>
    </article>
  `).join("") : '<div class="empty-state">No work in this view.</div>';
  for (const button of inboxList.querySelectorAll("[data-open-inbox]")) {
    button.addEventListener("click", () => {
      const item = (adminV2InboxData.items || []).find((entry) => entry.id === button.dataset.openInbox);
      if (item?.target_type === "price_import_batch") openReceiptReview(item.target_id);
      else if (item) openAdminTab("pricesTab", { reportId: item.target_id, filter: "disputed" });
    });
  }
}

async function refreshReviewInbox() {
  adminV2InboxData = await fetchJson(`/api/admin/v2/inbox${adminQuery()}`);
  renderInbox();
}

async function startReviewNext(options = {}) {
  const excludedId = Number(options.excludeProofId || options.excludeBatchId || 0);
  const baseQuery = adminQuery();
  const next = await fetchJson(`/api/admin/v2/reviews/next${baseQuery || "?"}${baseQuery ? "&" : ""}exclude_proof_id=${encodeURIComponent(excludedId || "")}`);
  if (!next.proof_id) {
    await refreshReviewInbox();
    setMessage(inboxMessage, "No more proofs waiting.", "success");
    openAdminTab("inboxTab");
    return;
  }
  openAdminTab("inboxTab");
  await openReceiptReview(next.proof_id);
}

async function openReceiptReview(batchId) {
  activeReviewState = { batchId: Number(batchId), phase: "opening" };
  setMessage(inboxMessage, "Opening receipt review...");
  try {
    await fetchJson(`/api/admin/v2/reviews/${batchId}/claim${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) });
    const data = await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`);
    renderReceiptReview(data, { scrollToWorkspace: true });
    setMessage(inboxMessage, "Receipt claimed. Drafts autosave when you leave a field.", "success");
  } catch (error) {
    setMessage(inboxMessage, error.message, "error");
  }
}

function reviewRowMarkup(row, stores = [], canReview = false, canApprove = false, canManageImages = false) {
  const categories = ["produce","meat","dairy","frozen","bakery","pantry","snacks","drinks","prepared food","household","health / personal care","baby","pet","other"];
  const storage = ["shelf stable","refrigerated","frozen","fresh produce","hot prepared food","cold prepared food","not applicable","unknown"];
  const priceTypes = ["regular","sale","one_day_sale","clearance","loyalty_price","digital_coupon","paper_coupon","multi_buy","bogo","bundle","manager_special","other_promotion"];
  const rejectionReasons = ["price unreadable","item unreadable","item could not be identified","price does not match item","wrong product","duplicate submission","duplicate price evidence","wrong store","store could not be verified","date could not be verified","promotion dates unclear","promotion conditions unclear","loyalty/card requirement unclear","coupon requirement unclear","multi-buy conditions unclear","price not actually shown","screenshot incomplete","proof too blurry","proof appears altered","unsupported estimate","outdated evidence","not grocery/household related","other"];
  const confidence = row.ai_confidence || "check";
  const confidenceCopy = confidence === "high" ? "✓ Looks good" : confidence === "unknown" ? "? Could not determine" : "⚠ Please verify";
  const decided = ["approved", "rejected", "removed"].includes(row.status);
  const price = Number(row.price);
  const statusCopy = row.status === "approved" ? "Approved" : row.status === "rejected" ? `Rejected${row.rejection_reason ? ` · ${titleCase(row.rejection_reason)}` : ""}` : confidenceCopy;
  const productMatches = [{ id: row.product_id, display_name: row.product_display_name || row.item_name }, ...(row.product_matches || [])]
    .filter((product, index, products) => product.id && products.findIndex((candidate) => Number(candidate.id) === Number(product.id)) === index);
  return `<article class="receipt-item-row ${confidence === "high" && row.status === "ready_for_review" ? "is-ai-ready" : "is-ai-flagged"}" data-review-row="${row.id}" data-row-status="${escapeHtml(row.status)}" data-draft-updated-at="${escapeHtml(row.updated_at || "")}">
    <div class="receipt-item-heading"><div class="receipt-product-summary">${row.product_image_url ? `<img class="receipt-product-thumbnail" src="${escapeHtml(row.product_image_url)}" alt="${escapeHtml(row.product_image_alt_text || row.product_display_name || row.item_name)}" loading="lazy">` : ""}<div><strong>${escapeHtml(row.item_name || "Unknown item")}</strong><div class="receipt-item-summary"><span>${Number.isFinite(price) ? `$${price.toFixed(2)}` : "Price needed"}</span><span>${escapeHtml(row.size_text || "Size unknown")}</span><span>${escapeHtml(titleCase(row.category || "other"))} · ${escapeHtml(titleCase(row.storage_condition || "unknown"))}</span></div></div></div><span class="ai-confidence ai-confidence-${escapeHtml(confidence)}">${escapeHtml(statusCopy)}</span></div>
    ${row.product_id && !row.product_image_url ? `<div class="missing-product-photo"><strong>No product photo</strong>${canManageImages ? `<div class="card-actions"><button class="quiet-button" type="button" data-add-review-photo="${row.product_id}" data-product-name="${escapeHtml(row.product_display_name || row.item_name)}">Add photo</button><button class="quiet-button" type="button" data-proof-crop-deferred>Use from proof</button><button class="quiet-button" type="button" data-skip-photo>Skip</button></div>` : '<span class="field-help">A category placeholder will be shown publicly.</span>'}</div>` : ""}
    ${!decided ? `<div class="receipt-item-actions"><button class="primary-button" type="button" data-approve-row="${row.id}" ${canApprove ? "" : "disabled"}>Approve</button>${canReview ? `<button class="danger-button" type="button" data-open-reject="${row.id}">Reject</button>` : ""}<button class="quiet-button" type="button" data-edit-row="${row.id}" aria-expanded="false">Edit</button></div>` : ""}
    <div class="receipt-item-edit" data-edit-fields hidden>
      <span class="field-help" data-row-save-state></span>
      <label><span>Matched product</span><select name="product_id"><option value="">Match during approval</option>${productMatches.map((product) => `<option value="${product.id}" ${Number(row.product_id) === Number(product.id) ? "selected" : ""}>${escapeHtml(product.display_name || `Product #${product.id}`)}</option>`).join("")}</select></label>
      <label><span>Item</span><input name="item_name" value="${escapeHtml(row.item_name || "")}" aria-label="Item name"></label>
      <label><span>Price</span><input name="price" type="number" min="0.01" step="0.01" value="${escapeHtml(row.price || "")}" aria-label="Price"></label>
      <label><span>Size / amount</span><input name="size_text" value="${escapeHtml(row.size_text || "")}" aria-label="Package size or amount"></label>
      <label><span>Category</span><select name="category" aria-label="Category">${categories.map((value) => `<option value="${value}" ${row.category === value ? "selected" : ""}>${titleCase(value)}</option>`).join("")}</select></label>
      <label><span>Storage</span><select name="storage_condition" aria-label="Storage or condition">${storage.map((value) => `<option value="${value}" ${row.storage_condition === value ? "selected" : ""}>${titleCase(value)}</option>`).join("")}</select></label>
      <details class="receipt-item-details"><summary>More details</summary><div class="receipt-item-more">
      <label><span>Brand</span><input name="brand" value="${escapeHtml(row.brand || "")}"></label>
      <label><span>Variant</span><input name="variant" value="${escapeHtml(row.variant || "")}"></label>
      <label><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" value="${escapeHtml(row.quantity || 1)}"></label>
      <label><span>Unit</span><input name="unit" value="${escapeHtml(row.unit || "each")}" placeholder="each, lb, oz"></label>
      <label><span>Comparison / unit price</span><input name="comparison_price" type="number" min="0.01" step="0.01" value="${escapeHtml(row.comparison_price || "")}"></label>
      <label><span>Comparison unit</span><input name="comparison_unit" value="${escapeHtml(row.comparison_unit || row.unit || "each")}" placeholder="each, lb, oz"></label>
      <label><span>Estimated item price</span><input name="estimated_item_price" type="number" min="0.01" step="0.01" value="${escapeHtml(row.estimated_item_price || "")}"></label>
      <label><span>Package price</span><input name="package_price" type="number" min="0.01" step="0.01" value="${escapeHtml(row.package_price || "")}"></label>
      <label><span>Price type</span><select name="price_type">${priceTypes.map((value) => `<option value="${value}" ${row.price_type === value ? "selected" : ""}>${titleCase(value)}</option>`).join("")}</select></label>
      <label><span>Source date</span><input name="source_date" type="date" value="${escapeHtml(row.source_date || "")}"></label>
      <label><span>Valid from</span><input name="valid_from_date" type="date" value="${escapeHtml(row.valid_from_date || "")}"></label>
      <label><span>Valid through</span><input name="valid_through_date" type="date" value="${escapeHtml(row.valid_through_date || "")}"></label>
      <label><span>Valid from time</span><input name="valid_from_time" type="time" value="${escapeHtml(row.valid_from_time || "")}"></label>
      <label><span>Valid through time</span><input name="valid_through_time" type="time" value="${escapeHtml(row.valid_through_time || "")}"></label>
      <label><span>Original offer text</span><input name="display_offer_text" value="${escapeHtml(row.display_offer_text || "")}" placeholder="2 for $5 with Rewards"></label>
      <label><span>Promotion conditions</span><input name="promotion_conditions" value="${escapeHtml(row.promotion_conditions || "")}" placeholder="Rewards Card required. Limit 2."></label>
      <label><span>Schedule text</span><input name="promotion_schedule_text" value="${escapeHtml(row.promotion_schedule_text || "")}" placeholder="Tuesday only"></label>
      <label><span>Multi-buy quantity</span><input name="multibuy_quantity" type="number" min="1" step="1" value="${escapeHtml(row.multibuy_quantity || "")}"></label>
      <label><span>Multi-buy total</span><input name="multibuy_total_price" type="number" min="0.01" step="0.01" value="${escapeHtml(row.multibuy_total_price || "")}"></label>
      <label><span>Row store override</span><select name="store_id"><option value="">Use proof store</option>${stores.map((store) => `<option value="${store.id}" ${Number(row.store_id) === Number(store.id) ? "selected" : ""}>${escapeHtml(store.name)}</option>`).join("")}</select></label>
      </div></details>
    </div>
    <div class="receipt-reject-form" data-reject-form hidden><label><span>Public rejection reason</span><select name="rejection_reason">${rejectionReasons.map((reason) => `<option value="${reason}">${titleCase(reason)}</option>`).join("")}</select></label><label><span>Optional public-safe explanation</span><input name="public_reviewer_explanation" maxlength="300"></label><label><span>Internal review note (never public)</span><input name="rejection_note" maxlength="500"></label><div class="card-actions"><button class="danger-button" type="button" data-confirm-reject="${row.id}">Reject item</button><button class="quiet-button" type="button" data-cancel-reject>Cancel</button></div></div>
    ${(row.ai_warnings || []).length ? `<p class="warning span-full">${escapeHtml(row.ai_warnings.join(" "))}</p>` : ""}
  </article>`;
}

function aiJobLabel(status) {
  return ({ waiting: "Waiting for AI", analyzing: "Analyzing", ready_for_review: "Ready for review", needs_attention: "Needs attention", ai_failed: "AI failed", human_complete: "Human review complete" })[status] || "Not started";
}

function renderReceiptReview(data, options = {}) {
  const batch = data.batch || {};
  const rows = batch.rows || [];
  const ai = data.ai || {};
  const analysis = ai.analysis || {};
  const jobStatus = ai.job?.status || "";
  const summary = data.approval_summary || {};
  const flaggedCount = Number(summary.flagged || 0);
  const readyCount = Number(summary.ready || 0);
  const approvableReady = Number(summary.approvable_ready || 0);
  const completedRows = data.completed_rows || [];
  const lifecycle = data.review_state || data.review_lifecycle || { state: "AI_NOT_STARTED", total_rows: rows.length + completedRows.length, unresolved_rows: rows.length, can_finish: false, label: "AI not started", message: "No analysis yet." };
  activeReviewState = { batchId: Number(batch.id), phase: lifecycle.state, ...lifecycle };
  const reviewing = lifecycle.state === "REVIEWING";
  const readyToFinish = lifecycle.state === "READY_TO_FINISH";
  const managerDecisionState = lifecycle.state === "MANAGER_HELP" || lifecycle.state === "AI_ZERO_RESULTS";
  const canManage = Boolean(data.can_manage);
  const aiWaiting = lifecycle.state === "AI_QUEUED" || lifecycle.state === "AI_RUNNING";
  const showManualFallback = ["AI_NOT_STARTED", "AI_FAILED", "AI_ZERO_RESULTS", "REVIEWING"].includes(lifecycle.state);
  const submittedStore = batch.proof_store_name || batch.receipt_store_name || "Not selected";
  const detectedStore = analysis.detected_retailer || analysis.detected_store_name || "Not determined";
  const candidateIds = new Set((analysis.store_candidates || []).map((store) => Number(store.id)));
  const storeOptions = [...(data.stores || [])].sort((left, right) => Number(candidateIds.has(Number(right.id))) - Number(candidateIds.has(Number(left.id))) || left.name.localeCompare(right.name));
  const resolvedStore = (data.stores || []).find((store) => Number(store.id) === Number(analysis.resolved_store_id));
  receiptReviewWorkspace.hidden = false;
  receiptReviewWorkspace.innerHTML = `
    <div class="admin-panel-heading"><div><h2>Review Proof #${batch.id}</h2><p class="field-help">AI prepares suggestions. You make the decision.</p></div><div class="card-actions"><button class="quiet-button" type="button" data-exit-review>Exit</button><button class="quiet-button" type="button" data-focus-review>Focus Mode</button></div></div>
    <div class="receipt-review-layout">
      <section class="receipt-proof-panel">
        <h3>Original proof</h3>
        ${data.proof_url ? `<img class="receipt-proof-image" src="${escapeHtml(data.proof_url + adminQuery())}" alt="Submitted receipt for manual review">` : '<div class="warning">No receipt image is available.</div>'}
        <div class="card-actions">${data.proof_url ? `<a class="secondary-button" href="${escapeHtml(data.proof_url + adminQuery())}" target="_blank" rel="noopener">Open Large</a><a class="quiet-button" href="${escapeHtml(data.proof_url + adminQuery())}" download>Download</a>` : ""}</div>
        <dl><div><dt>Submitted</dt><dd>${escapeHtml(formatDate(batch.created_at))}</dd></div><div><dt>Submitted by</dt><dd>${escapeHtml(batch.created_by_username || "Community member")}</dd></div></dl>
      </section>
      <section class="receipt-items-panel">
        <div class="ai-analysis-summary"><div><h3>AI analysis</h3><strong data-review-state-label>${escapeHtml(lifecycle.label || aiJobLabel(jobStatus))}</strong><p class="field-help" data-review-state-message>${escapeHtml(lifecycle.message || "")}</p></div>${lifecycle.can_run_ai ? `<button class="quiet-button" type="button" data-rerun-ai>${ai.job ? "Re-run AI" : "Run AI"}</button>` : ""}</div>
        ${analysis.id ? `<section class="store-comparison ${analysis.store_needs_resolution ? "has-mismatch" : ""}"><h4>${analysis.store_needs_resolution ? "⚠ Resolve price store" : "Store resolved"}</h4><p><strong>Submitted store:</strong> ${escapeHtml(submittedStore)}</p><p><strong>Detected retailer:</strong> ${escapeHtml(detectedStore)} · ${escapeHtml(titleCase(analysis.detected_store_confidence || "unknown"))} confidence</p>${analysis.exact_store_match_found ? "" : `<p class="field-help">${analysis.detected_retailer ? `${escapeHtml(analysis.detected_retailer)} detected. Exact location not confirmed.` : "AI could not determine a retailer. Choose a store or select Not Sure."}</p>`}<label><span>Resolved price store</span><select data-resolved-store><option value="">Select an active store</option>${storeOptions.map((store) => `<option value="${store.id}" ${Number(resolvedStore?.id) === Number(store.id) ? "selected" : ""}>${candidateIds.has(Number(store.id)) ? "Suggested: " : ""}${escapeHtml(store.name)}</option>`).join("")}</select></label><div class="card-actions">${analysis.exact_store_match_found ? `<button class="secondary-button" type="button" data-store-resolution="use_ai">Use AI match</button>` : ""}<button class="quiet-button" type="button" data-store-resolution="keep_submitted">Keep submitted</button><button class="secondary-button" type="button" data-store-resolution="choose_store">Choose store</button><button class="quiet-button" type="button" data-store-resolution="not_sure">Not Sure</button></div>${resolvedStore ? `<p class="success" data-store-resolution-confirmation>Resolved store: ${escapeHtml(resolvedStore.name)} ✓</p>` : ""}</section>` : `<p class="field-help">Submitted store: ${escapeHtml(submittedStore)}</p>`}
        <div class="items-summary" data-items-summary ${reviewing ? "" : "hidden"}><div><h3><span data-review-remaining>${rows.length}</span> remaining</h3><span><span data-review-ready>${readyCount}</span> ready · <span data-review-flagged>${flaggedCount}</span> need review</span></div><div class="card-actions"><button class="secondary-button" type="button" data-toggle-ready ${flaggedCount ? "" : "hidden"}>Review ${flaggedCount} flagged item${flaggedCount === 1 ? "" : "s"}</button>${data.can_approve ? `<button class="primary-button" type="button" data-approve-ready ${approvableReady ? "" : "hidden"}>Approve All <span data-approvable-ready>${approvableReady}</span> Ready</button>` : ""}</div></div>
        <div id="receiptEditableRows">${reviewing ? rows.map((row) => reviewRowMarkup(row, data.stores, data.can_review, data.can_approve, data.can_manage_images)).join("") : ""}</div>
        <section class="review-completion-state" data-review-completion ${readyToFinish ? "" : "hidden"}><strong>REVIEW COMPLETE ✓</strong><p>All items have been resolved.</p><p><b>Approved: <span data-review-approved>${Number(lifecycle.approved_rows || 0)}</span></b> · <b>Not approved: <span data-review-not-approved>${Number(lifecycle.not_approved_rows || 0)}</span></b></p><div class="card-actions"><button class="primary-button" type="button" data-done-reviewing>Done Reviewing</button><button class="secondary-button" type="button" data-done-review-next>Done &amp; Review Next</button></div></section>
        <section class="manager-decision-panel" data-manager-decision ${managerDecisionState && canManage ? "" : "hidden"}><strong>MANAGER DECISION</strong><p>${lifecycle.state === "AI_ZERO_RESULTS" ? "Confirm whether this proof contains no usable prices or return it for manual review." : "Choose a final proof disposition or return it to normal review."}</p><label><span>Final disposition</span><select data-manager-decision-select><option value="duplicate">Duplicate</option><option value="cant_verify">Can't verify proof</option><option value="cant_read">Can't read proof</option><option value="wrong_store_unusable">Wrong store / unusable</option><option value="no_usable_prices">No usable prices</option><option value="reject">Reject proof</option><option value="other">Other</option></select></label><label><span>Optional internal note</span><input data-manager-decision-note maxlength="500"></label><div class="card-actions"><button class="danger-button" type="button" data-apply-manager-decision>Apply Final Decision</button><button class="secondary-button" type="button" data-return-to-review>Return to Review</button></div></section>
        <section class="review-state-guidance" data-review-guidance ${reviewing || readyToFinish ? "hidden" : ""}><strong>${escapeHtml(lifecycle.label || "Review status")}</strong><p>${escapeHtml(lifecycle.message || "")}</p></section>
        <details class="completed-review-items" data-completed-items ${completedRows.length ? "" : "hidden"}><summary>Show completed (<span data-completed-count>${completedRows.length}</span>)</summary><div data-completed-list>${completedRows.map(completedReviewRowMarkup).join("")}</div></details>
        <details data-manual-fallback ${showManualFallback ? "" : "hidden"}><summary>Manual review</summary><p class="field-help">Paste structured results or enter an item manually. Everything remains a draft.</p><textarea id="receiptAiPaste" rows="7" placeholder="Bananas | 1.23 lb | 0.73&#10;Milk | 1 gal | 3.49"></textarea><div class="card-actions"><button class="secondary-button" type="button" data-parse-ai>Paste from ChatGPT</button><button class="quiet-button" type="button" data-add-manual-row>Enter manually</button></div></details>
        <div class="review-actions">
          ${managerDecisionState ? "" : `<button class="quiet-button" type="button" data-quick-proof-reject="proof too blurry">Can't Read</button><button class="quiet-button" type="button" ${canManage ? 'data-manager-quick-decision="duplicate"' : 'data-help-reason="Possible duplicate receipt"'}>Duplicate</button><button class="quiet-button" type="button" data-wrong-store>Wrong Store</button><button class="secondary-button" type="button" data-help-reason="Manager review requested">Needs Manager Help</button>`}
          <button class="danger-button" type="button" data-open-proof-reject>Reject Proof</button>
          ${data.can_approve ? "" : '<span class="warning">Data Entry can save drafts but cannot publish prices.</span>'}
          <button class="quiet-button" type="button" data-review-later ${lifecycle.can_review_later && !readyToFinish ? "" : "hidden"}>${aiWaiting ? "Return to Inbox" : "Review Later"}</button>
        </div>
        <div class="receipt-reject-form" data-proof-reject-form hidden><label><span>Public rejection reason</span><select name="proof_rejection_reason">${["price unreadable","item unreadable","item could not be identified","price does not match item","wrong product","duplicate submission","duplicate price evidence","wrong store","store could not be verified","date could not be verified","promotion dates unclear","promotion conditions unclear","loyalty/card requirement unclear","coupon requirement unclear","multi-buy conditions unclear","price not actually shown","screenshot incomplete","proof too blurry","proof appears altered","unsupported estimate","outdated evidence","not grocery/household related","other"].map((reason) => `<option value="${reason}">${titleCase(reason)}</option>`).join("")}</select></label><label><span>Optional public-safe explanation</span><input name="proof_public_explanation" maxlength="300"></label><label><span>Internal review note (never public)</span><input name="proof_rejection_note" maxlength="500"></label><div class="card-actions"><button class="danger-button" type="button" data-reject-receipt>Reject proof and close task</button><button class="quiet-button" type="button" data-cancel-proof-reject>Cancel</button></div></div>
      </section>
    </div>`;
  if (options.scrollToWorkspace) receiptReviewWorkspace.scrollIntoView({ block: "start" });
  for (const rowElement of receiptReviewWorkspace.querySelectorAll("[data-review-row]")) {
    for (const input of rowElement.querySelectorAll("[data-edit-fields] input, [data-edit-fields] select")) input.addEventListener("change", () => saveReviewRow(rowElement, input.name));
  }
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-edit-row]")) button.addEventListener("click", () => {
    const edit = button.closest("[data-review-row]").querySelector("[data-edit-fields]");
    edit.hidden = !edit.hidden;
    button.setAttribute("aria-expanded", String(!edit.hidden));
  });
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-open-reject]")) button.addEventListener("click", () => { button.closest("[data-review-row]").querySelector("[data-reject-form]").hidden = false; });
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-cancel-reject]")) button.addEventListener("click", () => { button.closest("[data-reject-form]").hidden = true; });
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-approve-row]")) button.addEventListener("click", (event) => { event.preventDefault(); approveReviewRow(batch.id, button.dataset.approveRow); });
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-confirm-reject]")) button.addEventListener("click", (event) => { event.preventDefault(); rejectReviewRow(batch.id, button.dataset.confirmReject); });
  bindReviewImageActions(batch.id);
  receiptReviewWorkspace.querySelector("[data-parse-ai]")?.addEventListener("click", () => parseAiResults(batch.id));
  receiptReviewWorkspace.querySelector("[data-add-manual-row]")?.addEventListener("click", () => addManualReviewRow(batch.id));
  receiptReviewWorkspace.querySelector("[data-rerun-ai]")?.addEventListener("click", () => rerunAi(batch.id));
  receiptReviewWorkspace.querySelector("[data-exit-review]")?.addEventListener("click", () => releaseAndExitReview(batch.id));
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-store-resolution]")) button.addEventListener("click", (event) => { event.preventDefault(); resolveReviewStore(batch.id, button.dataset.storeResolution); });
  receiptReviewWorkspace.querySelector("[data-toggle-ready]")?.addEventListener("click", (event) => {
    const hiding = !receiptReviewWorkspace.classList.contains("show-flagged-only");
    receiptReviewWorkspace.classList.toggle("show-flagged-only", hiding);
    event.currentTarget.textContent = hiding ? `View all ${rows.length}` : `Review ${flaggedCount} flagged items`;
  });
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-help-reason]")) button.addEventListener("click", () => escalateReview(batch.id, button.dataset.helpReason));
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-manager-quick-decision]")) button.addEventListener("click", () => managerDecision(batch.id, button.dataset.managerQuickDecision));
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-quick-proof-reject]")) button.addEventListener("click", () => quickRejectProof(batch.id, button.dataset.quickProofReject));
  receiptReviewWorkspace.querySelector("[data-wrong-store]")?.addEventListener("click", () => focusWrongStoreResolution());
  receiptReviewWorkspace.querySelector("[data-apply-manager-decision]")?.addEventListener("click", () => managerDecision(batch.id, receiptReviewWorkspace.querySelector("[data-manager-decision-select]")?.value, receiptReviewWorkspace.querySelector("[data-manager-decision-note]")?.value));
  receiptReviewWorkspace.querySelector("[data-return-to-review]")?.addEventListener("click", () => managerDecision(batch.id, "return_to_review"));
  receiptReviewWorkspace.querySelector("[data-open-proof-reject]")?.addEventListener("click", () => { receiptReviewWorkspace.querySelector("[data-proof-reject-form]").hidden = false; });
  receiptReviewWorkspace.querySelector("[data-cancel-proof-reject]")?.addEventListener("click", () => { receiptReviewWorkspace.querySelector("[data-proof-reject-form]").hidden = true; });
  receiptReviewWorkspace.querySelector("[data-reject-receipt]")?.addEventListener("click", () => rejectReceipt(batch.id));
  receiptReviewWorkspace.querySelector("[data-approve-ready]")?.addEventListener("click", (event) => { event.preventDefault(); approveReadyRows(batch.id, Number(receiptReviewWorkspace.querySelector("[data-approvable-ready]")?.textContent || 0)); });
  receiptReviewWorkspace.querySelector("[data-review-later]")?.addEventListener("click", () => reviewLater(batch.id));
  receiptReviewWorkspace.querySelector("[data-done-reviewing]")?.addEventListener("click", () => doneReviewing(batch.id));
  receiptReviewWorkspace.querySelector("[data-done-review-next]")?.addEventListener("click", () => doneAndReviewNext(batch.id));
  receiptReviewWorkspace.querySelector("[data-focus-review]")?.addEventListener("click", () => document.body.classList.toggle("focus-review"));
}

function completedReviewRowMarkup(row) {
  const label = row.status === "rejected" ? `Rejected · ${titleCase(row.rejection_reason || "Other")}` : row.status === "approved" ? "Approved" : "Removed";
  return `<div class="completed-review-row"><strong>${escapeHtml(row.item_name || "Item")}</strong><span>${escapeHtml(label)}</span></div>`;
}

async function rerunAi(batchId) {
  try {
    const data = await fetchJson(`/api/admin/v2/reviews/${batchId}/re-run-ai${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), reason: "Staff requested a fresh proof analysis." }) });
    setMessage(inboxMessage, data.message, "success");
    window.setTimeout(async () => {
      try { renderReceiptReview(await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`)); }
      catch (error) { setMessage(inboxMessage, error.message, "error"); }
    }, 1200);
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function resolveReviewStore(batchId, action) {
  try {
    const storeSelect = receiptReviewWorkspace.querySelector("[data-resolved-store]");
    const storeId = storeSelect?.value || null;
    if (action === "choose_store" && !storeId) {
      setMessage(inboxMessage, "Choose the exact Grocery Radar store first.", "warning");
      return;
    }
    const data = await fetchJson(`/api/admin/v2/reviews/${batchId}/store-resolution${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), action, store_id: storeId }) });
    if (action === "not_sure") {
      storeSelect.value = "";
      const unresolvedSection = storeSelect.closest(".store-comparison");
      unresolvedSection?.classList.add("has-mismatch");
      const unresolvedHeading = unresolvedSection?.querySelector("h4");
      if (unresolvedHeading) unresolvedHeading.textContent = "⚠ Resolve price store";
      unresolvedSection?.querySelector("[data-store-resolution-confirmation]")?.remove();
      updateReviewSummary(data);
      applyReviewLifecycle(data);
      setMessage(inboxMessage, data.message, "success");
      return;
    }
    const savedStore = data.resolved_store;
    if (!savedStore?.id) throw new Error("The server did not return the saved store.");
    storeSelect.value = String(savedStore.id);
    const section = storeSelect.closest(".store-comparison");
    section?.classList.remove("has-mismatch");
    const heading = section?.querySelector("h4");
    if (heading) heading.textContent = "Store resolved";
    let confirmation = section?.querySelector("[data-store-resolution-confirmation]");
    if (!confirmation && section) {
      confirmation = document.createElement("p");
      confirmation.dataset.storeResolutionConfirmation = "";
      confirmation.className = "success";
      section.append(confirmation);
    }
    if (confirmation) confirmation.textContent = `Resolved store: ${savedStore.name} ✓`;
    updateReviewSummary(data);
    applyReviewLifecycle(data);
    setMessage(inboxMessage, `Store resolved to ${savedStore.name}.`, "success");
  } catch (error) {
    console.error("Store resolution failed", { batchId, action, message: error.message });
    setMessage(inboxMessage, "Could not save store. Please try again.", "error");
  }
}

function updateReviewSummary(review) {
  const flaggedOnly = receiptReviewWorkspace.classList.contains("show-flagged-only");
  const summary = review.approval_summary || {};
  const remaining = Number(summary.unresolved || 0);
  const ready = Number(summary.ready || 0);
  const flagged = Number(summary.flagged || 0);
  const approvable = Number(summary.approvable_ready || 0);
  const setText = (selector, value) => { const element = receiptReviewWorkspace.querySelector(selector); if (element) element.textContent = value; };
  setText("[data-review-remaining]", remaining);
  setText("[data-review-ready]", ready);
  setText("[data-review-flagged]", flagged);
  setText("[data-approvable-ready]", approvable);
  const toggle = receiptReviewWorkspace.querySelector("[data-toggle-ready]");
  if (toggle) { toggle.hidden = !flagged; toggle.textContent = flaggedOnly ? `View all ${remaining}` : `Review ${flagged} flagged item${flagged === 1 ? "" : "s"}`; }
  const approveReady = receiptReviewWorkspace.querySelector("[data-approve-ready]");
  if (approveReady) approveReady.hidden = !approvable;
  return { remaining, ready, flagged, approvable };
}

function applyReviewLifecycle(review) {
  const lifecycle = review.review_state || review.review_lifecycle || review || {};
  activeReviewState = { batchId: Number(review.proof_id || review.batch?.id || activeReviewState?.batchId), phase: lifecycle.state || "REVIEWING", ...lifecycle };
  const completion = receiptReviewWorkspace.querySelector("[data-review-completion]");
  if (completion) completion.hidden = !lifecycle.can_finish;
  const approvedCount = receiptReviewWorkspace.querySelector("[data-review-approved]");
  const notApprovedCount = receiptReviewWorkspace.querySelector("[data-review-not-approved]");
  if (approvedCount) approvedCount.textContent = Number(lifecycle.approved_rows || 0);
  if (notApprovedCount) notApprovedCount.textContent = Number(lifecycle.not_approved_rows || 0);
  const itemsSummary = receiptReviewWorkspace.querySelector("[data-items-summary]");
  if (itemsSummary) itemsSummary.hidden = lifecycle.state !== "REVIEWING";
  const guidance = receiptReviewWorkspace.querySelector("[data-review-guidance]");
  if (guidance) {
    guidance.hidden = ["REVIEWING", "READY_TO_FINISH"].includes(lifecycle.state);
    const strong = guidance.querySelector("strong");
    const paragraph = guidance.querySelector("p");
    if (strong) strong.textContent = lifecycle.label || "Review status";
    if (paragraph) paragraph.textContent = lifecycle.message || "";
  }
  const stateLabel = receiptReviewWorkspace.querySelector("[data-review-state-label]");
  const stateMessage = receiptReviewWorkspace.querySelector("[data-review-state-message]");
  if (stateLabel) stateLabel.textContent = lifecycle.label || lifecycle.state || "Review status";
  if (stateMessage) stateMessage.textContent = lifecycle.message || "";
  const reviewLaterButton = receiptReviewWorkspace.querySelector("[data-review-later]");
  if (reviewLaterButton) reviewLaterButton.hidden = !lifecycle.can_review_later || lifecycle.state === "READY_TO_FINISH";
}

async function refreshResolvedReviewRows(batchId, resolvedRowIds, confirmationText, review) {
  const cards = resolvedRowIds.map((rowId) => receiptReviewWorkspace.querySelector(`[data-review-row="${rowId}"]`)).filter(Boolean);
  if (cards.length) {
    const status = document.createElement("div");
    status.className = "review-action-status";
    status.tabIndex = -1;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = confirmationText;
    cards[0].before(status);
    status.focus({ preventScroll: true });
    cards[0].remove();
    for (const card of cards.slice(1)) card.remove();
  }
  const { remaining } = updateReviewSummary(review);
  applyReviewLifecycle(review);
  const completed = review.completed_rows || [];
  const completedBox = receiptReviewWorkspace.querySelector("[data-completed-items]");
  if (completedBox) {
    completedBox.hidden = !completed.length;
    const completedCount = completedBox.querySelector("[data-completed-count]");
    if (completedCount) completedCount.textContent = completed.length;
    const list = completedBox.querySelector("[data-completed-list]");
    if (list) list.innerHTML = completed.map(completedReviewRowMarkup).join("");
  }
  if (!remaining) receiptReviewWorkspace.querySelector("[data-review-completion] button")?.setAttribute("aria-describedby", "inboxMessage");
}

function bindReviewImageActions(batchId) {
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-add-review-photo]")) button.addEventListener("click", () => openReviewPhotoDialog(batchId, button.dataset.addReviewPhoto, button.dataset.productName));
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-proof-crop-deferred]")) button.addEventListener("click", () => setMessage(inboxMessage, "Proof cropping is deferred for safety. Upload a product-only crop with Add Photo.", "warning"));
  for (const button of receiptReviewWorkspace.querySelectorAll("[data-skip-photo]")) button.addEventListener("click", () => { button.closest(".missing-product-photo").hidden = true; });
}

function openReviewPhotoDialog(batchId, productId, productName) {
  const dialog = document.createElement("dialog");
  dialog.className = "product-photo-dialog";
  dialog.innerHTML = `<form method="dialog"><div class="admin-panel-heading"><div><h3>Add product photo</h3><p>Product: ${escapeHtml(productName || "Product")}</p></div><button class="quiet-button" value="cancel" aria-label="Close photo dialog">Close</button></div><label><span>Choose image</span><input name="product_image" type="file" accept="image/jpeg,image/png,image/webp" required></label><label><span>Alt text</span><input name="alt_text" maxlength="240" value="${escapeHtml(productName || "Product image")}" required></label><p class="field-help">Use only a product-only photo Grocery Radar is allowed to publish. It will be approved as the primary image.</p><div class="card-actions"><button class="primary-button" type="button" data-save-review-photo>Save product photo</button><button class="quiet-button" value="cancel">Cancel</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("[data-save-review-photo]").addEventListener("click", async () => {
    const input = dialog.querySelector('[name="product_image"]');
    if (!input.files.length) { setMessage(inboxMessage, "Choose a product photo first.", "error"); return; }
    const body = new FormData();
    body.append("product_image", input.files[0]);
    body.append("alt_text", dialog.querySelector('[name="alt_text"]').value);
    body.append("source_note", "Authorized staff upload during proof review");
    body.append("pin", getPin());
    try {
      const upload = await fetchJson(`/api/admin/products/${productId}/images${adminQuery()}`, { method: "POST", body });
      await fetchJson(`/api/admin/product-images/${upload.image.id}/moderate${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), status: "approved", is_primary: true, alt_text: dialog.querySelector('[name="alt_text"]').value, source_note: "Authorized staff upload during proof review" }) });
      dialog.close();
      const review = await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`);
      const updated = review.batch.rows.find((row) => Number(row.product_id) === Number(productId));
      if (updated?.product_image_url) for (const card of receiptReviewWorkspace.querySelectorAll(`[data-review-row]`)) {
        if (card.querySelector(`[data-add-review-photo="${productId}"]`)) {
          card.querySelector(".missing-product-photo")?.remove();
          card.querySelector(".receipt-product-summary")?.insertAdjacentHTML("afterbegin", `<img class="receipt-product-thumbnail" src="${escapeHtml(updated.product_image_url)}" alt="${escapeHtml(updated.product_image_alt_text || productName)}" loading="lazy">`);
        }
      }
      setMessage(inboxMessage, "Product photo approved and set as primary.", "success");
    } catch (error) { setMessage(inboxMessage, error.message, "error"); }
  });
  dialog.showModal();
}

async function approveReviewRow(batchId, rowId) {
  const payload = { pin: getPin() };
  try {
    const pendingSave = reviewRowSaveQueues.get(String(rowId));
    if (pendingSave) await pendingSave;
    const rowElement = receiptReviewWorkspace.querySelector(`[data-review-row="${rowId}"]`);
    if (rowElement?.dataset.draftUpdatedAt) payload.expected_draft_updated_at = rowElement.dataset.draftUpdatedAt;
    let result;
    try {
      result = await fetchJson(`/api/admin/price-import-rows/${rowId}/approve${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (error) {
      if (!/Owner confirmation is required/i.test(error.message) || !window.confirm("You submitted this proof yourself. Use the Owner operational override and create an audit record?")) throw error;
      payload.owner_self_approval_override = true;
      payload.override_reason = "Owner confirmed operational self-approval in Receipt Review.";
      result = await fetchJson(`/api/admin/price-import-rows/${rowId}/approve${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    await refreshResolvedReviewRows(batchId, [rowId], "Approved", result);
    setMessage(inboxMessage, "Item approved.", "success");
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function rejectReviewRow(batchId, rowId) {
  const row = receiptReviewWorkspace.querySelector(`[data-review-row="${rowId}"]`);
  const reason = row?.querySelector('[name="rejection_reason"]')?.value || "";
  const publicExplanation = row?.querySelector('[name="public_reviewer_explanation"]')?.value || "";
  const note = row?.querySelector('[name="rejection_note"]')?.value || "";
  try {
    const result = await fetchJson(`/api/admin/price-import-rows/${rowId}/reject${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), rejection_reason: reason, public_reviewer_explanation: publicExplanation, admin_rejection_note: note }) });
    await refreshResolvedReviewRows(batchId, [rowId], `Rejected · ${titleCase(reason)}`, result);
    setMessage(inboxMessage, "Item rejected. Its reason and reviewer were recorded.", "success");
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function approveReadyRows(batchId, count) {
  if (!count || !window.confirm(`Approve ${count} high-confidence item${count === 1 ? "" : "s"}? Flagged items will remain unresolved.`)) return;
  const payload = { pin: getPin() };
  try {
    try {
      var result = await fetchJson(`/api/admin/v2/reviews/${batchId}/approve-ready${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (error) {
      if (!/Owner confirmation is required/i.test(error.message) || !window.confirm("You submitted this proof yourself. Use the Owner operational override and create an audit record?")) throw error;
      payload.owner_self_approval_override = true;
      payload.override_reason = "Owner confirmed bulk ready-item self-approval in Receipt Review.";
      result = await fetchJson(`/api/admin/v2/reviews/${batchId}/approve-ready${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    await refreshResolvedReviewRows(batchId, result.approved_row_ids || [], `${result.approved_count} ready item${result.approved_count === 1 ? "" : "s"} approved`, result);
    setMessage(inboxMessage, `${result.approved_count} ready item${result.approved_count === 1 ? "" : "s"} approved. Flagged items were left for review.`, "success");
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function addManualReviewRow(batchId) {
  try {
    await fetchJson(`/api/admin/price-imports/${batchId}/rows${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), item_name: "New item", price: null, category: "other", storage_condition: "unknown", status: "needs_edit" }) });
    const review = await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`);
    renderReceiptReview(review);
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function releaseAndExitReview(batchId) {
  try { await fetchJson(`/api/admin/v2/reviews/${batchId}/release${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) }); } catch (error) { /* An expired claim should not trap the worker. */ }
  activeReviewState = null;
  receiptReviewWorkspace.hidden = true;
  try { await refreshReviewInbox(); } catch (error) { setMessage(inboxMessage, error.message, "error"); }
  openAdminTab("inboxTab");
}

function applyAuthoritativeReviewRow(rowElement, row) {
  if (!rowElement || !row) return;
  rowElement.dataset.draftUpdatedAt = row.updated_at || "";
  rowElement.dataset.rowStatus = row.status || rowElement.dataset.rowStatus;
  const inputs = rowElement.querySelectorAll("[data-edit-fields] input, [data-edit-fields] select");
  for (const input of inputs) {
    if (!input.name || !Object.prototype.hasOwnProperty.call(row, input.name)) continue;
    const nextValue = row[input.name];
    input.value = nextValue === null || nextValue === undefined ? "" : String(nextValue);
  }
  const summary = rowElement.querySelector(".receipt-item-summary");
  if (summary) {
    const parts = summary.querySelectorAll("span");
    if (parts[0]) parts[0].textContent = row.price == null ? "Price needed" : `$${Number(row.price).toFixed(2)}`;
    if (parts[1]) parts[1].textContent = row.size_text || "Size unknown";
    if (parts[2]) parts[2].textContent = `${titleCase(row.category || "other")} · ${titleCase(row.storage_condition || "unknown")}`;
  }
  const title = rowElement.querySelector(".receipt-product-summary strong");
  if (title) title.textContent = row.item_name || "Unknown item";
  const saveState = rowElement.querySelector("[data-row-save-state]");
  if (saveState) saveState.textContent = "Saved ✓";
}

async function persistReviewRow(rowElement, payload) {
  const rowId = rowElement.dataset.reviewRow;
  const saveState = rowElement.querySelector("[data-row-save-state]");
  if (saveState) saveState.textContent = "Saving…";
  const result = await fetchJson(`/api/admin/price-import-rows/${rowId}${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, pin: getPin(), status: "ready_for_review" }) });
  applyAuthoritativeReviewRow(rowElement, result.row);
  setMessage(inboxMessage, "Draft saved ✓", "success");
  return result;
}

function saveReviewRow(rowElement, changedField = "") {
  const rowId = String(rowElement.dataset.reviewRow);
  const payload = Object.fromEntries([...rowElement.querySelectorAll("[data-edit-fields] input, [data-edit-fields] select")].map((input) => [input.name, input.value]));
  payload.edited_fields = changedField ? [changedField] : [];
  const previous = reviewRowSaveQueues.get(rowId) || Promise.resolve();
  const queued = previous.catch(() => {}).then(() => persistReviewRow(rowElement, payload));
  reviewRowSaveQueues.set(rowId, queued);
  queued.then(
    () => { if (reviewRowSaveQueues.get(rowId) === queued) reviewRowSaveQueues.delete(rowId); },
    (error) => {
      if (reviewRowSaveQueues.get(rowId) === queued) reviewRowSaveQueues.delete(rowId);
      const saveState = rowElement.querySelector("[data-row-save-state]");
      if (saveState) saveState.textContent = "Save failed — retry";
      setMessage(inboxMessage, error.message, "error");
    }
  );
  return queued;
}

async function removeReviewRow(rowId) {
  if (!window.confirm("Remove this draft item from the receipt?")) return;
  try {
    const result = await fetchJson(`/api/admin/price-import-rows/${rowId}${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), status: "removed" }) });
    await refreshResolvedReviewRows(result.proof_id, [rowId], "Draft removed", result);
    setMessage(inboxMessage, "Draft removed from active review.", "success");
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function parseAiResults(batchId) {
  const sourceText = receiptReviewWorkspace.querySelector("#receiptAiPaste")?.value || "";
  try {
    const data = await fetchJson(`/api/admin/price-imports/${batchId}/parse-price-text${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), source_text: sourceText }) });
    if (data.extraction_attempt?.skipped_lines?.length) {
      setMessage(inboxMessage, `Drafts created. Check row ${data.extraction_attempt.skipped_lines[0].row || ""}: ${data.extraction_attempt.skipped_lines[0].reason}.`, "warning");
    }
    const review = await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`);
    renderReceiptReview(review);
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function escalateReview(batchId, reason) {
  try {
    await fetchJson(`/api/admin/v2/reviews/${batchId}/escalate${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), reason }) });
    setMessage(inboxMessage, "A Manager has been asked to help.", "success");
    receiptReviewWorkspace.hidden = true;
    await loadAdminData();
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

function focusWrongStoreResolution() {
  const storeSection = receiptReviewWorkspace.querySelector(".store-comparison");
  const storeSelect = receiptReviewWorkspace.querySelector("[data-resolved-store]");
  if (storeSection && storeSelect) {
    storeSection.scrollIntoView({ behavior: "smooth", block: "center" });
    storeSelect.focus();
    setMessage(inboxMessage, "Choose the correct active Janesville store. If it cannot be verified, use Reject Proof.", "warning");
    return;
  }
  setMessage(inboxMessage, "Open Reject Proof and choose Store could not be verified if the store cannot be corrected.", "warning");
}

async function quickRejectProof(batchId, reason) {
  if (!window.confirm("Close this entire proof as unreadable? It will leave the active review queue.")) return;
  try {
    const data = await fetchJson(`/api/admin/v2/reviews/${batchId}/reject${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), reason, public_explanation: "The proof could not be read clearly enough to verify prices." }) });
    activeReviewState = null;
    receiptReviewWorkspace.hidden = true;
    await refreshReviewInbox();
    openAdminTab("inboxTab");
    setMessage(inboxMessage, data.message, "success");
  } catch (error) { setMessage(inboxMessage, error.message || "Could not close this proof.", "error"); }
}

async function managerDecision(batchId, decision, note = "") {
  if (!decision) return;
  if (decision !== "return_to_review") {
    const prompt = decision === "duplicate" ? "Mark this proof as a duplicate?" : decision === "no_usable_prices" ? "Close this review with no usable prices?" : "Apply this final manager disposition and close the proof?";
    if (!window.confirm(prompt)) return;
  }
  try {
    const data = await fetchJson(`/api/admin/v2/reviews/${batchId}/manager-decision${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), decision, note }) });
    if (!data.terminal) {
      const review = await fetchJson(`/api/admin/v2/reviews/${batchId}${adminQuery()}`);
      renderReceiptReview(review);
      setMessage(inboxMessage, data.message, "success");
      return;
    }
    activeReviewState = null;
    receiptReviewWorkspace.hidden = true;
    await refreshReviewInbox();
    openAdminTab("inboxTab");
    setMessage(inboxMessage, data.message, "success");
  } catch (error) { setMessage(inboxMessage, error.message || "Could not save the manager decision.", "error"); }
}

async function rejectReceipt(batchId) {
  const form = receiptReviewWorkspace.querySelector("[data-proof-reject-form]");
  const reason = form?.querySelector('[name="proof_rejection_reason"]')?.value || "";
  const publicExplanation = form?.querySelector('[name="proof_public_explanation"]')?.value || "";
  const note = form?.querySelector('[name="proof_rejection_note"]')?.value || "";
  if (!window.confirm("Reject this entire proof and close the task? The user will be notified.")) return;
  try {
    await fetchJson(`/api/admin/v2/reviews/${batchId}/reject${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), reason, public_explanation: publicExplanation, note }) });
    activeReviewState = null;
    receiptReviewWorkspace.hidden = true;
    await refreshReviewInbox();
    openAdminTab("inboxTab");
    setMessage(inboxMessage, "Proof rejected and returned to Inbox.", "success");
  } catch (error) { setMessage(inboxMessage, error.message || "Could not reject this proof. Please try again.", "error"); }
}

async function approveReviewRows(batch) {
  const rowIds = (batch.rows || []).filter((row) => !["approved","rejected","removed"].includes(row.status)).map((row) => row.id);
  if (!rowIds.length || !window.confirm(`Approve ${rowIds.length} verified price${rowIds.length === 1 ? "" : "s"} for public display?`)) return;
  try {
    const payload = { pin: getPin(), action: "approve", row_ids: rowIds };
    try {
      await fetchJson(`/api/admin/price-import-rows/bulk${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (error) {
      if (!/Owner confirmation is required/i.test(error.message) || !window.confirm("You submitted this proof yourself. Use the Owner operational override and create an audit record?")) throw error;
      payload.owner_self_approval_override = true;
      payload.override_reason = "Owner confirmed operational self-approval in Receipt Review.";
      await fetchJson(`/api/admin/price-import-rows/bulk${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    await loadAdminData();
    openAdminTab("inboxTab");
  } catch (error) { setMessage(inboxMessage, error.message, "error"); }
}

async function reviewLater(batchId) {
  try {
    await fetchJson(`/api/admin/v2/reviews/${batchId}/review-later${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) });
    activeReviewState = null;
    receiptReviewWorkspace.hidden = true;
    await startReviewNext({ excludeProofId: batchId });
  } catch (error) {
    setMessage(inboxMessage, error.message || "Could not save this proof for later.", "error");
  }
}

async function doneAndReviewNext(batchId) {
  try {
    activeReviewState = { ...(activeReviewState || {}), batchId: Number(batchId), phase: "finishing" };
    await fetchJson(`/api/admin/v2/reviews/${batchId}/complete${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) });
    activeReviewState = { batchId: Number(batchId), phase: "completed" };
    receiptReviewWorkspace.hidden = true;
    await startReviewNext({ excludeProofId: batchId });
  } catch (error) {
    activeReviewState = { ...(activeReviewState || {}), phase: "READY_TO_FINISH" };
    setMessage(inboxMessage, error.message || "Could not finish this proof. Please try again.", "error");
  }
}

async function doneReviewing(batchId) {
  try {
    activeReviewState = { ...(activeReviewState || {}), batchId: Number(batchId), phase: "finishing" };
    await fetchJson(`/api/admin/v2/reviews/${batchId}/complete${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) });
    activeReviewState = null;
    receiptReviewWorkspace.hidden = true;
    openAdminTab("inboxTab");
    await loadAdminData();
    setMessage(inboxMessage, "Done reviewing. Returned to Inbox.", "success");
  } catch (error) {
    activeReviewState = { ...(activeReviewState || {}), phase: "READY_TO_FINISH" };
    setMessage(inboxMessage, error.message || "Could not finish this proof. Please try again.", "error");
  }
}

function renderWorkers() {
  if (!workersList) return;
  const workers = adminV2WorkersData.workers || [];
  workersList.innerHTML = workers.length ? workers.map((worker) => `<article class="worker-card"><div class="worker-summary"><strong>${escapeHtml(worker.username)}</strong><span>${escapeHtml(titleCase(worker.role))}</span><span>${worker.shift ? `Clocked in: ${escapeHtml(formatDate(worker.shift.clocked_in_at))}` : "Not clocked in"}</span><span>${worker.active_now ? "Active on Grocery Radar now" : "Not active now"}</span><span>${worker.current_batch_id ? `Reviewing receipt #${worker.current_batch_id}` : "No current task"} · Today: ${worker.reviews_today} reviews</span></div>${adminSession.staff_role === "owner" && worker.role !== "owner" ? `<label><span>Access</span><select data-worker-role="${worker.id}">${["manager","reviewer","data_entry","user"].map((role) => `<option value="${role}" ${worker.role === role ? "selected" : ""}>${titleCase(role)}</option>`).join("")}</select></label>` : ""}</article>`).join("") : '<div class="empty-state">No workers configured yet.</div>';
  for (const select of workersList.querySelectorAll("[data-worker-role]")) select.addEventListener("change", () => changeWorkerRole(select.dataset.workerRole, select.value));
  workerShiftControls.innerHTML = '<button class="secondary-button" type="button" data-shift="clock-in">Clock In</button><button class="quiet-button" type="button" data-shift="take-break">Take Break</button><button class="quiet-button" type="button" data-shift="return">Return from Break</button><button class="secondary-button" type="button" data-shift="clock-out">Clock Out</button>';
  for (const button of workerShiftControls.querySelectorAll("[data-shift]")) button.addEventListener("click", () => updateShift(button.dataset.shift));
}

async function changeWorkerRole(userId, role) {
  if (!window.confirm(`Change this worker to ${titleCase(role)}?`)) { await loadAdminData(); return; }
  try { await fetchJson(`/api/admin/v2/workers/${userId}/role`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }); await loadAdminData(); }
  catch (error) { setAdminMessage(error.message, "error"); }
}

async function updateShift(action) {
  try { const data = await fetchJson(`/api/admin/v2/shifts/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); setAdminMessage(data.message, "success"); await loadAdminData(); }
  catch (error) { setAdminMessage(error.message, "error"); }
}

function renderV2Feedback() {
  if (!v2FeedbackList) return;
  const rows = adminV2FeedbackData.feedback || [];
  v2FeedbackList.innerHTML = rows.length ? rows.map((item) => `<button class="notification-list-button ${item.status === "open" ? "is-unread" : ""}" type="button" data-feedback-id="${item.id}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(titleCase(item.category))} · ${escapeHtml(titleCase(item.status))} · ${escapeHtml(formatDate(item.created_at))}</span></button>`).join("") : '<div class="empty-state">No feedback needs attention.</div>';
}

function renderV2Announcements() {
  if (!v2AnnouncementsList) return;
  const rows = adminV2AnnouncementsData.announcements || [];
  v2AnnouncementsList.innerHTML = rows.length ? rows.map((item) => `<article class="admin-card compact-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><span class="plain-status">${escapeHtml(titleCase(item.status))}</span></article>`).join("") : '<div class="empty-state">No announcements yet. Owner publishing tools are available in Operations.</div>';
}

function setOperationsMessage(text, type = "info") {
  if (operationsMessage) {
    setMessage(operationsMessage, text, type);
  }
}

function healthBadge(status) {
  const value = String(status || "").toLowerCase();
  if (value === "green") return "confidence-high";
  if (value === "red") return "confidence-disputed";
  return "confidence-medium";
}

function numberValue(value) {
  return Number(value || 0).toLocaleString();
}

function operationsMetricCards(rows = []) {
  return rows.map((row) => `
    <article class="notification-card">
      <strong>${escapeHtml(row.value ?? "")}</strong>
      <span>${escapeHtml(row.label)}</span>
    </article>
  `).join("");
}

function compactList(rows = [], empty = "No data yet.") {
  return rows.length
    ? rows.map((row) => `
      <div class="operation-list-row">
        <strong>${escapeHtml(row.title || row.label || row.name || "")}</strong>
        <span>${escapeHtml(row.detail || row.message || row.status || "")}</span>
      </div>
    `).join("")
    : `<div class="empty-state">${escapeHtml(empty)}</div>`;
}

async function loadOperationsCenter() {
  if (!operationsCenter) {
    return;
  }

  if (!adminSession?.is_super_admin) {
    operationsCenter.innerHTML = '<div class="warning">Super Admin access is required for Operations Center.</div>';
    setOperationsMessage("Log in as Super Admin to load Operations Center.", "warning");
    return;
  }

  setOperationsMessage("Loading Operations Center...");

  try {
    const [overview, widgets] = await Promise.all([
      fetchJson(`/api/admin/operations/overview${adminQuery()}`),
      fetchJson(`/api/admin/operations/widgets${adminQuery()}`)
    ]);
    operationsData = overview;
    operationsWidgetLayout = {
      order: widgets.layout?.order?.length ? widgets.layout.order : widgets.widget_ids || [],
      hidden: widgets.layout?.hidden || [],
      sizes: widgets.layout?.sizes || {}
    };
    renderOperationsCenter();
    setOperationsMessage(`Operations updated ${formatDate(overview.generated_at)}.`, "success");
    scheduleOperationsRefresh();
  } catch (error) {
    operationsCenter.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
    setOperationsMessage(error.message, "error");
  }
}

function scheduleOperationsRefresh() {
  window.clearInterval(operationsRefreshTimer);
  operationsRefreshTimer = null;

  if (operationsAutoRefresh?.checked && document.querySelector("#operationsTab")?.classList.contains("is-active")) {
    operationsRefreshTimer = window.setInterval(() => {
      loadOperationsCenter();
    }, 30000);
  }
}

function orderedOperationWidgetIds() {
  const known = [
    "system_health",
    "live_activity",
    "user_management",
    "feedback",
    "feature_voting",
    "search_analytics",
    "price_analytics",
    "store_health",
    "event_feed",
    "error_center",
    "announcements",
    "homepage_service",
    "community_pulse",
    "security"
  ];
  const order = operationsWidgetLayout.order?.length
    ? operationsWidgetLayout.order.filter((id) => known.includes(id))
    : known;
  return [...order, ...known.filter((id) => !order.includes(id))];
}

function renderOperationWidget(id, title, body) {
  const hidden = operationsWidgetLayout.hidden?.includes(id);
  const size = operationsWidgetLayout.sizes?.[id] || "normal";
  return `
    <article class="operation-widget operation-widget-${escapeHtml(size)} ${hidden ? "is-hidden-widget" : ""}"
      data-operation-widget="${escapeHtml(id)}" draggable="true">
      <div class="card-topline">
        <h3>${escapeHtml(title)}</h3>
        <div class="operation-widget-controls">
          <button class="quiet-button" type="button" data-operation-widget-move="up" data-widget-id="${escapeHtml(id)}">Up</button>
          <button class="quiet-button" type="button" data-operation-widget-move="down" data-widget-id="${escapeHtml(id)}">Down</button>
          <button class="quiet-button" type="button" data-operation-widget-size="${escapeHtml(id)}">${escapeHtml(size === "wide" ? "Compact" : "Wide")}</button>
          <button class="quiet-button" type="button" data-operation-widget-hide="${escapeHtml(id)}">${hidden ? "Show" : "Hide"}</button>
        </div>
      </div>
      <div class="operation-widget-body">${body}</div>
    </article>
  `;
}

function renderSystemHealth(data) {
  const health = data.system_health || {};
  const rows = [
    ["Website Status", health.website_status],
    ["Database Status", health.database_status],
    ["Email/SMTP Status", health.email_smtp_status],
    ["Storage Status", health.storage_status],
    ["Background Jobs", health.background_jobs],
    ["Last Successful Backup", health.last_successful_backup]
  ];
  return `
    <div class="operation-health-grid">
      ${rows.map(([label, item]) => `
        <div class="operation-health-row">
          <span class="badge ${healthBadge(item?.status)}">${escapeHtml(String(item?.status || "yellow").toUpperCase())}</span>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(item?.label || "Unknown")}</span>
        </div>
      `).join("")}
    </div>
    <dl class="details-list operation-details">
      <div><dt>Current Version</dt><dd>${escapeHtml(health.current_version || "Unknown")}</dd></div>
      <div><dt>Current Commit</dt><dd>${escapeHtml(health.current_commit_hash || "Unavailable")}</dd></div>
      <div><dt>Server Uptime</dt><dd>${escapeHtml(health.server_uptime_label || "")}</dd></div>
      <div><dt>Render Environment</dt><dd>${health.render_environment?.is_render ? "Render" : "Local/dev"} ${escapeHtml(health.render_environment?.service_name || "")}</dd></div>
    </dl>
    <div class="warning">Local backups are a same-disk safety layer, not disaster recovery. Off-site backups should be added later.</div>
    <div class="card-actions"><button class="primary-button" type="button" data-create-backup>Create Backup</button><button class="quiet-button" type="button" data-list-backups>Backup History</button></div>
    <div id="operationsBackupList" class="admin-list"></div>
  `;
}

function renderLiveActivity(data) {
  const live = data.live_activity || {};
  return `
    <div class="notification-grid">
      ${operationsMetricCards([
        { label: "Online users", value: live.current_online_users || 0 },
        { label: "Visitors today", value: live.visitors_today || 0 },
        { label: "Visitors this week", value: live.visitors_this_week || 0 },
        { label: "Registered users", value: live.registered_users || 0 },
        { label: "Verified users", value: live.verified_users || 0 },
        { label: "Pending verification", value: live.pending_verification || 0 },
        { label: "New users today", value: live.new_users_today || 0 },
        { label: "New users this week", value: live.new_users_this_week || 0 },
        { label: "Returning users", value: live.returning_users || 0 },
        { label: "Average session", value: live.average_session_length_label || "0 sec" },
        { label: "Active sessions", value: live.current_active_sessions || 0 },
        { label: "Peak today", value: live.peak_users_today || 0 }
      ])}
    </div>
    <div class="operation-two-col">
      <div>
        <h4>Recent registrations</h4>
        ${compactList((live.recent_registrations || []).map((user) => ({
          title: user.username,
          detail: `${user.email || ""} · ${formatDate(user.created_at)}`
        })), "No registrations yet.")}
      </div>
      <div>
        <h4>Recent logins</h4>
        ${compactList((live.recent_logins || []).map((login) => ({
          title: login.username,
          detail: `${login.is_super_admin ? "Super Admin" : login.is_admin ? "Admin" : "User"} · ${formatDate(login.created_at)}`
        })), "No login events yet.")}
      </div>
    </div>
  `;
}

function renderOperationsUsers(data) {
  const users = data.users?.users || [];
  return `
    <form id="operationsUserSearchForm" class="admin-toolbar compact-toolbar">
      <label>
        <span>Search users</span>
        <input name="q" type="search" placeholder="Username or email">
      </label>
      <button class="secondary-button" type="submit">Search</button>
    </form>
    <div id="operationsUserDetail" class="operation-user-detail"></div>
    <div class="table-scroll">
      <table class="operations-table">
        <thead>
          <tr>
            <th>Username</th><th>Email</th><th>Role</th><th>Verified</th><th>Join date</th><th>Last login</th><th>Points</th><th>Trust</th><th>Submissions</th><th>Approved</th><th>Rejected</th><th>Warnings</th><th>Status</th>
          </tr>
        </thead>
        <tbody id="operationsUsersTable">
          ${users.map(renderOperationsUserRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOperationsUserRow(user) {
  return `
    <tr data-operation-user-row="${user.id}" tabindex="0">
      <td><button class="link-button" type="button" data-operation-user="${user.id}">${escapeHtml(user.username)}</button></td>
      <td>${escapeHtml(user.email || "")}</td>
      <td>${escapeHtml(titleCase(user.role))}</td>
      <td>${user.verified ? "Yes" : "No"}</td>
      <td>${escapeHtml(formatDateOnly(user.joined_at))}</td>
      <td>${escapeHtml(formatDate(user.last_login_at) || "Never")}</td>
      <td>${numberValue(user.points)}</td>
      <td>${escapeHtml(user.trust_level || "")}</td>
      <td>${numberValue(user.submissions)}</td>
      <td>${numberValue(user.approved)}</td>
      <td>${numberValue(user.rejected)}</td>
      <td>${numberValue(user.warnings)}</td>
      <td>${user.banned ? "Banned" : user.suspended ? "Suspended" : escapeHtml(titleCase(user.account_status || "active"))}</td>
    </tr>
  `;
}

function renderFeedbackWidget(data) {
  const tickets = data.feedback?.tickets || [];
  return `
    <form id="operationsFeedbackFilterForm" class="admin-toolbar compact-toolbar">
      <label>
        <span>Search feedback</span>
        <input name="q" type="search" placeholder="Title, message, or reporter">
      </label>
      <label>
        <span>Status</span>
        <select name="status">
          <option value="">All</option>
          ${["open","in_review","needs_info","closed","merged"].map((status) => `<option value="${status}">${titleCase(status)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Category</span>
        <select name="category">
          <option value="">All</option>
          ${["bug","feature_request","wrong_price","wrong_product","store_issue","question","other"].map((category) => `<option value="${category}">${titleCase(category)}</option>`).join("")}
        </select>
      </label>
      <button class="secondary-button" type="submit">Filter</button>
    </form>
    <div class="operation-filter-row">
      <span class="badge confidence-medium">${numberValue(data.feedback?.total || 0)} tickets</span>
      <span>Bug, feature, wrong price, store issue, question, and other feedback.</span>
    </div>
    <div class="admin-list">
      ${tickets.length ? tickets.map((ticket) => `
        <article class="admin-card compact-card" data-feedback-ticket="${ticket.id}">
          <div class="card-topline">
            <h4>${escapeHtml(ticket.title)}</h4>
            <span class="badge status-${ticket.status === "closed" ? "ready" : ticket.priority === "urgent" ? "critical" : "warning"}">${escapeHtml(titleCase(ticket.status))}</span>
          </div>
          <p>${escapeHtml(ticket.message)}</p>
          <dl class="details-list">
            <div><dt>Category</dt><dd>${escapeHtml(titleCase(ticket.category))}</dd></div>
            <div><dt>Priority</dt><dd>${escapeHtml(titleCase(ticket.priority))}</dd></div>
            <div><dt>Reporter</dt><dd>${escapeHtml(ticket.reporter?.username || "Unknown")}</dd></div>
            <div><dt>Updated</dt><dd>${escapeHtml(formatDate(ticket.updated_at))}</dd></div>
          </dl>
          <div class="admin-control-grid">
            <label><span>Status</span><select data-feedback-field="status">${["open","in_review","needs_info","closed","merged"].map((status) => `<option value="${status}" ${ticket.status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("")}</select></label>
            <label><span>Priority</span><select data-feedback-field="priority">${["low","normal","high","urgent"].map((priority) => `<option value="${priority}" ${ticket.priority === priority ? "selected" : ""}>${titleCase(priority)}</option>`).join("")}</select></label>
            <label><span>Assigned admin ID</span><input data-feedback-field="assigned_admin_id" type="number" min="1" value="${escapeHtml(ticket.assigned_admin_id || "")}" placeholder="Optional"></label>
            <label><span>Duplicate of ticket ID</span><input data-feedback-field="duplicate_of_ticket_id" type="number" min="1" value="${escapeHtml(ticket.duplicate_of_ticket_id || "")}" placeholder="Optional"></label>
            <label class="span-full"><span>Internal note</span><input data-feedback-field="internal_notes" type="text" maxlength="1000" value="${escapeHtml(ticket.internal_notes || "")}"></label>
            <label class="span-full"><span>Public response</span><input data-feedback-field="public_response" type="text" maxlength="1000" value="${escapeHtml(ticket.public_response || "")}"></label>
            <button class="secondary-button" type="button" data-feedback-action="update" data-feedback-id="${ticket.id}">Save</button>
            <button class="quiet-button" type="button" data-feedback-action="close" data-feedback-id="${ticket.id}">Close</button>
            <button class="quiet-button" type="button" data-feedback-action="reopen" data-feedback-id="${ticket.id}">Reopen</button>
            <button class="quiet-button" type="button" data-feedback-action="merge" data-feedback-id="${ticket.id}">Merge duplicate</button>
          </div>
        </article>
      `).join("") : '<div class="empty-state">No feedback tickets yet.</div>'}
    </div>
  `;
}

function renderFeatureVoting(data) {
  const options = data.feature_voting?.options || [];
  return `
    <div class="admin-list">
      ${options.map((option) => `
        <article class="admin-card compact-card">
          <div class="card-topline">
            <h4>${escapeHtml(option.title)}</h4>
            <span class="badge confidence-high">${numberValue(option.votes)} votes</span>
          </div>
          <p>${escapeHtml(option.description || "")}</p>
          <div class="admin-control-grid">
            <label><span>Status</span><select data-feature-status="${option.id}">
              ${["active","trending","completed","rejected"].map((status) => `<option value="${status}" ${option.status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("")}
            </select></label>
            <button class="secondary-button" type="button" data-save-feature-status="${option.id}">Save status</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSearchAnalytics(data) {
  const search = data.search_analytics || {};
  return `
    <div class="notification-grid">
      ${operationsMetricCards([
        { label: "Searches today", value: search.searches_today || 0 },
        { label: "Searches this week", value: search.searches_this_week || 0 },
        { label: "Searches this month", value: search.searches_this_month || 0 }
      ])}
    </div>
    <div class="operation-three-col">
      <div><h4>Most searched products</h4>${compactList((search.most_searched_products || []).map((row) => ({ title: row.term, detail: `${row.count} searches` })), "No searches yet.")}</div>
      <div><h4>Most searched stores</h4>${compactList((search.most_searched_stores || []).map((row) => ({ title: row.store_name, detail: `${row.count} searches` })), "No store-filtered searches yet.")}</div>
      <div><h4>No-result searches</h4>${compactList((search.searches_with_no_results || []).map((row) => ({ title: row.term, detail: `${row.count} misses` })), "No no-result searches yet.")}</div>
    </div>
  `;
}

function renderPriceAnalytics(data) {
  const price = data.price_analytics || {};
  return `
    <div class="notification-grid">
      ${operationsMetricCards([
        { label: "Submitted today", value: price.prices_submitted_today || 0 },
        { label: "Approved today", value: price.approved_today || 0 },
        { label: "Rejected today", value: price.rejected_today || 0 },
        { label: "Duplicate detections", value: price.duplicate_detections || 0 },
        { label: "Avg approval time", value: price.average_approval_time_label || "0 sec" },
        { label: "Parser confidence", value: `${price.average_parser_confidence || 0}%` }
      ])}
    </div>
    <div class="operation-two-col">
      <div><h4>Most active contributors</h4>${compactList((price.most_active_contributors || []).map((row) => ({ title: row.username, detail: `${row.approved_count} approved` })), "No contributors yet.")}</div>
      <div><h4>Products needing prices</h4>${compactList((price.products_without_prices || []).map((row) => ({ title: row.display_name, detail: row.category })), "All active products have prices.")}</div>
    </div>
    <div class="operation-two-col">
      <div><h4>Products needing updates</h4>${compactList((price.products_needing_updates || []).map((row) => ({ title: row.display_name, detail: row.last_reported_at ? `Last checked ${formatDate(row.last_reported_at)}` : "No approved price" })), "No stale products found.")}</div>
      <div><h4>Oldest price by store</h4>${compactList((price.oldest_price_by_store || []).map((row) => ({ title: row.store_name, detail: `${row.approved_price_count} approved · oldest ${formatDate(row.oldest_price_at) || "unknown"}` })), "No approved store prices yet.")}</div>
    </div>
  `;
}

function renderStoreHealth(data) {
  const stores = data.store_health || [];
  return `
    <div class="admin-list">
      ${stores.map((store) => `
        <article class="admin-card compact-card ${store.needs_attention ? "warning" : ""}">
          <div class="card-topline">
            <h4>${escapeHtml(store.name)}</h4>
            <span class="badge ${store.needs_attention ? "status-warning" : "status-ready"}">${store.coverage_percent}% coverage</span>
          </div>
          <dl class="details-list">
            <div><dt>Products</dt><dd>${numberValue(store.products)}</dd></div>
            <div><dt>Verified prices</dt><dd>${numberValue(store.verified_prices)}</dd></div>
            <div><dt>Average age</dt><dd>${numberValue(store.average_age_days)} days</dd></div>
            <div><dt>Last update</dt><dd>${escapeHtml(formatDate(store.last_update) || "None")}</dd></div>
            <div><dt>Missing categories</dt><dd>${escapeHtml((store.missing_categories || []).map(titleCase).join(", ") || "None")}</dd></div>
          </dl>
        </article>
      `).join("")}
    </div>
  `;
}

function renderEventFeed(data) {
  return `
    <div class="admin-list operation-feed">
      ${(data.event_feed || []).map((event) => `
        <div class="operation-list-row">
          <strong>${escapeHtml(event.title)}</strong>
          <span>${escapeHtml(event.message || "")} · ${escapeHtml(formatDate(event.created_at))}</span>
        </div>
      `).join("") || '<div class="empty-state">No events yet.</div>'}
    </div>
  `;
}

function renderErrorCenter(data) {
  const errors = data.error_center || {};
  return `
    <div class="notification-grid">
      ${operationsMetricCards([
        { label: "Failed emails", value: errors.failed_emails || 0 },
        { label: "Failed uploads", value: errors.failed_uploads || 0 },
        { label: "Parser failures", value: errors.parser_failures || 0 },
        { label: "Broken images", value: errors.broken_images?.broken_count || 0 },
        { label: "Unhandled exceptions", value: errors.unhandled_exceptions || 0 },
        { label: "Database errors", value: errors.database_errors || 0 },
        { label: "API failures", value: errors.api_failures || 0 },
        { label: "Rate limiting", value: errors.rate_limiting || 0 }
      ])}
    </div>
    ${compactList((errors.recent_errors || []).map((error) => ({
      title: `${titleCase(error.severity)} ${titleCase(error.error_type)}`,
      detail: `${error.message} · ${formatDate(error.created_at)}`
    })), "No recorded system errors.")}
  `;
}

function renderAnnouncements(data) {
  const announcements = data.announcements || [];
  return `
    <form id="operationsAnnouncementForm" class="admin-control-grid">
      <label><span>Type</span><select name="announcement_type">${["maintenance","known_issue","new_feature","downtime","homepage_banner"].map((type) => `<option value="${type}">${titleCase(type)}</option>`).join("")}</select></label>
      <label><span>Status</span><select name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      <label><span>Title</span><input name="title" type="text" maxlength="160" required></label>
      <label class="span-full"><span>Message</span><textarea name="body" maxlength="1200" rows="3" required></textarea></label>
      <button class="primary-button" type="submit">Save announcement</button>
    </form>
    <div class="admin-list">
      ${announcements.length ? announcements.map((announcement) => `
        <article class="admin-card compact-card">
          <div class="card-topline">
            <h4>${escapeHtml(announcement.title)}</h4>
            <span class="badge ${announcement.status === "published" ? "status-ready" : "status-warning"}">${escapeHtml(titleCase(announcement.status))}</span>
          </div>
          <p>${escapeHtml(announcement.body)}</p>
          <span class="field-help">${escapeHtml(titleCase(announcement.announcement_type))} · ${escapeHtml(formatDate(announcement.updated_at))}</span>
        </article>
      `).join("") : '<div class="empty-state">No announcements yet.</div>'}
    </div>
  `;
}

function textareaList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => escapeHtml(item))
    .join("\n");
}

function renderHomepageServiceWidget(data) {
  const homepage = data.homepage_service || {};
  const service = homepage.service || {};
  const maintenance = service.maintenance || {};
  const latestPatch = (homepage.patch_notes || [])[0] || {};
  const latestIssue = (homepage.known_issues || [])[0] || {};
  const counts = homepage.community_counts || {};

  return `
    <div class="warning">Only the Owner / Super Admin can publish homepage service updates. Keep this public-facing and avoid internal paths, stack traces, secrets, or private user details.</div>
    <div class="notification-grid">
      ${operationsMetricCards([
        { label: "Status", value: titleCase(service.service_status || "online") },
        { label: "Version", value: service.version_label || "Early Access" },
        { label: "Verified prices", value: counts.verified_prices || 0 },
        { label: "Products with prices", value: counts.products_with_active_prices || 0 },
        { label: "Stores tracked", value: counts.janesville_stores_tracked || 0 },
        { label: "Pending proof", value: counts.community_submissions_awaiting_review || 0 }
      ])}
    </div>
    <form id="homepageServiceStatusForm" class="admin-control-grid">
      <label><span>Current status</span><select name="service_status">
        ${["online","maintenance","degraded","updating"].map((status) => `<option value="${status}" ${service.service_status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("")}
      </select></label>
      <label><span>Version number</span><input name="version_label" type="text" maxlength="80" value="${escapeHtml(service.version_label || "")}" required></label>
      <label class="span-full"><span>Current focus</span><input name="current_focus" type="text" maxlength="240" value="${escapeHtml(service.current_focus || "")}" required></label>
      <label class="span-full"><span>Main homepage message</span><textarea name="main_message" rows="4" maxlength="1200" required>${escapeHtml(service.main_message || "")}</textarea></label>
      <label><span>Community mission title</span><input name="community_mission_title" type="text" maxlength="120" value="${escapeHtml(service.community_mission_title || "")}" required></label>
      <label><span>Homepage announcement</span><input name="homepage_announcement" type="text" maxlength="400" value="${escapeHtml(service.homepage_announcement || "")}"></label>
      <label class="span-full"><span>Community mission body</span><textarea name="community_mission_body" rows="3" maxlength="700" required>${escapeHtml(service.community_mission_body || "")}</textarea></label>
      <label class="checkbox-row"><input name="maintenance_enabled" type="checkbox" ${maintenance.enabled ? "checked" : ""}><span>Show maintenance notice</span></label>
      <label><span>Maintenance status</span><select name="maintenance_status">
        ${["scheduled","in_progress","monitoring","complete"].map((status) => `<option value="${status}" ${maintenance.status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("")}
      </select></label>
      <label><span>Maintenance title</span><input name="maintenance_title" type="text" maxlength="160" value="${escapeHtml(maintenance.title || "")}"></label>
      <label><span>Maintenance start</span><input name="maintenance_start_at" type="datetime-local" value="${dateTimeLocalValue(maintenance.start_at)}"></label>
      <label><span>Expected end</span><input name="maintenance_end_at" type="datetime-local" value="${dateTimeLocalValue(maintenance.expected_end_at)}"></label>
      <label class="span-full"><span>Maintenance explanation</span><textarea name="maintenance_message" rows="3" maxlength="700">${escapeHtml(maintenance.message || "")}</textarea></label>
      <label class="span-full"><span>Expected impact</span><textarea name="maintenance_impact" rows="2" maxlength="500">${escapeHtml(maintenance.impact || "")}</textarea></label>
      <button class="primary-button" type="submit">Publish homepage status</button>
    </form>
    <div class="operation-two-col">
      <form id="homepagePatchNoteForm" class="admin-card compact-card">
        <input name="patch_id" type="hidden" value="${escapeHtml(latestPatch.id || "")}">
        <div class="card-topline">
          <h4>Release Notes</h4>
          <span class="badge ${latestPatch.status === "published" ? "status-ready" : "status-warning"}">${escapeHtml(titleCase(latestPatch.status || "draft"))}</span>
        </div>
        <label><span>Version</span><input name="version_label" type="text" maxlength="80" value="${escapeHtml(latestPatch.version_label || service.version_label || "")}" required></label>
        <label><span>Title</span><input name="title" type="text" maxlength="160" value="${escapeHtml(latestPatch.title || "")}" required></label>
        <label><span>Status</span><select name="status"><option value="draft" selected>Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <label><span>Release date</span><input name="release_date" type="date" value="${dateInputValue(latestPatch.release_date)}"></label>
        <label><span>Summary</span><textarea name="summary" rows="3" maxlength="700" required>${escapeHtml(latestPatch.summary || "")}</textarea></label>
        <label><span>Added</span><textarea name="added" rows="4" maxlength="1200">${textareaList(latestPatch.added)}</textarea></label>
        <label><span>Improved</span><textarea name="improved" rows="4" maxlength="1200">${textareaList(latestPatch.improved || latestPatch.changed)}</textarea></label>
        <label><span>Fixed</span><textarea name="fixed" rows="4" maxlength="1200">${textareaList(latestPatch.fixed)}</textarea></label>
        <label><span>Known issues</span><textarea name="known_issues" rows="4" maxlength="1200">${textareaList(latestPatch.known_issues)}</textarea></label>
        <label><span>Next focus</span><textarea name="next_focus" rows="4" maxlength="1200">${textareaList(latestPatch.next_focus)}</textarea></label>
        <div class="inline-actions"><button class="secondary-button" type="submit" name="release_action" value="draft">Save draft</button><button class="primary-button" type="submit" name="release_action" value="published">Publish update</button></div>
      </form>
      <form id="homepageKnownIssueForm" class="admin-card compact-card">
        <div class="card-topline">
          <h4>Known Issues</h4>
          <span class="badge ${latestIssue.visibility_status === "published" ? "status-ready" : "status-warning"}">${escapeHtml(titleCase(latestIssue.visibility_status || "draft"))}</span>
        </div>
        <label><span>Title</span><input name="title" type="text" maxlength="160" value="${escapeHtml(latestIssue.title || "")}" required></label>
        <label><span>Status</span><select name="issue_status">
          ${["investigating","identified","fix_in_progress","monitoring","resolved"].map((status) => `<option value="${status}" ${latestIssue.status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("")}
        </select></label>
        <label><span>Visibility</span><select name="visibility_status"><option value="draft">Draft</option><option value="published" selected>Published</option><option value="hidden">Hidden</option></select></label>
        <label><span>Date opened</span><input name="opened_at" type="date" value="${dateInputValue(latestIssue.opened_at)}"></label>
        <label><span>Last updated</span><input name="last_updated_at" type="date" value="${dateInputValue(latestIssue.last_updated_at)}"></label>
        <label><span>Description</span><textarea name="description" rows="4" maxlength="900" required>${escapeHtml(latestIssue.description || "")}</textarea></label>
        <label><span>Workaround</span><textarea name="workaround" rows="3" maxlength="500">${escapeHtml(latestIssue.workaround || "")}</textarea></label>
        <button class="secondary-button" type="submit">Create known issue</button>
      </form>
    </div>
    <div class="admin-list">
      <h4>Published patch notes</h4>
      ${compactList((homepage.patch_notes || []).map((patch) => ({ title: `${patch.version_label} — ${patch.title}`, detail: `${titleCase(patch.status)} · ${formatDate(patch.published_at || patch.updated_at)}` })), "No patch notes yet.")}
      <h4>Known issues</h4>
      ${compactList((homepage.known_issues || []).map((issue) => ({ title: issue.title, detail: `${titleCase(issue.status)} · ${formatDate(issue.last_updated_at)}` })), "No known issues yet.")}
    </div>
  `;
}

function renderSecurityWidget(data) {
  return `
    <div class="warning">Role changes, user deletion/deactivation, database tools, and announcement publishing require Super Admin access.</div>
    <div class="admin-list">
      ${(data.audit_log || []).slice(0, 30).map((entry) => `
        <div class="operation-list-row">
          <strong>${escapeHtml(entry.action)}</strong>
          <span>${escapeHtml(entry.admin_username || "Unknown admin")} · ${escapeHtml(formatDate(entry.created_at))}</span>
        </div>
      `).join("") || '<div class="empty-state">No audit log entries yet.</div>'}
    </div>
  `;
}

function renderOperationsCenter() {
  if (!operationsCenter || !operationsData) {
    return;
  }

  const widgetBodies = {
    system_health: ["System Health", renderSystemHealth(operationsData)],
    live_activity: ["Live Activity", renderLiveActivity(operationsData)],
    user_management: ["User Management", renderOperationsUsers(operationsData)],
    feedback: ["Community Feedback", renderFeedbackWidget(operationsData)],
    feature_voting: ["Feature Voting", renderFeatureVoting(operationsData)],
    search_analytics: ["Search Analytics", renderSearchAnalytics(operationsData)],
    price_analytics: ["Price Analytics", renderPriceAnalytics(operationsData)],
    store_health: ["Store Health", renderStoreHealth(operationsData)],
    event_feed: ["Real-Time Event Feed", renderEventFeed(operationsData)],
    error_center: ["Error Center", renderErrorCenter(operationsData)],
    announcements: ["Announcements", renderAnnouncements(operationsData)],
    homepage_service: ["Homepage Service", renderHomepageServiceWidget(operationsData)],
    community_pulse: ["Community Pulse", compactList((operationsData.community_pulse || []).map((message) => ({ title: message })), "No insights yet.")],
    security: ["Security", renderSecurityWidget(operationsData)]
  };

  operationsCenter.innerHTML = orderedOperationWidgetIds()
    .map((id) => renderOperationWidget(id, widgetBodies[id]?.[0] || titleCase(id), widgetBodies[id]?.[1] || ""))
    .join("");

  bindOperationsControls();
}

function bindOperationsControls() {
  let draggedWidget = "";

  for (const widget of operationsCenter.querySelectorAll("[data-operation-widget]")) {
    widget.addEventListener("dragstart", (event) => {
      draggedWidget = widget.dataset.operationWidget;
      event.dataTransfer.effectAllowed = "move";
    });
    widget.addEventListener("dragover", (event) => event.preventDefault());
    widget.addEventListener("drop", async (event) => {
      event.preventDefault();
      const targetId = widget.dataset.operationWidget;
      if (!draggedWidget || draggedWidget === targetId) return;
      const order = orderedOperationWidgetIds().filter((id) => id !== draggedWidget);
      const index = order.indexOf(targetId);
      order.splice(index, 0, draggedWidget);
      operationsWidgetLayout.order = order;
      renderOperationsCenter();
      await saveOperationsWidgetLayout();
    });
  }

  for (const button of operationsCenter.querySelectorAll("[data-operation-widget-move]")) {
    button.addEventListener("click", async () => {
      const id = button.dataset.widgetId;
      const direction = button.dataset.operationWidgetMove;
      const order = orderedOperationWidgetIds();
      const index = order.indexOf(id);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      operationsWidgetLayout.order = order;
      renderOperationsCenter();
      await saveOperationsWidgetLayout();
    });
  }

  for (const button of operationsCenter.querySelectorAll("[data-operation-widget-size]")) {
    button.addEventListener("click", async () => {
      const id = button.dataset.operationWidgetSize;
      operationsWidgetLayout.sizes = operationsWidgetLayout.sizes || {};
      operationsWidgetLayout.sizes[id] = operationsWidgetLayout.sizes[id] === "wide" ? "compact" : "wide";
      renderOperationsCenter();
      await saveOperationsWidgetLayout();
    });
  }

  for (const button of operationsCenter.querySelectorAll("[data-operation-widget-hide]")) {
    button.addEventListener("click", async () => {
      const id = button.dataset.operationWidgetHide;
      const hidden = new Set(operationsWidgetLayout.hidden || []);
      if (hidden.has(id)) hidden.delete(id);
      else hidden.add(id);
      operationsWidgetLayout.hidden = [...hidden];
      renderOperationsCenter();
      await saveOperationsWidgetLayout();
    });
  }

  operationsCenter.querySelector("#operationsUserSearchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q") || "";
    const params = new URLSearchParams();
    const pin = getPin();
    if (pin) params.set("pin", pin);
    if (q) params.set("q", q);
    const data = await fetchJson(`/api/admin/operations/users?${params.toString()}`);
    const table = operationsCenter.querySelector("#operationsUsersTable");
    if (table) table.innerHTML = data.users.map(renderOperationsUserRow).join("");
    bindOperationsControls();
  });

  operationsCenter.querySelector("#operationsFeedbackFilterForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const pin = getPin();
    if (pin) params.set("pin", pin);
    for (const field of ["q", "status", "category"]) {
      const value = String(formData.get(field) || "").trim();
      if (value) params.set(field, value);
    }
    const data = await fetchJson(`/api/admin/operations/feedback?${params.toString()}`);
    operationsData.feedback = data;
    renderOperationsCenter();
  });

  for (const button of operationsCenter.querySelectorAll("[data-operation-user]")) {
    button.addEventListener("click", () => loadOperationUserDetail(button.dataset.operationUser));
  }

  for (const button of operationsCenter.querySelectorAll("[data-feedback-action]")) {
    button.addEventListener("click", () => updateOperationFeedback(button.dataset.feedbackId, button.dataset.feedbackAction));
  }

  for (const button of operationsCenter.querySelectorAll("[data-save-feature-status]")) {
    button.addEventListener("click", () => updateFeatureVoteStatus(button.dataset.saveFeatureStatus));
  }

  operationsCenter.querySelector("#operationsAnnouncementForm")?.addEventListener("submit", createOperationAnnouncement);
  operationsCenter.querySelector("#homepageServiceStatusForm")?.addEventListener("submit", updateHomepageServiceStatus);
  operationsCenter.querySelector("#homepagePatchNoteForm")?.addEventListener("submit", createHomepagePatchNote);
  operationsCenter.querySelector("#homepageKnownIssueForm")?.addEventListener("submit", createHomepageKnownIssue);
  operationsCenter.querySelector("[data-create-backup]")?.addEventListener("click", createDatabaseBackup);
  operationsCenter.querySelector("[data-list-backups]")?.addEventListener("click", loadDatabaseBackups);
}

async function loadDatabaseBackups() {
  const list = operationsCenter.querySelector("#operationsBackupList");
  if (!list) return;
  try {
    const data = await fetchJson("/api/admin/operations/backups");
    list.innerHTML = data.backups?.length ? data.backups.map((backup) => `<div class="operation-list-row"><strong>${escapeHtml(backup.filename || "Backup")}</strong><span>${escapeHtml(formatDate(backup.created_at))} · ${escapeHtml(titleCase(backup.status))}</span>${backup.status === "success" ? `<a class="quiet-button" href="/api/admin/operations/backups/${backup.id}/download">Download</a>` : ""}</div>`).join("") : '<div class="empty-state">No backups recorded.</div>';
  } catch (error) { list.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`; }
}

async function createDatabaseBackup() {
  if (!window.confirm("Create a verified local SQLite backup now?")) return;
  try {
    setOperationsMessage("Creating a consistent SQLite backup...");
    const data = await fetchJson("/api/admin/operations/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setOperationsMessage(data.message, "success");
    await loadDatabaseBackups();
    await loadOperationsCenter();
  } catch (error) { setOperationsMessage(error.message, "error"); }
}

async function saveOperationsWidgetLayout() {
  try {
    await fetchJson(`/api/admin/operations/widgets${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: operationsWidgetLayout })
    });
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function loadOperationUserDetail(userId) {
  try {
    const detail = await fetchJson(`/api/admin/operations/users/${encodeURIComponent(userId)}${adminQuery()}`);
    const target = operationsCenter.querySelector("#operationsUserDetail");
    if (!target) return;
    target.innerHTML = `
      <article class="admin-card compact-card">
        <div class="card-topline">
          <h4>${escapeHtml(detail.user.username)}</h4>
          <span class="badge confidence-medium">${escapeHtml(titleCase(detail.user.role))}</span>
        </div>
        <div class="operation-three-col">
          <div><h4>Activity</h4>${compactList((detail.activity_history || []).slice(0, 10).map((item) => ({ title: `${titleCase(item.type)}: ${item.title}`, detail: `${titleCase(item.status)} · ${formatDate(item.created_at)}` })), "No activity.")}</div>
          <div><h4>Verification history</h4>${compactList((detail.verification_history || []).slice(0, 10).map((item) => ({ title: titleCase(item.event_type), detail: formatDate(item.created_at) })), "No verification history.")}</div>
          <div><h4>Login history</h4>${compactList((detail.login_history || []).slice(0, 10).map((item) => ({ title: item.success ? "Successful login" : "Failed login", detail: formatDate(item.created_at) })), "No login history.")}</div>
        </div>
      </article>
    `;
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function updateOperationFeedback(ticketId, action) {
  const card = operationsCenter.querySelector(`[data-feedback-ticket="${ticketId}"]`);
  const payload = { action };

  if (card) {
    for (const field of card.querySelectorAll("[data-feedback-field]")) {
      payload[field.dataset.feedbackField] = field.value;
    }
  }

  try {
    await fetchJson(`/api/admin/operations/feedback/${encodeURIComponent(ticketId)}${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function updateFeatureVoteStatus(optionId) {
  const select = operationsCenter.querySelector(`[data-feature-status="${optionId}"]`);
  try {
    await fetchJson(`/api/admin/operations/feature-votes/${encodeURIComponent(optionId)}/status${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: select?.value || "active" })
    });
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function createOperationAnnouncement(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  try {
    await fetchJson(`/api/admin/operations/announcements${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    event.currentTarget.reset();
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function updateHomepageServiceStatus(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.maintenance_enabled = formData.has("maintenance_enabled");

  try {
    await fetchJson(`/api/admin/operations/homepage-service/status${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function createHomepagePatchNote(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  const patchId = payload.patch_id;
  delete payload.patch_id;
  payload.status = event.submitter?.value === "published" ? "published" : "draft";
  if (payload.status === "published" && !window.confirm("Publish this update publicly now? Publish only after production verification.")) return;

  try {
    await fetchJson(`/api/admin/operations/homepage-service/patch-notes${patchId ? `/${encodeURIComponent(patchId)}` : ""}${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    event.currentTarget.reset();
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

async function createHomepageKnownIssue(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    await fetchJson(`/api/admin/operations/homepage-service/known-issues${adminQuery()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    event.currentTarget.reset();
    await loadOperationsCenter();
  } catch (error) {
    setOperationsMessage(error.message, "error");
  }
}

function renderEmailSetup(status = {}, lastDiagnostic = null) {
  const technical = status.technical || {};
  const missing = Array.isArray(technical.missing) ? technical.missing : [];
  const yesNo = (value) => value ? "Yes" : "No";

  emailSetupStatus.innerHTML = `
    <article class="admin-card compact-card email-setup-card">
      <div class="card-topline">
        <span class="badge ${status.configured ? "confidence-high" : "confidence-low"}">
          ${status.configured ? "Configured" : "Not configured"}
        </span>
      </div>
      <dl class="details-list">
        <div><dt>Status</dt><dd>${status.configured ? "Configured" : "Not configured"}</dd></div>
        <div><dt>Admin alerts</dt><dd>${escapeHtml(status.adminNotifyEmail || "Not configured")}</dd></div>
        <div><dt>Last diagnostic</dt><dd>${escapeHtml(lastDiagnostic ? formatDate(lastDiagnostic.finished_at || lastDiagnostic.started_at) : "Not run")}</dd></div>
      </dl>
      <details class="technical-details">
        <summary>Show technical details</summary>
        <dl class="details-list">
          <div><dt>SMTP provider</dt><dd>${escapeHtml(status.provider || "Brevo")}</dd></div>
          <div><dt>Host configured</dt><dd>${yesNo(technical.hostConfigured)}</dd></div>
          <div><dt>Port configured</dt><dd>${yesNo(technical.portConfigured)}</dd></div>
          <div><dt>User configured</dt><dd>${yesNo(technical.userConfigured)}</dd></div>
          <div><dt>Password configured</dt><dd>${yesNo(technical.passwordConfigured)}</dd></div>
          <div><dt>SMTP user</dt><dd>${escapeHtml(technical.maskedUser || "Not configured")}</dd></div>
          <div><dt>From address</dt><dd>${escapeHtml(technical.from || "Not configured")}</dd></div>
          <div><dt>App base URL</dt><dd>${escapeHtml(status.appBaseUrl || "Not configured")}</dd></div>
          <div><dt>Missing settings</dt><dd>${missing.length ? escapeHtml(missing.join(", ")) : "None"}</dd></div>
        </dl>
      </details>
    </article>
  `;

  if (status.adminNotifyEmail && emailTestTo && !emailTestTo.value.trim()) {
    emailTestTo.value = status.adminNotifyEmail;
  }

  renderEmailDiagnostic(lastDiagnostic);
}

function betaStatusClass(status) {
  const normalized = String(status || "").toLowerCase().replace(/\s+/g, "-");

  if (normalized === "ready") {
    return "status-ready";
  }

  if (normalized === "critical") {
    return "status-critical";
  }

  if (normalized === "needs-setup") {
    return "status-needs-setup";
  }

  return "status-warning";
}

function renderCountDetails(counts = {}) {
  const entries = Object.entries(counts);

  if (!entries.length) {
    return "";
  }

  return `
    <dl class="details-list beta-counts">
      ${entries.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(titleCase(label))}</dt>
          <dd>${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

function renderBetaAction(action = {}) {
  const type = action.type || "";
  const target = action.target || "";
  const label = action.label || "Open";
  const buttonClass = type === "diagnostic" ? "secondary-button" : "quiet-button";

  return `
    <button class="${buttonClass}" type="button" data-beta-action-type="${escapeHtml(type)}" data-beta-action-target="${escapeHtml(target)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function bindBetaActions(container) {
  for (const button of container.querySelectorAll("[data-beta-action-type]")) {
    button.addEventListener("click", () => {
      const type = button.dataset.betaActionType;
      const target = button.dataset.betaActionTarget;

      if (type === "tab") {
        goToAdminTab(target);
        return;
      }

      if (type === "page") {
        window.open(target, "_blank", "noopener");
        return;
      }

      if (type === "diagnostic") {
        goToAdminTab("emailTab");
        runEmailDiagnostic();
      }
    });
  }
}

function renderPhoneTesting(phone = {}) {
  phoneTestingCard.innerHTML = `
    <article class="admin-card compact-card phone-testing-card">
      <div class="card-topline">
        <h3>Phone Testing</h3>
        <span class="badge status-${phone.host === "0.0.0.0" ? "ready" : "warning"}">${phone.host === "0.0.0.0" ? "LAN ready" : "Check HOST"}</span>
      </div>
      <ol class="phone-steps">
        <li>Make sure your phone and Mac are on the same Wi-Fi.</li>
        <li>Find your Mac IP in Terminal: <code>${escapeHtml(phone.findIpCommand || "ipconfig getifaddr en0")}</code></li>
        <li>Open on phone: <code>${escapeHtml(phone.phoneUrl || "http://YOUR-MAC-IP:3000")}</code></li>
        <li>Admin: <code>${escapeHtml(phone.adminPhoneUrl || "http://YOUR-MAC-IP:3000/admin.html")}</code></li>
      </ol>
      <p class="field-help">${escapeHtml(phone.firewallHint || "If phone cannot connect, the server may need HOST=0.0.0.0 or the Mac firewall may be blocking Node.")}</p>
      <dl class="details-list">
        <div><dt>Local URL</dt><dd>${escapeHtml(phone.localUrl || "http://localhost:3000")}</dd></div>
        <div><dt>Host</dt><dd>${escapeHtml(phone.host || "unknown")}</dd></div>
        <div><dt>Port</dt><dd>${escapeHtml(phone.port || "3000")}</dd></div>
        <div><dt>APP_BASE_URL</dt><dd>${escapeHtml(phone.appBaseUrl || "http://localhost:3000")}</dd></div>
      </dl>
    </article>
  `;
}

function renderBetaReadiness(data = {}) {
  if (!betaReadinessSummary || !phoneTestingCard || !betaChecklist) {
    return;
  }

  const summary = data.summary || {};
  const checks = data.checks || [];
  const summaryRows = [
    ["Ready", summary.ready || 0, "status-ready"],
    ["Warning", summary.warning || 0, "status-warning"],
    ["Critical", summary.critical || 0, "status-critical"],
    ["Needs setup", summary.needs_setup || 0, "status-needs-setup"]
  ];

  betaReadinessGenerated.textContent = data.generated_at
    ? `Updated ${formatDate(data.generated_at)}`
    : "";
  betaReadinessSummary.innerHTML = summaryRows
    .map(([label, value, className]) => `
      <article class="notification-card beta-summary-card">
        <strong class="${className}">${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </article>
    `)
    .join("");

  renderPhoneTesting(data.phone_testing || {});

  betaChecklist.innerHTML = checks.length
    ? checks.map((check) => `
      <article class="admin-card compact-card beta-check-card">
        <div class="card-topline">
          <h3>${escapeHtml(check.label)}</h3>
          <span class="badge ${betaStatusClass(check.status)}">${escapeHtml(check.status)}</span>
        </div>
        <p>${escapeHtml(check.explanation || "")}</p>
        ${check.reminder ? `<div class="inline-help">${escapeHtml(check.reminder)}</div>` : ""}
        ${renderCountDetails(check.counts)}
        ${Array.isArray(check.actions) && check.actions.length ? `
          <div class="card-actions beta-actions">
            ${check.actions.map(renderBetaAction).join("")}
          </div>
        ` : ""}
      </article>
    `).join("")
    : '<div class="empty-state">Beta readiness checklist is not available yet.</div>';

  bindBetaActions(betaChecklist);
}

function renderMiniTable(title, rows = [], columns = [], emptyText = "No aggregate data yet.", missingActions = false) {
  return `
    <article class="admin-card compact-card">
      <h3>${escapeHtml(title)}</h3>
      ${rows.length ? `
        <div class="analytics-table">
          ${rows.map((row) => `
            <div class="mini-row">
              <div>
                <strong>${escapeHtml(row[columns[0].key] || "Unknown")}</strong>
                <span>${columns.slice(1).map((column) => `${column.label}: ${escapeHtml(row[column.key] ?? "")}`).join(" · ")}</span>
              </div>
              ${missingActions && row.item_name ? `
                <div class="card-actions">
                  <button class="quiet-button" type="button" data-missing-action="priority" data-missing-item="${escapeHtml(row.item_name)}" data-missing-category="${escapeHtml(row.category || "")}">Mark priority</button>
                  <button class="quiet-button" type="button" data-missing-action="manual_price_needed" data-missing-item="${escapeHtml(row.item_name)}" data-missing-category="${escapeHtml(row.category || "")}">Add manual price</button>
                  <button class="quiet-button" type="button" data-missing-action="suggested_quick_item" data-missing-item="${escapeHtml(row.item_name)}" data-missing-category="${escapeHtml(row.category || "")}">Add to quick items</button>
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty-state">${escapeHtml(emptyText)}</div>`}
    </article>
  `;
}

function renderAnalytics(data = {}) {
  const cards = data.cards || {};
  const summaryRows = [
    ["Total users", cards.total_users || cards.total_registered_users || 0],
    ["Active contributors", cards.active_contributors || 0],
    ["Approved prices", cards.total_approved_prices || 0],
    ["Products with prices", cards.products_with_approved_prices || 0],
    ["Stores with prices", cards.stores_with_prices || 0],
    ["Pending proofs", cards.pending_proofs || 0],
    ["Accepted proofs", cards.accepted_proofs || 0],
    ["Proofs used for prices", cards.proofs_used_for_prices || 0],
    ["Needs clearer photo", cards.needs_clearer_photo_count || 0],
    ["Rejected proofs", cards.rejected_proof_count || 0],
    ["Duplicate proofs", cards.duplicate_proof_count || 0],
    ["Points total", cards.points_awarded_total || 0],
    ["Points this week", cards.points_awarded_this_week || 0],
    ["Approval rate", `${cards.approval_rate || 0}%`],
    ["Rejection rate", `${cards.rejection_rate || 0}%`],
    ["Admin accounts", cards.admin_accounts || 0]
  ];

  analyticsSummary.innerHTML = summaryRows
    .map(([label, value]) => `
      <article class="notification-card">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </article>
    `)
    .join("");

  analyticsContent.innerHTML = `
    <div class="inline-help">${escapeHtml(data.privacy_note || "Analytics are aggregate counts only.")}</div>
    ${data.admin_account_audit?.cleanup_needed ? `<div class="warning">${escapeHtml(data.admin_account_audit.recommendation || "Review admin account cleanup.")}</div>` : ""}
    ${renderMiniTable("Proof type breakdown", data.proof_type_breakdown || [], [
      { key: "proof_type", label: "Proof type" },
      { key: "count", label: "Count" }
    ])}
    ${renderMiniTable("Top products by approved prices", data.top_approved_products || [], [
      { key: "product_name", label: "Product" },
      { key: "approved_prices", label: "Approved prices" },
      { key: "lowest_price", label: "Lowest price" }
    ])}
    ${renderMiniTable("Approved price categories", data.top_approved_categories || [], [
      { key: "category", label: "Category" },
      { key: "approved_prices", label: "Approved prices" }
    ])}
    <article class="admin-card compact-card">
      <h3>Public data health</h3>
      ${renderCountDetails(data.public_data_health || {})}
    </article>
    ${renderMiniTable("Most searched items", data.most_searched_items || [], [
      { key: "item_name", label: "Item" },
      { key: "count", label: "Searches" }
    ])}
    ${renderMiniTable("Most viewed products", data.most_viewed_products || [], [
      { key: "product_name", label: "Product" },
      { key: "count", label: "Views" }
    ])}
    ${renderMiniTable("Most added-to-cart items", data.most_added_to_cart_items || [], [
      { key: "item_name", label: "Item" },
      { key: "count", label: "Adds" },
      { key: "category", label: "Category" }
    ])}
    ${renderMiniTable("People need prices for", data.most_missing_price_items || [], [
      { key: "item_name", label: "Item" },
      { key: "count", label: "Requests" },
      { key: "category", label: "Category" },
      { key: "priority_status", label: "Status" }
    ], "No missing-price demand yet.", true)}
    ${renderMiniTable("Most compared categories", data.most_compared_categories || [], [
      { key: "category", label: "Category" },
      { key: "count", label: "Count" }
    ])}
    ${renderMiniTable("Stores with most approved reports", data.stores_with_most_approved_reports || [], [
      { key: "name", label: "Store" },
      { key: "approved_reports", label: "Approved reports" }
    ])}
    ${renderMiniTable("Stores with missing requested items", data.stores_with_missing_requested_items || [], [
      { key: "name", label: "Store" },
      { key: "count", label: "Missing requests" }
    ], "Missing demand is item-level for now, not store-specific.")}
    ${renderMiniTable("Top categories", data.top_categories || [], [
      { key: "category", label: "Category" },
      { key: "count", label: "Count" }
    ])}
    ${renderMiniTable("Popular avoid ingredients", data.popular_avoid_ingredients || [], [
      { key: "ingredient", label: "Ingredient" },
      { key: "count", label: "Count" }
    ], "No aggregate avoid ingredient data yet.")}
  `;

  for (const button of analyticsContent.querySelectorAll("[data-missing-action]")) {
    button.addEventListener("click", () => handleMissingDemandAction(button));
  }
}

async function handleMissingDemandAction(button) {
  const action = button.dataset.missingAction;
  const itemName = button.dataset.missingItem;
  const category = button.dataset.missingCategory || "";

  if (action === "manual_price_needed") {
    goToAdminTab("manualTab");
    const itemInput = manualEntryForm.querySelector("[name='item_name']");
    if (itemInput) {
      itemInput.value = itemName;
    }
  }

  try {
    const data = await fetchJson("/api/admin/analytics/missing-demand/priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        item_name: itemName,
        category,
        status: action,
        admin_note: `Marked from Analytics as ${action}`
      })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

function sponsorPayloadFromForm() {
  const formData = new FormData(sponsorForm);

  return {
    sponsor_id: formData.get("sponsor_id"),
    sponsor_name: formData.get("sponsor_name"),
    sponsor_type: formData.get("sponsor_type"),
    title: formData.get("title"),
    message: formData.get("message"),
    link_url: formData.get("link_url"),
    image_url: formData.get("image_url"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    status: formData.get("status"),
    weekly_price_note: formData.get("weekly_price_note"),
    admin_note: formData.get("admin_note")
  };
}

function fillSponsorForm(sponsor = {}) {
  sponsorForm.elements.sponsor_id.value = sponsor.id || "";
  sponsorForm.elements.sponsor_name.value = sponsor.sponsor_name || "";
  sponsorForm.elements.sponsor_type.value = sponsor.sponsor_type || "business";
  sponsorForm.elements.status.value = sponsor.status || "draft";
  sponsorForm.elements.title.value = sponsor.title || "";
  sponsorForm.elements.message.value = sponsor.message || "";
  sponsorForm.elements.link_url.value = sponsor.link_url || "";
  sponsorForm.elements.image_url.value = sponsor.image_url || "";
  sponsorForm.elements.starts_at.value = sponsor.starts_at ? String(sponsor.starts_at).slice(0, 10) : "";
  sponsorForm.elements.ends_at.value = sponsor.ends_at ? String(sponsor.ends_at).slice(0, 10) : "";
  sponsorForm.elements.weekly_price_note.value = sponsor.weekly_price_note || "";
  sponsorForm.elements.admin_note.value = sponsor.admin_note || "";
}

function renderSponsors(data = {}) {
  const sponsors = data.sponsors || [];

  sponsorsContent.innerHTML = `
    <div class="inline-help">${escapeHtml(data.privacy_note || "Sponsor stats are anonymous aggregate counts.")}</div>
    ${sponsors.length ? sponsors.map((sponsor) => `
      <article class="admin-card compact-card">
        <div class="card-topline">
          <h3>${escapeHtml(sponsor.title)}</h3>
          <span class="badge confidence-${sponsor.status === "active" ? "high" : "low"}">${escapeHtml(titleCase(sponsor.status))}</span>
        </div>
        <dl class="details-list">
          <div><dt>Sponsor</dt><dd>${escapeHtml(sponsor.sponsor_name)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(titleCase(sponsor.sponsor_type))}</dd></div>
          <div><dt>Message</dt><dd>${escapeHtml(sponsor.message)}</dd></div>
          <div><dt>Link</dt><dd>${escapeHtml(sponsor.link_url || "None")}</dd></div>
          <div><dt>Active dates</dt><dd>${escapeHtml(sponsor.starts_at || "No start")} to ${escapeHtml(sponsor.ends_at || "No end")}</dd></div>
          <div><dt>Views</dt><dd>${sponsor.stats.views}</dd></div>
          <div><dt>Clicks</dt><dd>${sponsor.stats.clicks}</dd></div>
          <div><dt>Interested taps</dt><dd>${sponsor.stats.interested}</dd></div>
          <div><dt>Not interested taps</dt><dd>${sponsor.stats.not_interested}</dd></div>
          <div><dt>Admin note</dt><dd>${escapeHtml(sponsor.admin_note || "None")}</dd></div>
        </dl>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-edit-sponsor="${sponsor.id}">Edit</button>
          <button class="quiet-button" type="button" data-sponsor-status="active" data-sponsor-id="${sponsor.id}">Activate</button>
          <button class="quiet-button" type="button" data-sponsor-status="paused" data-sponsor-id="${sponsor.id}">Pause</button>
          <button class="quiet-button" type="button" data-sponsor-status="expired" data-sponsor-id="${sponsor.id}">Expire</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">No sponsor cards yet.</div>'}
  `;

  for (const button of sponsorsContent.querySelectorAll("[data-edit-sponsor]")) {
    button.addEventListener("click", () => {
      const sponsor = sponsors.find((item) => String(item.id) === button.dataset.editSponsor);
      fillSponsorForm(sponsor);
      sponsorForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  for (const button of sponsorsContent.querySelectorAll("[data-sponsor-status]")) {
    button.addEventListener("click", () => updateSponsorStatus(button.dataset.sponsorId, button.dataset.sponsorStatus));
  }
}

async function saveSponsor(event) {
  event.preventDefault();
  const payload = sponsorPayloadFromForm();
  const sponsorId = payload.sponsor_id;
  delete payload.sponsor_id;

  try {
    const data = await fetchJson(sponsorId ? `/api/admin/sponsors/${sponsorId}` : "/api/admin/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), ...payload })
    });
    sponsorForm.reset();
    setMessage(sponsorMessage, data.message, "success");
    await loadAdminData();
  } catch (error) {
    setMessage(sponsorMessage, error.message, "error");
  }
}

async function updateSponsorStatus(sponsorId, status) {
  try {
    const data = await fetchJson(`/api/admin/sponsors/${sponsorId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        status_only: true,
        status
      })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

function reportWarnings(report) {
  const warnings = [];

  if (report.proof_type !== "no_photo" && !report.photo_path) {
    warnings.push("photo proof selected but no upload");
  }

  if (report.price > 100 && report.proof_type === "no_photo") {
    warnings.push("high price without photo");
  }

  if (report.dispute_count > 0) {
    warnings.push("has disputes");
  }

  if (Array.isArray(report.suspicious_activity)) {
    warnings.push(...report.suspicious_activity);
  }

  return [...new Set(warnings)];
}

function proofPreview(report) {
  const proofUrl = adminUploadUrl(report.photo_path);

  if (!proofUrl) {
    return '<div class="inline-help">No uploaded photo proof.</div>';
  }

  return `
    <div class="proof-preview admin-proof-preview">
      <img src="${escapeHtml(proofUrl)}" alt="Uploaded proof for ${escapeHtml(report.item_name)}">
      <a class="quiet-button" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Open proof</a>
    </div>
  `;
}

function reportSummary(report) {
  return `
    <div class="card-topline">
      <span class="badge confidence-${escapeHtml(report.confidence)}">${escapeHtml(titleCase(report.confidence))}</span>
      <span>${escapeHtml(titleCase(report.status))}</span>
    </div>
    <h3>${escapeHtml(report.item_name)}</h3>
    <div class="brand-line">${escapeHtml(report.brand || "No brand entered")}</div>
    <dl class="details-list">
      <div><dt>Store</dt><dd>${escapeHtml(report.store_name)}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(titleCase(report.category))}</dd></div>
      <div><dt>Price</dt><dd>${escapeHtml(report.price_label)} / ${escapeHtml(report.unit_price_label)}</dd></div>
      <div><dt>Size</dt><dd>${escapeHtml(report.size_text || `${report.quantity} ${report.unit}`)}</dd></div>
      <div><dt>Proof</dt><dd>${escapeHtml(titleCase(report.proof_type))}</dd></div>
      <div><dt>Source</dt><dd>${report.source_url ? `<a href="${escapeHtml(report.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(report.source_domain || "View source")}</a>` : "None"}</dd></div>
      <div><dt>Submitted by</dt><dd>${escapeHtml(report.username || "Unknown")}</dd></div>
      <div><dt>Submitted</dt><dd>${escapeHtml(formatDate(report.submitted_at))}</dd></div>
    </dl>
    ${proofPreview(report)}
  `;
}

function reportTechnicalDetails(report) {
  const warnings = reportWarnings(report);

  return `
    <details class="technical-details">
      <summary>Show technical details</summary>
      <dl class="details-list">
        <div><dt>Report ID</dt><dd>${report.id}</dd></div>
        <div><dt>User ID</dt><dd>${report.user_id}</dd></div>
        <div><dt>User email</dt><dd>${escapeHtml(report.user_email || "No email")}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(report.status)}</dd></div>
        <div><dt>Confidence score</dt><dd>${escapeHtml(report.confidence)}</dd></div>
        <div><dt>Photo path/status</dt><dd>${escapeHtml(report.photo_path || "No photo")}</dd></div>
        <div><dt>Created at</dt><dd>${escapeHtml(formatDate(report.submitted_at))}</dd></div>
        <div><dt>Reviewed at</dt><dd>${escapeHtml(formatDate(report.reviewed_at) || "Not reviewed")}</dd></div>
        <div><dt>Verification count</dt><dd>${report.verification_count}</dd></div>
        <div><dt>Dispute count</dt><dd>${report.dispute_count}</dd></div>
        <div><dt>Raw quantity/unit</dt><dd>${escapeHtml(`${report.quantity} ${report.unit}`)}</dd></div>
        <div><dt>Edited at</dt><dd>${escapeHtml(formatDate(report.last_edited_at || report.edited_at) || "Not edited")}</dd></div>
        <div><dt>Edit note</dt><dd>${escapeHtml(report.edit_note || report.admin_edit_note || "None")}</dd></div>
        <div><dt>Ingredient link</dt><dd>${escapeHtml(report.ingredient_info_url || "None")}</dd></div>
        <div><dt>Allergen note</dt><dd>${escapeHtml(report.allergen_note || "None")}</dd></div>
        <div><dt>Photo file</dt><dd>${escapeHtml(report.photo_original_name || "None")} (${escapeHtml(report.photo_mime_type || "none")}, ${escapeHtml(formatBytes(report.photo_size_bytes))})</dd></div>
        <div><dt>Validation warnings</dt><dd>${warnings.length ? escapeHtml(warnings.join(", ")) : "None"}</dd></div>
      </dl>
    </details>
  `;
}

function reportEditControls(report, mode) {
  return `
    <details class="technical-details report-edit-details">
      <summary>${mode === "review" ? "Edit before approving" : "Edit price"}</summary>
      <div class="admin-control-grid" data-edit-form="${report.id}">
        <label><span>Item</span><input data-edit-field="item_name" type="text" maxlength="120" value="${escapeHtml(report.item_name)}"></label>
        <label><span>Brand</span><input data-edit-field="brand" type="text" maxlength="80" value="${escapeHtml(report.brand)}"></label>
        <label><span>Linked product</span><select data-edit-field="product_id">${productOptions(report.product_id)}</select></label>
        <label><span>Store</span><select data-edit-field="store_id">${allStores.map((store) => `<option value="${store.id}" ${store.id === report.store_id ? "selected" : ""}>${escapeHtml(store.name)}</option>`).join("")}</select></label>
        <label><span>Category</span><select data-edit-field="category">${optionRows(categories, report.category)}</select></label>
        <label><span>Price</span><input data-edit-field="price" type="number" min="0.01" max="999" step="0.01" value="${escapeHtml(report.price)}"></label>
        <label><span>Regular price</span><input data-edit-field="regular_price" type="number" min="0.01" max="999" step="0.01" value="${report.regular_price === null ? "" : escapeHtml(report.regular_price)}"></label>
        <label><span>Size</span><input data-edit-field="size_text" type="text" maxlength="80" value="${escapeHtml(report.size_text)}"></label>
        <label><span>Quantity</span><input data-edit-field="quantity" type="number" min="0.01" step="0.01" value="${escapeHtml(report.quantity)}"></label>
        <label><span>Unit</span><select data-edit-field="unit">${optionRows(["each", "count", "ct", "oz", "lb", "fl oz", "gallon", "pack", "roll", "bottle", "can", "bag"], report.unit)}</select></label>
        <label><span>Proof</span><select data-edit-field="proof_type">${optionRows(["shelf_tag_photo", "receipt_photo", "weekly_ad", "no_photo"], report.proof_type)}</select></label>
        <label><span>Product link</span><input data-edit-field="official_product_url" type="url" maxlength="300" value="${escapeHtml(report.official_product_url || "")}"></label>
        <label><span>Allergy link</span><input data-edit-field="ingredient_info_url" type="url" maxlength="300" value="${escapeHtml(report.ingredient_info_url || "")}"></label>
        <label class="span-full"><span>Allergen note</span><input data-edit-field="allergen_note" type="text" maxlength="500" value="${escapeHtml(report.allergen_note || "")}"></label>
        <label class="span-full"><span>Admin safety note</span><input data-edit-field="admin_safety_note" type="text" maxlength="500" value="${escapeHtml(report.admin_safety_note || "")}"></label>
        <label class="span-full"><span>Notes</span><textarea data-edit-field="notes" rows="3" maxlength="500">${escapeHtml(report.notes)}</textarea></label>
        <label class="span-full"><span>Audit note</span><input data-edit-field="admin_edit_note" type="text" maxlength="500" placeholder="Why this edit was made"></label>
        <button class="secondary-button" type="button" data-edit-report="${report.id}" data-approve-after-edit="0">Save edits</button>
        ${mode === "review" ? `<button class="primary-button" type="button" data-edit-report="${report.id}" data-approve-after-edit="1">Save edits and approve</button>` : ""}
      </div>
    </details>
  `;
}

function reportActionControls(report, mode) {
  if (mode === "review") {
    return `
      <div class="card-actions">
        <button class="secondary-button" type="button" data-status="approved" data-id="${report.id}">Approve</button>
        <button class="quiet-button" type="button" data-status="needs_proof" data-id="${report.id}">Needs proof</button>
        <button class="quiet-button" type="button" data-status="needs_update" data-id="${report.id}">Needs update</button>
        <button class="quiet-button" type="button" data-status="disputed" data-id="${report.id}">Mark disputed</button>
        <button class="danger-button" type="button" data-status="removed" data-id="${report.id}">Remove</button>
      </div>
      ${reportEditControls(report, "review")}
      <div class="admin-control-grid">
        <label>
          <span>Reject reason</span>
          <select data-rejection-reason="${report.id}">
            <option value="">Choose reason</option>
            ${optionRows(rejectionReasons, report.admin_rejection_reason)}
          </select>
        </label>
        <label>
          <span>Admin note</span>
          <input data-rejection-note="${report.id}" type="text" maxlength="500" value="${escapeHtml(report.admin_rejection_note || "")}">
        </label>
        <button class="danger-button" type="button" data-status="rejected" data-id="${report.id}">Reject with reason</button>
      </div>
      <div class="card-actions">
        <button class="quiet-button" type="button" data-view-user="${report.user_id}">View user history</button>
        <button class="danger-button" type="button" data-ban-user="${report.user_id}">Ban user</button>
      </div>
    `;
  }

  if (mode === "approved") {
    return `
      <div class="card-actions">
        <button class="quiet-button" type="button" data-status="expired" data-id="${report.id}">Mark expired</button>
        <button class="quiet-button" type="button" data-status="needs_update" data-id="${report.id}">Needs update</button>
        <button class="danger-button" type="button" data-status="removed" data-id="${report.id}">Remove from public</button>
        ${report.photo_path ? `<a class="quiet-button" href="${escapeHtml(adminUploadUrl(report.photo_path))}" target="_blank" rel="noopener">View proof</a>` : ""}
      </div>
      ${reportEditControls(report, "approved")}
    `;
  }

  return "";
}

function renderReportCard(report, mode) {
  const historyDetails = mode === "history"
    ? `
      <dl class="details-list">
        <div><dt>Reason</dt><dd>${escapeHtml(report.admin_rejection_reason || titleCase(report.status))}</dd></div>
        <div><dt>Note</dt><dd>${escapeHtml(report.admin_rejection_note || "None")}</dd></div>
        <div><dt>Reviewer</dt><dd>${escapeHtml(report.reviewed_by_username || "Unknown")}</dd></div>
        <div><dt>Review date</dt><dd>${escapeHtml(formatDate(report.reviewed_at) || "Not reviewed")}</dd></div>
      </dl>
    `
    : "";

  return `
    <article class="admin-card" data-report-card="${report.id}">
      ${reportSummary(report)}
      ${historyDetails}
      ${reportTechnicalDetails(report)}
      ${reportActionControls(report, mode)}
    </article>
  `;
}

function bindReportActions(container) {
  for (const button of container.querySelectorAll("[data-status]")) {
    button.addEventListener("click", () => {
      updateReportStatus(button.dataset.id, button.dataset.status);
    });
  }

  for (const button of container.querySelectorAll("[data-view-user]")) {
    button.addEventListener("click", () => {
      goToAdminTab("usersTab", { userId: button.dataset.viewUser });
      setAdminMessage(`Viewing users. User ID ${button.dataset.viewUser} is associated with that report.`, "info");
    });
  }

  for (const button of container.querySelectorAll("[data-ban-user]")) {
    button.addEventListener("click", () => {
      moderateUser(button.dataset.banUser, "banned");
    });
  }

  for (const button of container.querySelectorAll("[data-edit-report]")) {
    button.addEventListener("click", () => {
      editReport(button.dataset.editReport, button.dataset.approveAfterEdit === "1");
    });
  }
}

function renderReportList(container, reports, mode, emptyText) {
  if (!reports.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = reports.map((report) => renderReportCard(report, mode)).join("");
  bindReportActions(container);
}

function renderReportTabs() {
  const pending = allReports.filter((report) => report.status === "pending");
  const approved = allReports.filter((report) => report.status === "approved");
  const history = allReports.filter((report) =>
    ["rejected", "disputed", "removed", "expired", "needs_proof", "needs_update"].includes(report.status)
  );
  const filteredHistory = adminHistoryFilter === "disputed"
    ? history.filter((report) => report.status === "disputed" || report.dispute_count > 0)
    : history;

  document.querySelector("#reviewCount").textContent = `${pending.length} pending`;
  document.querySelector("#approvedCount").textContent = `${approved.length} live`;
  document.querySelector("#historyCount").textContent = adminHistoryFilter === "disputed"
    ? `${filteredHistory.length} disputed`
    : `${history.length} records`;

  renderReportList(reviewReports, pending, "review", "No pending reports.");
  renderReportList(approvedReports, approved, "approved", "No approved reports.");
  renderReportList(
    historyReports,
    filteredHistory,
    "history",
    adminHistoryFilter === "disputed" ? "No disputed reports." : "No rejected, disputed, or removed reports."
  );
}

function renderUsernameModeration() {
  if (!usernameBlockedPhrases) {
    return;
  }

  const phrases = usernameModerationData.phrases || [];

  if (!phrases.length) {
    usernameBlockedPhrases.innerHTML = '<div class="empty-state">No custom blocked username phrases yet.</div>';
    return;
  }

  usernameBlockedPhrases.innerHTML = phrases.map((phrase) => `
    <article class="admin-card compact-card">
      <div class="card-topline">
        <strong>${escapeHtml(phrase.phrase)}</strong>
        <span>${escapeHtml(formatDate(phrase.created_at))}</span>
      </div>
      <p class="field-help">${escapeHtml(phrase.reason || "Blocked by username moderation.")}</p>
      <div class="card-actions">
        <button class="danger-button" type="button" data-remove-username-phrase="${phrase.id}">Remove</button>
      </div>
    </article>
  `).join("");

  for (const button of usernameBlockedPhrases.querySelectorAll("[data-remove-username-phrase]")) {
    button.addEventListener("click", () => removeUsernamePhrase(button.dataset.removeUsernamePhrase));
  }
}

function renderAdminAccessCleanup(data = {}) {
  if (!adminAccessCleanup) {
    return;
  }

  const accounts = data.accounts || [];
  const canChangeRoles = Boolean(adminSession?.loggedIn && adminSession?.is_super_admin);
  const warning = data.multiple_admins
    ? "Multiple admin accounts found. Review Admin Access Cleanup before beta."
    : "Admin access count looks safe.";

  adminAccessCleanup.innerHTML = `
    <div class="${data.cleanup_needed ? "warning" : "inline-help"}">${escapeHtml(warning)}</div>
    <div class="inline-help">${escapeHtml(data.recommendation || "Choose the trusted owner before changing admin access.")}</div>
    ${canChangeRoles ? "" : '<div class="warning">Log in as Owner / Super Admin to change admin access. The ADMIN_PIN fallback cannot demote, promote, or suspend admin accounts.</div>'}
    ${accounts.length ? accounts.map((account) => `
      <article class="admin-card compact-card" data-admin-account-card="${account.id}">
        <div class="card-topline">
          <h4>${escapeHtml(account.username)}</h4>
          <span class="badge ${account.is_super_admin ? "confidence-high" : account.admin_capable ? "status-warning" : "status-ready"}">${escapeHtml(account.is_super_admin ? "Super Admin" : titleCase(account.role))}</span>
        </div>
        <dl class="details-list">
          <div><dt>User ID</dt><dd>${account.id}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(account.email || "No email")}</dd></div>
          <div><dt>Super Admin</dt><dd>${account.is_super_admin ? "Yes" : "No"}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(titleCase(account.account_status || "active"))}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(account.created_at) || "Unknown")}</dd></div>
          <div><dt>Last active</dt><dd>${escapeHtml(formatDate(account.last_active_at) || "Unknown")}</dd></div>
          <div><dt>Test/dev?</dt><dd>${account.is_test_or_dev ? `Yes — ${escapeHtml(account.test_or_dev_reason)}` : "No obvious signal"}</dd></div>
          <div><dt>Approved reports</dt><dd>${account.counts?.approved_reports || 0}</dd></div>
          <div><dt>Reviewed reports</dt><dd>${account.counts?.reviewed_reports || 0}</dd></div>
          <div><dt>Imports created</dt><dd>${account.counts?.import_batches || 0}</dd></div>
          <div><dt>Import rows approved</dt><dd>${account.counts?.approved_import_rows || 0}</dd></div>
          <div><dt>Point events</dt><dd>${account.counts?.point_events || 0}</dd></div>
          <div><dt>Admin point events</dt><dd>${account.counts?.admin_point_events || 0}</dd></div>
        </dl>
        <div class="card-actions">
          ${account.admin_capable ? `
            <button class="danger-button" type="button" data-admin-role-action="demote_admin" data-admin-role-user="${account.id}" ${canChangeRoles ? "" : "disabled"}>
              Demote to user
            </button>
          ` : `
            <button class="quiet-button" type="button" data-admin-role-action="promote_admin" data-admin-role-user="${account.id}" ${canChangeRoles ? "" : "disabled"}>
              Promote to admin
            </button>
          `}
          ${account.is_test_or_dev ? `
            <button class="danger-button" type="button" data-admin-role-action="suspend_test" data-admin-role-user="${account.id}" ${canChangeRoles ? "" : "disabled"}>
              Suspend test account
            </button>
          ` : ""}
        </div>
      </article>
    `).join("") : '<div class="empty-state">No admin-capable or staff-like accounts found.</div>'}
  `;

  for (const button of adminAccessCleanup.querySelectorAll("[data-admin-role-action]")) {
    button.addEventListener("click", () => updateAdminAccountRole(button.dataset.adminRoleUser, button.dataset.adminRoleAction));
  }
}

function renderUsers(users) {
  if (!users.length) {
    adminUsers.innerHTML = '<div class="empty-state">No users yet.</div>';
    return;
  }

  adminUsers.innerHTML = users
    .map((user) => `
      <article class="admin-card compact-card" data-user-card="${user.id}">
        <h3>${escapeHtml(user.username)}</h3>
        <dl class="details-list">
          <div><dt>User ID</dt><dd>${user.id}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(user.email || "No email")}</dd></div>
          <div><dt>Email verified</dt><dd>${user.email_verified ? "Yes" : "No"}</dd></div>
          <div><dt>Admin</dt><dd>${user.is_admin ? "Yes" : "No"}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(titleCase(user.account_status || "active"))}</dd></div>
          <div><dt>Points</dt><dd>${user.points}</dd></div>
          <div><dt>Trust</dt><dd>${escapeHtml(user.trust_level || "new/normal")}</dd></div>
          <div><dt>Username safety</dt><dd>${escapeHtml(user.username_status || "approved")}</dd></div>
          <div><dt>Username note</dt><dd>${escapeHtml(user.username_moderation_note || "None")}</dd></div>
          <div><dt>Accuracy</dt><dd>${user.accuracy_score || 0}%</dd></div>
          <div><dt>Reports</dt><dd>${user.report_count || 0}</dd></div>
          <div><dt>Approved</dt><dd>${user.approved_report_count || 0}</dd></div>
          <div><dt>Rejected</dt><dd>${user.rejected_report_count || 0}</dd></div>
          <div><dt>Disputed</dt><dd>${user.disputed_submissions || 0}</dd></div>
          <div><dt>Verifications</dt><dd>${user.verification_count || 0}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(user.created_at))}</dd></div>
          <div><dt>Last activity</dt><dd>${escapeHtml(formatDate(user.last_activity_at) || "Unknown")}</dd></div>
          <div><dt>Avoid list</dt><dd>${escapeHtml(user.avoid_ingredients || "None")}</dd></div>
          <div><dt>Admin note</dt><dd>${escapeHtml(user.admin_note || user.latest_admin_note || "None")}</dd></div>
        </dl>
        <div class="flag-row">
          ${user.suspicious_activity_notes.length
            ? user.suspicious_activity_notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")
            : "<span>No flags</span>"}
        </div>
        <div class="admin-control-grid">
          <button class="quiet-button" type="button" data-user-action="warning" data-user-id="${user.id}">Warn</button>
          <button class="quiet-button" type="button" data-user-action="suspended" data-user-id="${user.id}">Suspend</button>
          <button class="quiet-button" type="button" data-user-action="deactivated" data-user-id="${user.id}">Deactivate</button>
          <button class="quiet-button" type="button" data-user-action="active" data-user-id="${user.id}">Set active</button>
          <button class="quiet-button" type="button" data-user-action="${user.hide_from_leaderboard ? "show_leaderboard" : "hide_leaderboard"}" data-user-id="${user.id}">
            ${user.hide_from_leaderboard ? "Show leaderboard" : "Hide leaderboard"}
          </button>
          <button class="quiet-button" type="button" data-user-action="force_username_change" data-user-id="${user.id}">Require new username</button>
          <button class="quiet-button" type="button" data-user-action="approve_username" data-user-id="${user.id}">Approve username</button>
          <button class="quiet-button" type="button" data-user-flag="is_email_verified" data-user-flag-value="${user.email_verified ? "0" : "1"}" data-user-id="${user.id}">
            ${user.email_verified ? "Mark unverified" : "Mark verified"}
          </button>
          <button class="quiet-button" type="button" data-jump-admin-cleanup="${user.id}">Admin cleanup</button>
          <button class="danger-button" type="button" data-reset-user="${user.id}">Reset points</button>
        </div>
        <div class="admin-control-grid" data-point-adjust="${user.id}">
          <label>
            <span>Point adjustment</span>
            <input data-point-adjust-field="points" type="number" step="1" min="-1000" max="1000" placeholder="+5 or -5">
          </label>
          <label>
            <span>Reason required</span>
            <input data-point-adjust-field="reason" type="text" maxlength="300" placeholder="Approved proof correction, abuse cleanup">
          </label>
          <label class="span-full">
            <span>Admin note optional</span>
            <input data-point-adjust-field="admin_note" type="text" maxlength="500" placeholder="Internal audit note">
          </label>
          <button class="secondary-button" type="button" data-adjust-points="${user.id}">Save point adjustment</button>
          <button class="quiet-button" type="button" data-view-points="${user.id}">View point history</button>
        </div>
        <div class="admin-control-grid" data-user-profile="${user.id}">
          <label><span>Edit username</span><input data-user-profile-field="username" type="text" maxlength="24" value="${escapeHtml(user.username)}"></label>
          <label><span>Edit email</span><input data-user-profile-field="email" type="email" maxlength="254" value="${escapeHtml(user.email || "")}"></label>
          <label><span>Confirm email edit</span><input data-user-profile-field="confirm_email_edit" type="text" placeholder="Type EDIT EMAIL if changing email"></label>
          <label class="span-full"><span>Admin note</span><input data-user-profile-field="admin_note" type="text" maxlength="1000" value="${escapeHtml(user.admin_note || "")}"></label>
          <button class="secondary-button" type="button" data-save-user-profile="${user.id}">Save profile/admin note</button>
          <button class="danger-button" type="button" data-delete-user="${user.id}">Delete/deactivate user</button>
        </div>
        <div class="admin-control-grid">
          <label>
            <span>Temporary password</span>
            <input data-temp-password="${user.id}" type="text" minlength="8" autocomplete="off" placeholder="Leave blank to generate">
          </label>
          <button class="secondary-button" type="button" data-reset-password="${user.id}">Reset password</button>
          <div class="inline-help span-full" data-temp-password-result="${user.id}"></div>
        </div>
        <div class="admin-control-grid">
          <label>
            <span>Ban reason</span>
            <select data-ban-reason="${user.id}">
              <option value="">Choose reason</option>
              ${optionRows(banReasons, user.ban_reason)}
            </select>
          </label>
          <label>
            <span>Ban note</span>
            <input data-ban-note="${user.id}" type="text" maxlength="500" value="${escapeHtml(user.ban_note || "")}">
          </label>
          <button class="danger-button" type="button" data-user-action="banned" data-user-id="${user.id}">Ban</button>
        </div>
      </article>
    `)
    .join("");

  for (const button of adminUsers.querySelectorAll("[data-reset-user]")) {
    button.addEventListener("click", () => resetUserPoints(button.dataset.resetUser));
  }

  for (const button of adminUsers.querySelectorAll("[data-adjust-points]")) {
    button.addEventListener("click", () => adjustUserPoints(button.dataset.adjustPoints));
  }

  for (const button of adminUsers.querySelectorAll("[data-view-points]")) {
    button.addEventListener("click", () => viewUserPointHistory(button.dataset.viewPoints));
  }

  for (const button of adminUsers.querySelectorAll("[data-reset-password]")) {
    button.addEventListener("click", () => resetUserPassword(button.dataset.resetPassword));
  }

  for (const button of adminUsers.querySelectorAll("[data-user-action]")) {
    button.addEventListener("click", () => moderateUser(button.dataset.userId, button.dataset.userAction));
  }

  for (const button of adminUsers.querySelectorAll("[data-user-flag]")) {
    button.addEventListener("click", () => {
      updateUserFlag(button.dataset.userId, button.dataset.userFlag, button.dataset.userFlagValue === "1");
    });
  }

  for (const button of adminUsers.querySelectorAll("[data-jump-admin-cleanup]")) {
    button.addEventListener("click", () => {
      adminAccessCleanup?.scrollIntoView({ behavior: "smooth", block: "start" });
      const target = adminAccessCleanup?.querySelector(`[data-admin-account-card="${button.dataset.jumpAdminCleanup}"]`);
      if (target) {
        target.classList.add("is-highlighted");
        window.setTimeout(() => target.classList.remove("is-highlighted"), 1800);
      }
    });
  }

  for (const button of adminUsers.querySelectorAll("[data-save-user-profile]")) {
    button.addEventListener("click", () => saveUserProfile(button.dataset.saveUserProfile));
  }

  for (const button of adminUsers.querySelectorAll("[data-delete-user]")) {
    button.addEventListener("click", () => softDeleteUser(button.dataset.deleteUser));
  }
}

function renderStores() {
  const pendingRequests = allStoreRequests.filter((request) => request.status === "pending");
  storeRequestCount.textContent = `${pendingRequests.length} pending`;

  storeRequestsList.innerHTML = pendingRequests.length
    ? pendingRequests.map((request) => `
      <article class="admin-card compact-card" data-store-request-card="${request.id}">
        <h3>${escapeHtml(request.store_name)}</h3>
        <dl class="details-list">
          <div><dt>Address</dt><dd>${escapeHtml(request.address || "Not entered")}</dd></div>
          <div><dt>City</dt><dd>${escapeHtml(request.city)}</dd></div>
          <div><dt>User</dt><dd>${escapeHtml(request.username)} (${escapeHtml(request.user_email)})</dd></div>
          <div><dt>Notes</dt><dd>${escapeHtml(request.notes || "None")}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(request.created_at))}</dd></div>
        </dl>
        <label>
          <span>Admin note</span>
          <input data-store-request-note="${request.id}" type="text" maxlength="500">
        </label>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-store-request-status="approved" data-store-request-id="${request.id}">Approve and create store</button>
          <button class="quiet-button" type="button" data-store-request-status="duplicate" data-store-request-id="${request.id}">Mark duplicate</button>
          <button class="danger-button" type="button" data-store-request-status="rejected" data-store-request-id="${request.id}">Reject</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No pending store requests.</div>';

  adminStoresList.innerHTML = allStores.length
    ? allStores.map((store) => `
      <article class="admin-card compact-card">
        <h3>${escapeHtml(store.name)}</h3>
        <dl class="details-list">
          <div><dt>Address</dt><dd>${escapeHtml(store.address || "Not entered")}</dd></div>
          <div><dt>City</dt><dd>${escapeHtml(store.city)}, ${escapeHtml(store.state)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(store.store_type)}</dd></div>
          <div><dt>Active</dt><dd>${store.active ? "Yes" : "No"}</dd></div>
          <div><dt>Reports</dt><dd>${store.report_count}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(store.created_at) || "Unknown")}</dd></div>
        </dl>
        <div class="admin-control-grid" data-store-edit="${store.id}">
          <label><span>Name</span><input data-store-field="name" type="text" maxlength="120" value="${escapeHtml(store.name)}"></label>
          <label><span>Address</span><input data-store-field="address" type="text" maxlength="160" value="${escapeHtml(store.address)}"></label>
          <label><span>City</span><input data-store-field="city" type="text" maxlength="80" value="${escapeHtml(store.city)}"></label>
          <label><span>Type</span><input data-store-field="store_type" type="text" maxlength="80" value="${escapeHtml(store.store_type)}"></label>
          <button class="secondary-button" type="button" data-store-save="${store.id}">Save store</button>
          <button class="${store.active ? "danger-button" : "quiet-button"}" type="button" data-store-action="${store.active ? "disable" : "enable"}" data-store-id="${store.id}">
            ${store.active ? "Disable store" : "Re-enable store"}
          </button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No stores yet.</div>';

  for (const button of storeRequestsList.querySelectorAll("[data-store-request-status]")) {
    button.addEventListener("click", () => updateStoreRequest(button.dataset.storeRequestId, button.dataset.storeRequestStatus));
  }

  for (const button of adminStoresList.querySelectorAll("[data-store-action]")) {
    button.addEventListener("click", () => updateStoreAction(button.dataset.storeId, button.dataset.storeAction));
  }

  for (const button of adminStoresList.querySelectorAll("[data-store-save]")) {
    button.addEventListener("click", () => saveStore(button.dataset.storeSave));
  }
}

function renderSuggestions() {
  const pending = allSuggestions.filter((suggestion) => suggestion.status === "pending");
  suggestionsCount.textContent = `${pending.length} pending`;

  adminSuggestionsList.innerHTML = allSuggestions.length
    ? allSuggestions.map((suggestion) => `
      <article class="admin-card compact-card" data-suggestion-card="${suggestion.id}">
        <div class="card-topline">
          <span class="badge confidence-low">${escapeHtml(titleCase(suggestion.suggestion_type))}</span>
          <span>${escapeHtml(titleCase(suggestion.status))}</span>
        </div>
        <h3>${escapeHtml(suggestion.title)}</h3>
        <dl class="details-list">
          <div><dt>User</dt><dd>${escapeHtml(suggestion.username)} (${escapeHtml(suggestion.user_email)})</dd></div>
          <div><dt>Related store</dt><dd>${escapeHtml(suggestion.related_store || "None")}</dd></div>
          <div><dt>Related item</dt><dd>${escapeHtml(suggestion.related_item || "None")}</dd></div>
          <div><dt>Message</dt><dd>${escapeHtml(suggestion.message)}</dd></div>
          <div><dt>Admin note</dt><dd>${escapeHtml(suggestion.admin_note || "None")}</dd></div>
          <div><dt>Created</dt><dd>${escapeHtml(formatDate(suggestion.created_at))}</dd></div>
        </dl>
        ${suggestion.photo_path ? `<a class="quiet-button" href="${escapeHtml(adminUploadUrl(suggestion.photo_path))}" target="_blank" rel="noopener">View photo</a>` : ""}
        <label>
          <span>Admin note</span>
          <input data-suggestion-note="${suggestion.id}" type="text" maxlength="500" value="${escapeHtml(suggestion.admin_note || "")}">
        </label>
        <div class="card-actions">
          <button class="secondary-button" type="button" data-suggestion-status="reviewed" data-suggestion-id="${suggestion.id}">Mark reviewed</button>
          <button class="quiet-button" type="button" data-suggestion-status="planned" data-suggestion-id="${suggestion.id}">Mark planned</button>
          <button class="danger-button" type="button" data-suggestion-status="rejected" data-suggestion-id="${suggestion.id}">Reject</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">No suggestions yet.</div>';

  for (const button of adminSuggestionsList.querySelectorAll("[data-suggestion-status]")) {
    button.addEventListener("click", () => updateSuggestion(button.dataset.suggestionId, button.dataset.suggestionStatus));
  }
}

function renderProductTools() {
  const products = productTools?.products || [];
  const pendingProducts = productTools?.pending_product_candidates || [];
  const unlinkedReports = productTools?.unlinked_reports || [];
  const reports = productTools?.reports_missing_product_info || [];
  const cartItems = productTools?.popular_cart_items || [];

  productToolsContent.innerHTML = `
    <article class="admin-card compact-card">
      <h3>Create product</h3>
      <p class="field-help">${escapeHtml(productTools?.message || "Product tools coming next.")}</p>
      <div class="admin-control-grid" data-product-create>
        ${productFormFields({ status: "active" })}
        <button class="primary-button" type="button" data-create-product>Create product</button>
      </div>
    </article>
    <article class="admin-card compact-card">
      <div class="admin-panel-heading"><div><h3>Products</h3><p class="field-help">${Number(productTools?.missing_photo_count || 0)} products need primary photos.</p></div><div class="card-actions"><button class="secondary-button" type="button" data-product-filter="all">All products</button><button class="quiet-button" type="button" data-product-filter="missing">Missing photos</button></div></div>
      ${products.length ? products.map((product) => `
        <details class="technical-details product-admin-row" data-product-admin-card="${product.id}" data-missing-photo="${product.missing_primary_image && (product.status === "active" || product.approved_price_count > 0) ? "true" : "false"}">
          <summary>
            ${escapeHtml(product.display_name)}
            <span class="badge confidence-${product.status === "active" ? "high" : "low"}">${escapeHtml(product.status)}</span>
            <span>${product.approved_price_count} approved · ${product.pending_report_count} pending</span>
          </summary>
          <dl class="details-list">
            <div><dt>Category</dt><dd>${escapeHtml(titleCase(product.category))}</dd></div>
            <div><dt>Default size</dt><dd>${escapeHtml(product.default_size_text || "Not set")}</dd></div>
            <div><dt>Aliases</dt><dd>${escapeHtml(product.common_aliases || "None")}</dd></div>
            <div><dt>Updated</dt><dd>${escapeHtml(formatDate(product.updated_at))}</dd></div>
          </dl>
          <div class="admin-control-grid" data-product-form="${product.id}">
            ${productFormFields(product)}
            <label><span>Merge into product ID</span><input data-merge-target="${product.id}" type="number" min="1" placeholder="Surviving product ID"></label>
            <label><span>Merge note</span><input data-merge-note="${product.id}" type="text" maxlength="500" placeholder="Why this merge is needed"></label>
            <button class="secondary-button" type="button" data-save-product="${product.id}">Save product</button>
            <button class="quiet-button" type="button" data-hide-product="${product.id}">Hide product</button>
            <button class="danger-button" type="button" data-merge-product="${product.id}">Merge duplicate</button>
          </div>
          <div class="admin-control-grid" data-product-image-form="${product.id}">
            <section class="product-image-manager"><h4>Primary image</h4>${product.primary_image ? `<img class="admin-upload-preview-image" src="${escapeHtml(product.primary_image.image_url)}" alt="${escapeHtml(product.primary_image.alt_text || product.display_name)}" loading="lazy"><button class="quiet-button" type="button" data-remove-primary="${product.id}">Remove primary</button>` : '<div class="empty-state">No approved primary image. Public pages use another approved image or a category placeholder.</div>'}<h4>Other images</h4><div class="product-image-thumbnails">${(product.images || []).filter((image) => !image.is_primary).map((image) => `<div class="product-image-thumbnail"><img src="${escapeHtml(image.image_url + (image.status === "approved" ? "" : adminQuery()))}" alt="${escapeHtml(image.alt_text || product.display_name)}" loading="lazy"><span>${escapeHtml(titleCase(image.status))}</span>${image.status === "approved" ? `<button class="quiet-button" type="button" data-set-primary="${image.id}">Set Primary</button>` : ""}</div>`).join("") || '<span class="field-help">No other images.</span>'}</div></section>
            <label><span>Product photo</span><input name="product_image" type="file" accept="image/jpeg,image/png,image/webp"></label>
            <label><span>Alt text</span><input name="alt_text" maxlength="240" value="${escapeHtml(product.image_alt_text || `${product.display_name} product image`)}"></label>
            <label><span>Image source note</span><input name="source_note" maxlength="300" placeholder="Admin photo, authorized manufacturer asset, etc."></label>
            <button class="secondary-button" type="button" data-upload-product-image="${product.id}">Upload image draft</button>
          </div>
        </details>
      `).join("") : '<div class="empty-state">No products yet. Create one here or from an unlinked report.</div>'}
    </article>
    <article class="admin-card compact-card">
      <h3>Pending product candidates</h3>
      ${pendingProducts.length ? pendingProducts.map((product) => `
        <div class="mini-row">
          <div>
            <strong>${escapeHtml(product.display_name)}</strong>
            <span>${escapeHtml(titleCase(product.category))} · ${escapeHtml(product.default_size_text || "No default size")}</span>
          </div>
          <button class="secondary-button" type="button" data-activate-product="${product.id}">Mark active</button>
        </div>
      `).join("") : '<div class="empty-state">No pending product candidates.</div>'}
    </article>
    <article class="admin-card compact-card">
      <h3>Unlinked / messy reports</h3>
      ${unlinkedReports.length ? unlinkedReports.map((report) => `
        <article class="admin-card compact-card" data-report-card="${report.id}">
          ${reportSummary(report)}
          <div class="admin-control-grid">
            <label><span>Link product</span><select data-link-product="${report.id}">${productOptions(report.product_id)}</select></label>
            <label><span>Admin note</span><input data-link-note="${report.id}" type="text" maxlength="500" placeholder="Link/create note"></label>
            <button class="secondary-button" type="button" data-link-report-product="${report.id}">Link report</button>
            <button class="quiet-button" type="button" data-create-product-report="${report.id}">Create product from report</button>
            <button class="quiet-button" type="button" data-unlink-report-product="${report.id}">Unlink</button>
          </div>
          ${reportEditControls(report, report.status === "pending" ? "review" : "approved")}
        </article>
      `).join("") : '<div class="empty-state">No unlinked or messy reports right now.</div>'}
    </article>
    <article class="admin-card compact-card">
      <h3>Popular cart items</h3>
      <div class="flag-row">
        ${cartItems.length ? cartItems.map((item) => `<span>${escapeHtml(item.product_display_name || item.item_name)} (${item.count})</span>`).join("") : "<span>No cart activity yet</span>"}
      </div>
    </article>
    <article class="admin-card compact-card">
      <h3>Reports missing product/allergy info</h3>
      <p class="field-help">Use product edits for shared ingredient/allergy links. Keep public language cautious.</p>
    </article>
    ${reports.length ? reports.map((report) => `
      <article class="admin-card compact-card" data-report-card="${report.id}">
        ${reportSummary(report)}
        ${reportEditControls(report, "approved")}
      </article>
    `).join("") : '<div class="empty-state">No approved reports need product info yet.</div>'}
  `;

  bindReportActions(productToolsContent);

  productToolsContent.querySelector("[data-create-product]").addEventListener("click", createProduct);

  for (const button of productToolsContent.querySelectorAll("[data-save-product]")) {
    button.addEventListener("click", () => saveProduct(button.dataset.saveProduct));
  }

  for (const button of productToolsContent.querySelectorAll("[data-hide-product]")) {
    button.addEventListener("click", () => saveProduct(button.dataset.hideProduct, { status: "hidden" }));
  }

  for (const button of productToolsContent.querySelectorAll("[data-activate-product]")) {
    button.addEventListener("click", () => saveProduct(button.dataset.activateProduct, { status: "active" }));
  }

  for (const button of productToolsContent.querySelectorAll("[data-merge-product]")) {
    button.addEventListener("click", () => mergeProduct(button.dataset.mergeProduct));
  }

  for (const button of productToolsContent.querySelectorAll("[data-upload-product-image]")) {
    button.addEventListener("click", () => uploadProductImage(button.dataset.uploadProductImage));
  }

  for (const button of productToolsContent.querySelectorAll("[data-product-filter]")) button.addEventListener("click", () => {
    const missingOnly = button.dataset.productFilter === "missing";
    for (const card of productToolsContent.querySelectorAll("[data-product-admin-card]")) card.hidden = missingOnly && card.dataset.missingPhoto !== "true";
  });
  for (const button of productToolsContent.querySelectorAll("[data-set-primary]")) button.addEventListener("click", () => moderateProductImage(button.dataset.setPrimary, "approved", true));
  for (const button of productToolsContent.querySelectorAll("[data-remove-primary]")) button.addEventListener("click", () => removeProductPrimary(button.dataset.removePrimary));

  for (const button of productToolsContent.querySelectorAll("[data-link-report-product]")) {
    button.addEventListener("click", () => linkReportProduct(button.dataset.linkReportProduct));
  }

  for (const button of productToolsContent.querySelectorAll("[data-create-product-report]")) {
    button.addEventListener("click", () => createProductFromReport(button.dataset.createProductReport));
  }

  for (const button of productToolsContent.querySelectorAll("[data-unlink-report-product]")) {
    button.addEventListener("click", () => unlinkReportProduct(button.dataset.unlinkReportProduct));
  }
}

function collectProductPayload(container, overrides = {}) {
  const payload = {};

  for (const field of container.querySelectorAll("[data-product-field]")) {
    payload[field.dataset.productField] = field.value;
  }

  return {
    ...payload,
    ...overrides
  };
}

async function createProduct() {
  const container = productToolsContent.querySelector("[data-product-create]");

  try {
    const data = await fetchJson("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), ...collectProductPayload(container) })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function saveProduct(productId, overrides = {}) {
  const container = productToolsContent.querySelector(`[data-product-form="${productId}"]`);

  if (overrides.status === "hidden" && !window.confirm("Hide this product from public product search? Linked reports are not deleted.")) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/products/${productId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), ...collectProductPayload(container, overrides) })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function uploadProductImage(productId) {
  const container = productToolsContent.querySelector(`[data-product-image-form="${productId}"]`);
  const input = container?.querySelector('[name="product_image"]');
  if (!input?.files?.length) { setAdminMessage("Choose a product photo first.", "error"); return; }
  const body = new FormData();
  body.append("product_image", input.files[0]);
  body.append("alt_text", container.querySelector('[name="alt_text"]')?.value || "Product image");
  body.append("source_note", container.querySelector('[name="source_note"]')?.value || "Admin-uploaded product photo");
  body.append("pin", getPin());
  try {
    const data = await fetchJson(`/api/admin/products/${productId}/images${adminQuery()}`, { method: "POST", body });
    setAdminMessage(data.message, "success");
    if (window.confirm("The image is a private draft. Approve it as this product's primary public image now?")) {
      await fetchJson(`/api/admin/product-images/${data.image.id}/moderate${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), status: "approved", is_primary: true, alt_text: container.querySelector('[name="alt_text"]')?.value || "Product image", source_note: container.querySelector('[name="source_note"]')?.value || "Admin-uploaded product photo" }) });
      setAdminMessage("Product image approved.", "success");
    }
    await loadAdminData();
  } catch (error) { setAdminMessage(error.message, "error"); }
}

async function moderateProductImage(imageId, status, isPrimary) {
  try {
    const data = await fetchJson(`/api/admin/product-images/${imageId}/moderate${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), status, is_primary: isPrimary }) });
    setAdminMessage(data.message, "success");
    await loadAdminData();
  } catch (error) { setAdminMessage(error.message, "error"); }
}

async function removeProductPrimary(productId) {
  const product = (productTools?.products || []).find((entry) => Number(entry.id) === Number(productId));
  const primary = (product?.images || []).find((image) => image.status === "approved" && image.is_primary);
  if (!primary || !window.confirm("Remove the primary designation? The approved image remains available and public fallback rules still apply.")) return;
  await moderateProductImage(primary.id, "approved", false);
}

async function mergeProduct(productId) {
  const target = productToolsContent.querySelector(`[data-merge-target="${productId}"]`)?.value;
  const note = productToolsContent.querySelector(`[data-merge-note="${productId}"]`)?.value || "";

  if (!target) {
    setAdminMessage("Enter the surviving product ID before merging.", "error");
    return;
  }

  if (!window.confirm("Merge this duplicate product? Reports and cart items move to the surviving product. The duplicate is not deleted.")) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/products/${productId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), target_product_id: target, admin_note: note })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function linkReportProduct(reportId) {
  const productId = productToolsContent.querySelector(`[data-link-product="${reportId}"]`)?.value;
  const note = productToolsContent.querySelector(`[data-link-note="${reportId}"]`)?.value || "";

  if (!productId) {
    setAdminMessage("Choose a product to link.", "error");
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/reports/${reportId}/link-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), product_id: productId, admin_note: note })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function createProductFromReport(reportId) {
  const report = allReports.find((item) => String(item.id) === String(reportId)) ||
    (productTools?.unlinked_reports || []).find((item) => String(item.id) === String(reportId));
  const note = productToolsContent.querySelector(`[data-link-note="${reportId}"]`)?.value || "Created from report";

  if (!report) {
    setAdminMessage("Report was not found in admin data.", "error");
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/reports/${reportId}/link-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        action: "create",
        display_name: report.item_name,
        canonical_name: report.item_name,
        category: report.category,
        default_size_text: report.size_text,
        default_quantity: report.quantity,
        default_unit: report.unit,
        preferred_brand: report.brand,
        common_aliases: report.item_name,
        status: "active",
        admin_note: note
      })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function unlinkReportProduct(reportId) {
  if (!window.confirm("Unlink this report from its product? The report stays in review/history.")) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/reports/${reportId}/link-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), action: "unlink", admin_note: "Unlinked in Product Tools" })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function updateStoreRequest(requestId, status) {
  const note = document.querySelector(`[data-store-request-note="${requestId}"]`)?.value || "";

  try {
    const data = await fetchJson(`/api/admin/store-requests/${requestId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), status, admin_note: note })
    });
    await loadStores();
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function updateSuggestion(suggestionId, status) {
  const note = document.querySelector(`[data-suggestion-note="${suggestionId}"]`)?.value || "";

  try {
    const data = await fetchJson(`/api/admin/suggestions/${suggestionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), status, admin_note: note })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function addStore(event) {
  event.preventDefault();
  const formData = new FormData(adminStoreForm);

  try {
    const data = await fetchJson("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        name: formData.get("name"),
        address: formData.get("address"),
        city: formData.get("city"),
        store_type: formData.get("store_type"),
        active: true
      })
    });
    adminStoreForm.reset();
    adminStoreForm.elements.city.value = "Janesville";
    adminStoreForm.elements.store_type.value = "grocery";
    setMessage(adminStoreMessage, data.message, "success");
    await loadStores();
    await loadAdminData();
  } catch (error) {
    setMessage(adminStoreMessage, error.message, "error");
  }
}

async function saveStore(storeId) {
  const form = document.querySelector(`[data-store-edit="${storeId}"]`);
  const payload = { pin: getPin() };

  for (const field of form.querySelectorAll("[data-store-field]")) {
    payload[field.dataset.storeField] = field.value;
  }

  try {
    const data = await fetchJson(`/api/admin/stores/${storeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadStores();
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function updateStoreAction(storeId, action) {
  if (action === "disable" && !window.confirm("Disable this store? Existing reports remain for audit.")) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/stores/${storeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), action })
    });
    await loadStores();
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function updateReportStatus(reportId, status) {
  if (status === "removed" && !window.confirm("Remove this report from public/admin workflow?")) {
    return;
  }

  const payload = {
    pin: getPin(),
    status
  };

  const reasonInput = document.querySelector(`[data-rejection-reason="${reportId}"]`);
  const noteInput = document.querySelector(`[data-rejection-note="${reportId}"]`);

  if (status === "rejected") {
    payload.rejection_reason = reasonInput?.value || "";
    payload.rejection_note = noteInput?.value || "";
  } else {
    payload.rejection_reason = titleCase(status);
    payload.rejection_note = noteInput?.value || "";
  }

  try {
    setAdminMessage(`Updating report ${reportId}...`);
    await fetchJson(`/api/admin/reports/${reportId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    await loadAdminData();
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function editReport(reportId, approveAfterEdit) {
  const form = document.querySelector(`[data-edit-form="${reportId}"]`);
  const payload = {
    pin: getPin(),
    approve_after_edit: approveAfterEdit
  };

  for (const field of form.querySelectorAll("[data-edit-field]")) {
    payload[field.dataset.editField] = field.value;
  }

  try {
    setAdminMessage(`Saving report ${reportId} edits...`);
    const data = await fetchJson(`/api/admin/reports/${reportId}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function moderateUser(userId, action) {
  if (["banned", "deleted", "suspended"].includes(action) && !window.confirm(`Apply ${action} status to this user?`)) {
    return;
  }

  const payload = {
    pin: getPin(),
    action
  };

  if (action === "banned") {
    payload.ban_reason = document.querySelector(`[data-ban-reason="${userId}"]`)?.value || "Other";
    payload.ban_note = document.querySelector(`[data-ban-note="${userId}"]`)?.value || "Banned from report review.";
  }

  try {
    setAdminMessage(`Updating user ${userId}...`);
    const data = await fetchJson(`/api/admin/users/${userId}/moderation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    await loadAdminData();
    setAdminMessage(data.warning ? `${data.message} ${data.warning}` : data.message, data.warning ? "info" : "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function addUsernamePhrase(event) {
  event.preventDefault();
  const formData = new FormData(usernameBlockForm);

  try {
    const data = await fetchJson("/api/admin/username-moderation/phrases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        phrase: formData.get("phrase"),
        reason: formData.get("reason")
      })
    });
    usernameBlockForm.reset();
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function removeUsernamePhrase(phraseId) {
  if (!window.confirm("Remove this blocked username phrase?")) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/username-moderation/phrases/${phraseId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin() })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function resetUserPoints(userId) {
  if (!window.confirm("Reset this user's points to zero?")) {
    return;
  }

  try {
    await fetchJson(`/api/admin/users/${userId}/reset-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin() })
    });
    await loadAdminData();
    setAdminMessage("User points reset.", "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function adjustUserPoints(userId) {
  const form = document.querySelector(`[data-point-adjust="${userId}"]`);
  const payload = { pin: getPin() };

  for (const field of form.querySelectorAll("[data-point-adjust-field]")) {
    payload[field.dataset.pointAdjustField] = field.value;
  }

  if (!payload.reason?.trim()) {
    setAdminMessage("A reason is required for manual point adjustments.", "error");
    return;
  }

  if (!window.confirm(`Apply ${payload.points || 0} point adjustment to this user?`)) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/users/${userId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadAdminData();
    setAdminMessage(`${data.message} New total: ${data.user?.points ?? "unknown"}.`, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function viewUserPointHistory(userId) {
  try {
    const data = await fetchJson(`/api/admin/users/${userId}/points${adminQuery()}`);
    const lines = (data.events || []).slice(0, 20).map((event) => {
      const sign = Number(event.points) > 0 ? "+" : "";
      return `${sign}${event.points} · ${event.reason || event.action} · ${formatDate(event.created_at)}`;
    });
    window.alert(lines.length
      ? `Point history for ${data.user?.username || `user ${userId}`}:\n\n${lines.join("\n")}`
      : "No point history yet.");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function resetUserPassword(userId) {
  const passwordInput = document.querySelector(`[data-temp-password="${userId}"]`);
  const output = document.querySelector(`[data-temp-password-result="${userId}"]`);

  try {
    const data = await fetchJson(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        newPassword: passwordInput?.value || ""
      })
    });

    if (passwordInput) {
      passwordInput.value = "";
    }

    if (output) {
      output.textContent = data.temporary_password
        ? `${data.message} Temporary password: ${data.temporary_password}`
        : data.message;
    }

    setAdminMessage(data.message, "success");
  } catch (error) {
    if (output) {
      output.textContent = error.message;
    }
    setAdminMessage(error.message, "error");
  }
}

async function updateUserFlag(userId, flag, value) {
  if (flag === "is_admin") {
    setAdminMessage("Use Admin Access Cleanup for admin role changes.", "error");
    return;
  }

  const label = value ? "mark this email verified" : "mark this email unverified";

  if (!window.confirm(`Apply change: ${label}?`)) {
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/users/${userId}/flags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        [flag]: value
      })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function updateAdminAccountRole(userId, action) {
  const confirmationByAction = {
    demote_admin: "DEMOTE ADMIN",
    promote_admin: "MAKE ADMIN",
    suspend_test: "SUSPEND TEST"
  };
  const labelByAction = {
    demote_admin: "remove admin access",
    promote_admin: "grant admin access",
    suspend_test: "suspend this test/dev account"
  };
  const confirmation = confirmationByAction[action];

  if (!confirmation) {
    setAdminMessage("Admin cleanup action is not valid.", "error");
    return;
  }

  const typed = window.prompt(`Type ${confirmation} to ${labelByAction[action]}. Data will not be deleted.`);

  if (typed !== confirmation) {
    setAdminMessage("Admin cleanup cancelled.", "info");
    return;
  }

  const adminNote = window.prompt("Private admin audit note", `Admin Access Cleanup: ${labelByAction[action]}.`);

  if (adminNote === null) {
    setAdminMessage("Admin cleanup cancelled.", "info");
    return;
  }

  try {
    const data = await fetchJson(`/api/admin/admin-accounts/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        action,
        confirmation: typed,
        admin_note: adminNote
      })
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function saveUserProfile(userId) {
  const form = document.querySelector(`[data-user-profile="${userId}"]`);
  const payload = { pin: getPin() };

  for (const field of form.querySelectorAll("[data-user-profile-field]")) {
    if (field.dataset.userProfileField === "confirm_email_edit" && !field.value.trim()) {
      continue;
    }

    payload[field.dataset.userProfileField] = field.value;
  }

  try {
    const data = await fetchJson(`/api/admin/users/${userId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadAdminData();
    setAdminMessage(data.message, "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

async function softDeleteUser(userId) {
  const confirmation = window.prompt("Type DELETE to deactivate this user. Reports remain for audit unless removed separately.");

  if (confirmation !== "DELETE") {
    setAdminMessage("User deactivation cancelled.", "info");
    return;
  }

  await moderateUser(userId, "deleted");
}

async function sendEmailTest(event) {
  event.preventDefault();
  setMessage(emailTestMessage, "Sending test email...");

  try {
    const data = await fetchJson("/api/admin/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        to: emailTestTo.value.trim()
      })
    });

    setMessage(
      emailTestMessage,
      data.success ? data.message || "Test email sent. Check inbox/spam." : data.error || "Email could not be sent. Check SMTP setup in .env or Brevo.",
      data.success ? "success" : "error"
    );
  } catch (error) {
    setMessage(emailTestMessage, error.message || "Email could not be sent. Check SMTP setup in .env or Brevo.", "error");
  }
}

function renderEmailDiagnostic(diagnostic) {
  if (!diagnostic) {
    emailDiagnosticResult.innerHTML = '<div class="empty-state">No diagnostic run in this server session.</div>';
    return;
  }

  emailDiagnosticResult.innerHTML = `
    <article class="admin-card compact-card">
      <h3>${diagnostic.send?.ok ? "Diagnostic passed" : "Diagnostic needs attention"}</h3>
      <dl class="details-list">
        <div><dt>Finished</dt><dd>${escapeHtml(formatDate(diagnostic.finished_at || diagnostic.started_at))}</dd></div>
        <div><dt>Provider</dt><dd>${escapeHtml(diagnostic.provider || "Brevo")}</dd></div>
        <div><dt>SMTP user</dt><dd>${escapeHtml(diagnostic.maskedUser || "Not configured")}</dd></div>
        <div><dt>Verify</dt><dd>${diagnostic.verify?.ok ? "Passed" : "Failed"}</dd></div>
        <div><dt>Send</dt><dd>${diagnostic.send?.ok ? "Passed" : "Failed"}</dd></div>
        <div><dt>Suggested fix</dt><dd>${escapeHtml(diagnostic.suggestedFix || "None")}</dd></div>
      </dl>
      <details class="technical-details">
        <summary>Show safe diagnostic details</summary>
        <pre class="safe-json">${escapeHtml(JSON.stringify(diagnostic, null, 2))}</pre>
      </details>
    </article>
  `;
}

async function runEmailDiagnostic() {
  setMessage(emailTestMessage, "Running email diagnostic...");

  try {
    const data = await fetchJson("/api/admin/email/diagnostic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        to: emailTestTo.value.trim()
      })
    });
    renderEmailDiagnostic(data.diagnostic);
    setMessage(emailTestMessage, data.diagnostic?.send?.ok ? "Email diagnostic passed." : "Email diagnostic needs attention.", data.diagnostic?.send?.ok ? "success" : "error");
    await loadAdminData();
  } catch (error) {
    setMessage(emailTestMessage, error.message, "error");
  }
}

function proofTypeNeedsPhoto(proofType) {
  return proofType === "shelf_tag_photo" ||
    proofType === "receipt_photo" ||
    proofType === "weekly_ad";
}

function updateManualPhotoRequirement() {
  const needsPhoto = proofTypeNeedsPhoto(manualProofType.value);
  manualProofPhotoInput.required = needsPhoto;
  manualProofPhotoField.hidden = !needsPhoto;
  manualProofPhotoRequirement.textContent = needsPhoto ? "Photo required." : "Photo optional.";
  updateManualPhotoStatus();
}

function updateManualPhotoStatus() {
  const file = manualProofPhotoInput.files && manualProofPhotoInput.files[0];

  if (!proofTypeNeedsPhoto(manualProofType.value)) {
    manualProofPhotoStatus.textContent = "No photo selected.";
    return;
  }

  manualProofPhotoStatus.textContent = file
    ? `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
    : "No file selected.";
}

async function submitManualEntry(event) {
  event.preventDefault();
  setMessage(manualEntryMessage, "Creating manual report...");

  const formData = new FormData(manualEntryForm);
  formData.append("pin", getPin());

  try {
    const data = await fetchJson("/api/admin/reports/manual", {
      method: "POST",
      body: formData
    });
    manualEntryForm.reset();
    updateManualPhotoRequirement();
    setMessage(manualEntryMessage, `${data.message} Unit price: ${data.unit_price_label}.`, "success");
    await loadAdminData();
  } catch (error) {
    setMessage(manualEntryMessage, error.message, "error");
  }
}

function setPriceImporterMessage(text, type = "info") {
  setMessage(priceImporterMessage, text, type);
}

function canApproveImportedPrices() {
  return Boolean(adminSession?.loggedIn && adminSession?.is_admin);
}

function setPriceImportMode(mode, options = {}) {
  activePriceImportMode = ["weekly_ad", "receipt", "shelf_tag", "website", "paste_text"].includes(mode) ? mode : "weekly_ad";

  if (priceImportModeTabs) {
    for (const button of priceImportModeTabs.querySelectorAll("[data-import-mode]")) {
      button.classList.toggle("is-active", button.dataset.importMode === activePriceImportMode);
    }
  }

  if (priceImportUploadForm) {
    const sourceType = priceImportUploadForm.elements.source_type;
    const proofType = priceImportUploadForm.elements.proof_type;

    if (activePriceImportMode === "receipt") {
      sourceType.value = "receipt";
      proofType.value = "receipt_photo";
    } else if (activePriceImportMode === "shelf_tag") {
      sourceType.value = "shelf_tag";
      proofType.value = "shelf_tag_photo";
    } else if (activePriceImportMode === "website") {
      sourceType.value = "website";
      proofType.value = "weekly_ad";
    } else if (activePriceImportMode === "paste_text") {
      sourceType.value = "paste_text";
      proofType.value = "weekly_ad";
    } else {
      sourceType.value = "weekly_ad";
      proofType.value = "weekly_ad";
    }

    priceImportUploadForm.hidden = ["website", "paste_text"].includes(activePriceImportMode);
  }

  if (priceIntakeSourceOnlyForm) {
    priceIntakeSourceOnlyForm.hidden = !["website", "paste_text"].includes(activePriceImportMode);

    if (!priceIntakeSourceOnlyForm.hidden) {
      priceIntakeSourceOnlyForm.elements.source_type.value = activePriceImportMode;
      priceIntakeSourceOnlyForm.elements.proof_type.value = activePriceImportMode === "paste_text" ? "weekly_ad" : "weekly_ad";
    }
  }

  if (priceImportSourceTextForm) {
    priceImportSourceTextForm.hidden = activePriceImportMode === "receipt" || ["website", "paste_text"].includes(activePriceImportMode);
  }

  if (priceImportReceiptTextForm) {
    priceImportReceiptTextForm.hidden = activePriceImportMode !== "receipt";
  }

  if (!options.skipRender) {
    renderPriceImporter();
  }
}

function importProofLabel(batch) {
  return batch ? `${titleCase(batch.source_type || "proof")} #${batch.id}` : "Proof";
}

function proofSubmissionLabel(batch) {
  if (!batch) {
    return "Proof submission";
  }

  return batch.proof_public_type
    ? `${titleCase(batch.proof_public_type)} proof #${batch.id}`
    : `${importProofLabel(batch)} submission`;
}

function proofSubmissionStoreId(batch) {
  if (!batch) {
    return "";
  }

  if (batch.proof_store_id) {
    return batch.proof_store_id;
  }

  const storeName = String(batch.proof_store_name || batch.receipt_store_name || "").toLowerCase();
  const store = allStores.find((item) => String(item.name || "").toLowerCase() === storeName);

  return store ? String(store.id) : "";
}

function proofRowProofType(batch) {
  if (!batch) {
    return "weekly_ad";
  }

  if (!batch.photo_path && batch.source_url && batch.proof_type === "no_photo") {
    return "weekly_ad";
  }

  return batch.proof_type || "weekly_ad";
}

function selectedImportBatch() {
  const batches = priceImporterData?.batches || [];
  return batches.find((batch) => String(batch.id) === String(selectedPriceImportBatchId)) || null;
}

function importRowsForCurrentBatch() {
  return selectedImportBatch()?.rows || [];
}

function findImportRow(rowId) {
  const batches = priceImporterData?.batches || [];

  for (const batch of batches) {
    const row = (batch.rows || []).find((item) => String(item.id) === String(rowId));

    if (row) {
      return row;
    }
  }

  return null;
}

function scrollToImportRow(rowId) {
  const card = priceImportRows?.querySelector(`[data-import-row-card="${CSS.escape(String(rowId))}"]`);

  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-highlighted");
    window.setTimeout(() => card.classList.remove("is-highlighted"), 1800);
    return;
  }

  priceImportRows?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatImportDateRange(row) {
  if (!row.valid_start_at && !row.valid_end_at) {
    return "No valid date range";
  }

  return `${formatDateOnly(row.valid_start_at) || "Unknown"} to ${formatDateOnly(row.valid_end_at) || "Unknown"}`;
}

function importStatusClass(status) {
  if (["approved", "accepted_for_review", "used_for_prices"].includes(status)) {
    return "confidence-high";
  }

  if (["rejected", "proof_rejected", "needs_clearer_photo", "duplicate"].includes(status)) {
    return "confidence-low";
  }

  return "confidence-medium";
}

function resetPriceImportRowForm(row = {}) {
  if (!priceImportRowForm) {
    return;
  }

  const batchId = row.batch_id || selectedPriceImportBatchId || "";
  const batch = selectedImportBatch();
  const saveButton = document.querySelector("#priceImportSaveRow");
  priceImportRowForm.reset();
  priceImportRowForm.elements.row_id.value = row.id || "";
  priceImportRowForm.elements.batch_id.value = batchId;
  priceImportRowForm.elements.product_id.innerHTML = productOptions(row.product_id || "");
  priceImportRowForm.elements.store_id.innerHTML = storeOptions(row.store_id || "");
  priceImportRowForm.elements.category.innerHTML = optionRows(categories, row.category || "other");
  priceImportRowForm.elements.item_name.value = row.item_name || "";
  priceImportRowForm.elements.brand.value = row.brand || "";
  priceImportRowForm.elements.variant.value = row.variant || "";
  priceImportRowForm.elements.price.value = row.price ?? "";
  priceImportRowForm.elements.size_text.value = row.size_text || "";
  priceImportRowForm.elements.quantity.value = row.quantity ?? "";

  if (row.unit && !Array.from(priceImportRowForm.elements.unit.options).some((option) => option.value === row.unit)) {
    const option = document.createElement("option");
    option.value = row.unit;
    option.textContent = row.unit;
    priceImportRowForm.elements.unit.appendChild(option);
  }

  priceImportRowForm.elements.unit.value = row.unit || "each";
  priceImportRowForm.elements.proof_type.value = row.proof_type || selectedImportBatch()?.proof_type || "weekly_ad";
  priceImportRowForm.elements.regular_price.value = row.regular_price ?? "";
  priceImportRowForm.elements.member_card_price.value = row.member_card_price ?? "";
  priceImportRowForm.elements.multibuy_details.value = row.multibuy_details || "";
  priceImportRowForm.elements.promotion_text.value = row.promotion_text || "";
  priceImportRowForm.elements.sale_price.checked = Boolean(row.sale_price);
  priceImportRowForm.elements.coupon_required.checked = Boolean(row.coupon_required);
  priceImportRowForm.elements.deal_limit.value = row.deal_limit || "";
  priceImportRowForm.elements.observed_at.value = row.observed_date || "";
  priceImportRowForm.elements.valid_start_at.value = row.valid_start_date || "";
  priceImportRowForm.elements.valid_end_at.value = row.valid_end_date || "";
  priceImportRowForm.elements.source_url.value = row.source_url || batch?.source_url || "";
  priceImportRowForm.elements.source_title.value = row.source_title || batch?.source_title || "";
  priceImportRowForm.elements.source_checked_at.value = row.source_checked_date || batch?.source_checked_date || "";
  priceImportRowForm.elements.extraction_confidence.value = row.extraction_confidence || "low";
  priceImportRowForm.elements.extraction_notes.value = row.extraction_notes || "";
  priceImportRowForm.elements.duplicate_warning.value = row.duplicate_warning || "";
  priceImportRowForm.elements.status.value = ["import_draft", "ready_for_review", "needs_edit"].includes(row.status)
    ? row.status
    : "ready_for_review";
  priceImportRowForm.elements.notes.value = row.notes || "";

  if (saveButton) {
    saveButton.disabled = !batchId || row.status === "approved";
    saveButton.textContent = row.id ? "Save row changes" : "Save draft row";
  }
}

function renderPriceImportCleanupReport() {
  if (!priceImportCleanupReport) {
    return;
  }

  const report = priceImporterData?.cleanup_report;

  if (!report) {
    priceImportCleanupReport.hidden = true;
    priceImportCleanupReport.innerHTML = "";
    return;
  }

  const candidates = report.candidates || [];
  priceImportCleanupReport.hidden = false;

  if (!candidates.length) {
    priceImportCleanupReport.innerHTML = `
      <div class="card-topline">
        <h3>Approved Receipt Cleanup</h3>
        <span class="badge confidence-high">Clear</span>
      </div>
      <p class="field-help">${escapeHtml(report.message || "No suspicious approved receipt rows found.")}</p>
    `;
    return;
  }

  priceImportCleanupReport.innerHTML = `
    <div class="card-topline">
      <h3>Approved Receipt Cleanup</h3>
      <span class="badge confidence-low">${candidates.length} to review</span>
    </div>
    <p class="field-help">${escapeHtml(report.message)}</p>
    <div class="admin-list cleanup-report-list">
      ${candidates.map((candidate) => {
        const approvedReport = candidate.report || {};
        const suggested = candidate.suggested || {};

        return `
          <article class="cleanup-report-card">
            <div class="card-topline">
              <div>
                <strong>#${escapeHtml(approvedReport.id)} ${escapeHtml(approvedReport.item_name || "Approved receipt row")}</strong>
                <div class="brand-line">${escapeHtml(approvedReport.store_name || "Unknown store")} · approved ${escapeHtml(formatDate(approvedReport.reviewed_at) || "date unknown")}</div>
              </div>
              <strong>${escapeHtml(approvedReport.price_label || "")}</strong>
            </div>
            <dl class="details-list">
              <div><dt>Receipt line</dt><dd>${escapeHtml(candidate.raw_receipt_line || "Not captured")}</dd></div>
              <div><dt>Current</dt><dd>${escapeHtml(`${approvedReport.item_name || ""} · ${approvedReport.price_label || ""} · ${approvedReport.size_text || "no size"}`)}</dd></div>
              <div><dt>Suggested</dt><dd>${suggested.item_name ? escapeHtml(`${suggested.item_name} · ${suggested.price_label} · ${suggested.size_text || `${suggested.quantity || 1} ${suggested.unit || "each"}`}`) : "Needs manual review"}</dd></div>
              <div><dt>Flags</dt><dd>${escapeHtml((candidate.flags || []).join(" "))}</dd></div>
            </dl>
            <div class="card-actions">
              <button class="secondary-button" type="button" data-cleanup-report-id="${approvedReport.id}">Open approved report</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  for (const button of priceImportCleanupReport.querySelectorAll("[data-cleanup-report-id]")) {
    button.addEventListener("click", () => {
      goToAdminTab("pricesTab", { reportId: button.dataset.cleanupReportId });
      setAdminMessage("Review the approved receipt row, then edit it or remove it from public if needed.", "info");
    });
  }
}

function renderProofInbox() {
  if (!proofInboxList || !proofInboxCount) {
    return;
  }

  const inbox = priceImporterData?.proof_inbox || (priceImporterData?.batches || []).filter((batch) => batch.is_proof_submission);
  const closedProofStatuses = ["proof_reviewed", "proof_rejected", "rejected", "reviewed_no_prices", "used_for_prices", "duplicate"];
  const active = inbox.filter((batch) => !closedProofStatuses.includes(batch.status));
  const filterDefinitions = [
    ["needs_review", "Needs review"],
    ["high_priority", "High priority"],
    ["low_trust", "Low trust"],
    ["duplicates", "Duplicates"],
    ["needs_clearer_photo", "Needs clearer photo"],
    ["old_proof", "Old proof"],
    ["has_source", "Has source link"],
    ["receipt", "Receipt"],
    ["weekly_ad", "Weekly ad"],
    ["shelf_tag", "Shelf tag"]
  ];
  const matchesFilter = (batch) => {
    const flags = batch.proof_quality_flags || [];

    if (proofInboxFilter === "needs_review") {
      return !closedProofStatuses.includes(batch.status);
    }

    if (proofInboxFilter === "high_priority") {
      return batch.review_priority === "high";
    }

    if (proofInboxFilter === "low_trust") {
      return batch.review_priority === "low" || flags.includes("same_user_duplicate");
    }

    if (proofInboxFilter === "duplicates") {
      return Boolean(batch.duplicate_scope);
    }

    if (proofInboxFilter === "needs_clearer_photo") {
      return batch.status === "needs_clearer_photo";
    }

    if (proofInboxFilter === "old_proof") {
      return flags.some((flag) => flag.includes("older_than_7_days") || flag.includes("expired"));
    }

    if (proofInboxFilter === "has_source") {
      return Boolean(batch.source_url);
    }

    if (proofInboxFilter === "receipt") {
      return batch.source_type === "receipt" || batch.proof_type === "receipt_photo";
    }

    if (proofInboxFilter === "weekly_ad") {
      return batch.source_type === "weekly_ad" || batch.proof_type === "weekly_ad";
    }

    if (proofInboxFilter === "shelf_tag") {
      return batch.source_type === "shelf_tag" || batch.proof_type === "shelf_tag_photo";
    }

    return true;
  };
  const visibleInbox = inbox.filter(matchesFilter);
  proofInboxCount.textContent = active.length
    ? `${active.length} needing review`
    : "No pending proof";

  if (!inbox.length) {
    proofInboxList.innerHTML = '<div class="empty-state">No proof-only submissions yet.</div>';
    return;
  }

  proofInboxList.innerHTML = `
    <div class="filter-chip-row">
      ${filterDefinitions.map(([value, label]) => `
        <button class="filter-chip ${proofInboxFilter === value ? "is-active" : ""}" type="button" data-proof-inbox-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
    ${visibleInbox.length ? visibleInbox.map((batch) => {
    const proofUrl = adminUploadUrl(batch.photo_path);
    const rows = batch.rows || [];
    const rowSummary = rows.length
      ? `${rows.length} draft row${rows.length === 1 ? "" : "s"} linked`
      : "No draft rows yet";
    const sourceLink = batch.source_url
      ? `<a href="${escapeHtml(batch.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(batch.source_domain || "View source")}</a>`
      : "No source link";
    const ocrText = batch.receipt_ocr_text
      ? `<details class="ocr-debug"><summary>OCR helper text</summary><pre>${escapeHtml(batch.receipt_ocr_text)}</pre></details>`
      : "";
    const flags = batch.proof_quality_flags || [];

    return `
      <article class="admin-card compact-card" data-price-import-batch="${batch.id}">
        <div class="card-topline">
          <div>
            <h3>${escapeHtml(proofSubmissionLabel(batch))}</h3>
            <div class="brand-line">${escapeHtml(batch.proof_store_name || batch.receipt_store_name || "Store needs review")} · ${escapeHtml(formatDate(batch.created_at))}</div>
          </div>
          <span class="badge ${importStatusClass(batch.status)}">${escapeHtml(titleCase(batch.status || "needs_admin_review"))}</span>
        </div>
        <div class="card-topline">
          <span class="badge confidence-${batch.review_priority === "high" ? "high" : batch.review_priority === "low" ? "low" : "medium"}">${escapeHtml(titleCase(batch.review_priority || "normal"))} priority</span>
          ${batch.duplicate_scope ? `<span class="badge confidence-low">${escapeHtml(titleCase(batch.duplicate_scope))}</span>` : ""}
        </div>
        <dl class="details-list">
          <div><dt>User</dt><dd>${escapeHtml(batch.created_by_username || `User #${batch.created_by || ""}`.trim() || "Unknown")}</dd></div>
          <div><dt>Proof type</dt><dd>${escapeHtml(titleCase(batch.proof_public_type || batch.source_type || batch.proof_type))}</dd></div>
          <div><dt>Source</dt><dd>${sourceLink}</dd></div>
          <div><dt>Item hint</dt><dd>${escapeHtml(batch.proof_item_hint || "None")}</dd></div>
          <div><dt>Price hint</dt><dd>${escapeHtml(batch.proof_price_hint || "None")}</dd></div>
          <div><dt>Rows</dt><dd>${escapeHtml(rowSummary)}</dd></div>
        </dl>
        ${batch.proof_user_notes ? `<p class="inline-help">${escapeHtml(batch.proof_user_notes)}</p>` : ""}
        ${!batch.source_url && !batch.photo_path ? '<p class="source-link-warning">This source-link-only submission needs a valid URL before approval.</p>' : ""}
        ${flags.length ? `<p class="inline-help">Flags: ${escapeHtml(flags.join(", "))}</p>` : ""}
        ${proofUrl ? `<a class="quiet-button" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Open proof image</a>` : '<p class="inline-help">No image uploaded. Use the source link before creating rows.</p>'}
        ${ocrText}
        <div class="card-actions">
          <button class="primary-button" type="button" data-open-proof-review="${batch.id}">Open Review Workspace</button>
          <button class="secondary-button" type="button" data-proof-status="${batch.id}" data-proof-action="accept_for_review">Accept for review</button>
          <button class="primary-button" type="button" data-proof-create-row="${batch.id}">Create price row from proof</button>
          <button class="quiet-button" type="button" data-proof-status="${batch.id}" data-proof-action="needs_clearer_photo">Needs clearer photo</button>
          <button class="quiet-button" type="button" data-proof-status="${batch.id}" data-proof-action="needs_source_link">Needs source link</button>
        </div>
      </article>
    `;
  }).join("") : '<div class="empty-state">No proof submissions match this filter.</div>'}
  `;

  for (const button of proofInboxList.querySelectorAll("[data-proof-inbox-filter]")) {
    button.addEventListener("click", () => {
      proofInboxFilter = button.dataset.proofInboxFilter;
      renderProofInbox();
    });
  }

  for (const button of proofInboxList.querySelectorAll("[data-proof-create-row]")) {
    button.addEventListener("click", () => startPriceRowFromProof(button.dataset.proofCreateRow));
  }

  for (const button of proofInboxList.querySelectorAll("[data-open-proof-review]")) {
    button.addEventListener("click", () => {
      openAdminTab("inboxTab");
      openReceiptReview(button.dataset.openProofReview);
    });
  }

  for (const button of proofInboxList.querySelectorAll("[data-proof-status]")) {
    button.addEventListener("click", () => updateProofSubmissionStatus(button.dataset.proofStatus, button.dataset.proofAction));
  }
}

function startPriceRowFromProof(batchId) {
  const batch = (priceImporterData?.batches || []).find((item) => String(item.id) === String(batchId));

  if (!batch) {
    setPriceImporterMessage("That proof submission is no longer visible.", "error");
    return;
  }

  selectedPriceImportBatchId = String(batch.id);
  selectedPriceImportRows.clear();
  renderPriceImporter();

  const priceHint = String(batch.proof_price_hint || "").replace(/[^\d.]/g, "");
  resetPriceImportRowForm({
    batch_id: batch.id,
    store_id: proofSubmissionStoreId(batch),
    item_name: batch.proof_item_hint || "",
    category: "other",
    price: priceHint,
    quantity: 1,
    unit: "each",
    proof_type: proofRowProofType(batch),
    source_url: batch.source_url || "",
    source_title: batch.source_title || "",
    source_checked_date: batch.source_checked_date || "",
    extraction_confidence: "low",
    extraction_notes: "Created manually from proof inbox. Admin review required.",
    notes: [
      `Created from proof submission #${batch.id}.`,
      batch.proof_user_notes ? `User notes: ${batch.proof_user_notes}` : ""
    ].filter(Boolean).join(" ")
  });
  setPriceImporterMessage("Proof loaded into the draft row form. Review and save the row before approval.", "info");
  priceImportRowForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function updateProofSubmissionStatus(batchId, action) {
  const labels = {
    accept_for_review: "accept this proof for review",
    reviewed_no_prices: "mark this proof reviewed with no prices added",
    duplicate: "mark this proof duplicate",
    reject: "reject this proof",
    needs_clearer_photo: "ask for a clearer photo",
    needs_source_link: "ask for a source link"
  };

  let adminReason = "";

  if (action === "reject") {
    adminReason = window.prompt("Safe reason shown to the user", "We could not verify the proof.");

    if (adminReason === null) {
      return;
    }
  }

  try {
    setPriceImporterMessage(`Updating proof inbox status to ${labels[action] || action}...`);
    const data = await fetchJson(`/api/admin/proof-submissions/${batchId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        action,
        admin_reason: adminReason
      })
    });
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

function renderPriceImporter() {
  if (!priceImportProofList || !priceImportRows) {
    return;
  }

  const batches = priceImporterData?.batches || [];

  if (batches.length && !batches.some((batch) => String(batch.id) === String(selectedPriceImportBatchId))) {
    selectedPriceImportBatchId = String(batches[0].id);
    selectedPriceImportRows.clear();
  }

  if (!batches.length) {
    selectedPriceImportBatchId = "";
    selectedPriceImportRows.clear();
  }

  const rows = batches.flatMap((batch) => batch.rows || []);
  const pendingCount = rows.filter((row) => !["approved", "rejected", "removed"].includes(row.status)).length;
  const selected = selectedImportBatch();

  if (selected?.source_type === "receipt" || selected?.proof_type === "receipt_photo") {
    setPriceImportMode("receipt", { skipRender: true });
  } else if (selected?.source_type === "shelf_tag" || selected?.proof_type === "shelf_tag_photo") {
    setPriceImportMode("shelf_tag", { skipRender: true });
  } else if (selected?.source_type === "website") {
    setPriceImportMode("website", { skipRender: true });
  } else if (selected?.source_type === "paste_text") {
    setPriceImportMode("paste_text", { skipRender: true });
  } else if (selected) {
    setPriceImportMode("weekly_ad", { skipRender: true });
  }

  priceImporterCount.textContent = batches.length
    ? `${batches.length} proof upload${batches.length === 1 ? "" : "s"} · ${pendingCount} row${pendingCount === 1 ? "" : "s"} pending`
    : "No proof uploads yet";

  renderPriceImportProofList();
  renderPriceImportRows();
  renderPriceImportCleanupReport();
  renderProofInbox();
  syncPriceImportSourceTextForm();
  syncPriceImportReceiptTextForm();
  renderPriceImportReceiptSummary();

  if (!priceImportRowForm.elements.row_id.value) {
    resetPriceImportRowForm();
  }
}

function syncPriceImportSourceTextForm() {
  if (!priceImportSourceTextForm) {
    return;
  }

  const batch = selectedImportBatch();
  const batchId = batch ? String(batch.id) : "";

  if (priceImportSourceTextForm.dataset.batchId !== batchId) {
    priceImportSourceTextForm.elements.source_url.value = batch?.source_url || "";
    priceImportSourceTextForm.elements.source_title.value = batch?.source_title || "";
    priceImportSourceTextForm.dataset.batchId = batchId;
  }
}

function syncPriceImportReceiptTextForm() {
  if (!priceImportReceiptTextForm) {
    return;
  }

  const batch = selectedImportBatch();
  const batchId = batch ? String(batch.id) : "";

  if (priceImportReceiptTextForm.dataset.batchId !== batchId) {
    priceImportReceiptTextForm.elements.receipt_text.value = batch?.receipt_ocr_text || "";
    priceImportReceiptTextForm.dataset.batchId = batchId;
  }
}

function renderPriceImportReceiptSummary() {
  if (!priceImportReceiptSummary) {
    return;
  }

  const batch = selectedImportBatch();
  const isReceipt = activePriceImportMode === "receipt" || batch?.source_type === "receipt" || batch?.proof_type === "receipt_photo";
  priceImportReceiptSummary.hidden = !isReceipt;

  if (!isReceipt) {
    priceImportReceiptSummary.innerHTML = "";
    return;
  }

  if (!batch) {
    priceImportReceiptSummary.innerHTML = `
      <div class="card-topline">
        <h3>Receipt Proof</h3>
        <span class="badge confidence-low">No receipt selected</span>
      </div>
      <p class="field-help">Upload or select a receipt image, then enter the item and price manually.</p>
    `;
    return;
  }

  const proofUrl = adminUploadUrl(batch.photo_path);
  const ocrConfidence = batch.receipt_ocr_confidence || "not run";
  const ocrRan = Boolean(batch.receipt_ocr_confidence || batch.receipt_ocr_text);
  const rawOcrText = batch.receipt_ocr_text || "";
  const ocrStatus = !ocrRan
    ? "OCR has not run for this receipt yet."
    : rawOcrText
      ? "OCR found helper text below."
      : "No readable receipt text detected.";
  const ocrFallback = ocrRan && !rawOcrText
    ? `<div class="warning subtle-warning">Receipt saved as proof. Enter the item and price manually.</div>`
    : "";

  priceImportReceiptSummary.innerHTML = `
    <div class="card-topline">
      <h3>Receipt Proof</h3>
      <span class="badge ${ocrConfidence === "high" ? "confidence-high" : ocrConfidence === "medium" ? "confidence-medium" : "confidence-low"}">OCR ${escapeHtml(titleCase(ocrConfidence))}</span>
    </div>
    <p class="field-help">Receipt uploads are proof first. Enter one reviewed item with the row form; OCR text is only a helper. ${escapeHtml(ocrStatus)}</p>
    ${ocrFallback}
    <dl class="receipt-meta-grid">
      <div><dt>Detected store</dt><dd>${escapeHtml(batch.receipt_store_name || "Needs store review")}</dd></div>
      <div><dt>Address</dt><dd>${escapeHtml(batch.receipt_store_address || "Not detected")}</dd></div>
      <div><dt>Purchase date</dt><dd>${escapeHtml(formatDateOnly(batch.receipt_purchase_date) || "Not detected")}</dd></div>
      <div><dt>Purchase time</dt><dd>${escapeHtml(batch.receipt_purchase_time || "Not detected")}</dd></div>
      <div><dt>Receipt total</dt><dd>${escapeHtml(batch.receipt_total_label || "Not detected")}</dd></div>
      <div><dt>Transaction</dt><dd>${escapeHtml(batch.receipt_transaction_id || "Not detected")}</dd></div>
    </dl>
    <div class="receipt-tips">
      <strong>Receipt photo tips</strong>
      <ul>
        <li>Place the receipt flat on a dark background.</li>
        <li>Fill the camera frame with the receipt.</li>
        <li>Avoid shadows and wrinkles when possible.</li>
        <li>Use flash if the print is faded.</li>
        <li>Take separate photos for long receipts.</li>
      </ul>
    </div>
    <details class="ocr-debug" ${rawOcrText ? "open" : ""}>
      <summary>OCR helper text</summary>
      ${rawOcrText ? `<pre>${escapeHtml(rawOcrText)}</pre>` : `<p class="field-help">No readable receipt text detected. Receipt proof is still saved.</p>`}
    </details>
    ${proofUrl ? `<a class="quiet-button" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Open receipt image</a>` : ""}
  `;
}

function renderPriceImportProofList() {
  const batches = priceImporterData?.batches || [];

  if (!batches.length) {
    priceImportSelectedBatchLabel.textContent = "No proof selected";
    priceImportProofList.innerHTML = '<div class="empty-state">Upload a proof image to start an import batch.</div>';
    return;
  }

  const selected = selectedImportBatch();
  priceImportSelectedBatchLabel.textContent = selected
    ? `Selected proof: ${importProofLabel(selected)}`
    : "No proof selected";

  priceImportProofList.innerHTML = batches.map((batch) => {
    const proofUrl = adminUploadUrl(batch.photo_path);
    const rows = batch.rows || [];
    const approved = rows.filter((row) => row.status === "approved").length;
    const rejected = rows.filter((row) => row.status === "rejected").length;
    const removed = rows.filter((row) => row.status === "removed").length;
    const pending = rows.length - approved - rejected - removed;

    return `
      <article class="price-import-proof-card ${String(batch.id) === String(selectedPriceImportBatchId) ? "is-selected" : ""}">
        <button class="price-import-proof-select" type="button" data-import-batch-id="${batch.id}">
          ${proofUrl ? `<img src="${escapeHtml(proofUrl)}" alt="Proof upload ${batch.id}">` : '<div class="proof-placeholder">No image</div>'}
          <span class="price-import-proof-meta">
            <strong>${escapeHtml(importProofLabel(batch))}</strong>
            <span>${escapeHtml(formatDate(batch.created_at))}</span>
            <span>${escapeHtml(batch.source_domain || "No source link")}</span>
            ${batch.source_type === "receipt" || batch.proof_type === "receipt_photo" ? `<span>${escapeHtml(batch.receipt_store_name || "Receipt store needs review")} · ${escapeHtml(batch.receipt_total_label || "No total detected")}</span>` : ""}
            <span>${escapeHtml(rows.length)} row${rows.length === 1 ? "" : "s"} · ${pending} pending · ${approved} approved · ${rejected} rejected</span>
          </span>
        </button>
        ${batch.source_url || batch.photo_path ? "" : '<p class="source-link-warning">This source-link-only submission needs a valid URL before approval.</p>'}
        <div class="proof-card-actions">
          ${pending > 0 ? `<button class="secondary-button" type="button" data-import-review-rows="${batch.id}">Review pending rows</button>` : ""}
          ${batch.source_text ? `<button class="quiet-button" type="button" data-import-retry-parse="${batch.id}">Retry parsing</button>` : ""}
          <button class="quiet-button" type="button" data-import-edit-source="${batch.id}">Edit source</button>
        </div>
      </article>
    `;
  }).join("");

  for (const button of priceImportProofList.querySelectorAll("[data-import-batch-id]")) {
    button.addEventListener("click", () => {
      selectedPriceImportBatchId = button.dataset.importBatchId;
      selectedPriceImportRows.clear();
      resetPriceImportRowForm();
      renderPriceImporter();
    });
  }

  for (const button of priceImportProofList.querySelectorAll("[data-import-review-rows]")) {
    button.addEventListener("click", () => reviewPendingImportRows(button.dataset.importReviewRows));
  }

  for (const button of priceImportProofList.querySelectorAll("[data-import-edit-source]")) {
    button.addEventListener("click", () => editImportBatchSource(button.dataset.importEditSource));
  }

  for (const button of priceImportProofList.querySelectorAll("[data-import-retry-parse]")) {
    button.addEventListener("click", () => retryPriceImportParsing(button.dataset.importRetryParse));
  }
}

function reviewPendingImportRows(batchId) {
  selectedPriceImportBatchId = String(batchId);
  selectedPriceImportRows.clear();
  renderPriceImporter();

  const firstPending = importRowsForCurrentBatch().find((row) => !["approved", "rejected", "removed"].includes(row.status));
  scrollToImportRow(firstPending?.id || "");
}

async function editImportBatchSource(batchId) {
  const batch = (priceImporterData?.batches || []).find((item) => String(item.id) === String(batchId));

  if (!batch) {
    setPriceImporterMessage("That proof batch is no longer visible.", "error");
    return;
  }

  const sourceUrl = window.prompt(`Source link for ${importProofLabel(batch)}`, batch.source_url || "");

  if (sourceUrl === null) {
    return;
  }

  const sourceTitle = window.prompt(`Source title for ${importProofLabel(batch)}`, batch.source_title || "");

  if (sourceTitle === null) {
    return;
  }

  try {
    setPriceImporterMessage("Saving proof source...");
    const data = await fetchJson(`/api/admin/price-imports/${batch.id}/source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        source_url: sourceUrl,
        source_title: sourceTitle
      })
    });
    selectedPriceImportBatchId = String(data.batch?.id || batch.id);
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function retryPriceImportParsing(batchId) {
  const batch = (priceImporterData?.batches || []).find((item) => String(item.id) === String(batchId));

  if (!batch?.source_text) {
    setPriceImporterMessage("No source text is saved for this batch.", "warning");
    return;
  }

  try {
    setPriceImporterMessage("Retrying source text parser...");
    const data = await fetchJson(`/api/admin/price-imports/${batch.id}/parse-price-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        source_url: batch.source_url || "",
        source_title: batch.source_title || "",
        source_text: batch.source_text || ""
      })
    });
    selectedPriceImportBatchId = String(batch.id);
    selectedPriceImportRows.clear();
    setPriceImporterMessage(data.message, data.extraction_attempt?.status === "duplicate" ? "warning" : "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

function importRowIssues(row) {
  const issues = [];
  const validEnd = row.valid_end_at ? new Date(row.valid_end_at) : null;
  const price = Number(row.price);
  const regularPrice = Number(row.regular_price);

  if ((row.extraction_confidence || "low") === "low") issues.push("low confidence");
  if (!row.size_text) issues.push("missing size");
  if (!Number.isFinite(price) || price <= 0) issues.push("unclear price");
  if (!row.product_id) issues.push("unmatched product");
  if (row.duplicate_warning) issues.push("duplicate warning");
  if (validEnd && !Number.isNaN(validEnd.getTime()) && validEnd < new Date()) issues.push("expired dates");
  if (Number.isFinite(price) && Number.isFinite(regularPrice) && regularPrice < price) issues.push("regular lower than sale");
  if (!row.source_url && !selectedImportBatch()?.photo_path) issues.push("missing proof/source");

  return issues;
}

function filteredImportRows(rows) {
  const filtered = rows.filter((row) => {
    if (priceImportFilters.status === "active" && ["approved", "rejected", "removed"].includes(row.status)) return false;
    if (priceImportFilters.status && priceImportFilters.status !== "active" && row.status !== priceImportFilters.status) return false;
    if (priceImportFilters.store && String(row.store_id || "") !== String(priceImportFilters.store)) return false;
    if (priceImportFilters.source && row.proof_type !== priceImportFilters.source && selectedImportBatch()?.source_type !== priceImportFilters.source) return false;
    if (priceImportFilters.confidence && row.extraction_confidence !== priceImportFilters.confidence) return false;
    if (priceImportFilters.duplicate === "warnings" && !row.duplicate_warning) return false;
    if (priceImportFilters.duplicate === "clean" && row.duplicate_warning) return false;
    return true;
  });

  return filtered.sort((left, right) => {
    if (priceImportFilters.sort === "price") return Number(left.price || 0) - Number(right.price || 0);
    if (priceImportFilters.sort === "name") return String(left.item_name || "").localeCompare(String(right.item_name || ""));
    if (priceImportFilters.sort === "status") return String(left.status || "").localeCompare(String(right.status || ""));
    if (priceImportFilters.sort === "updated") return String(right.updated_at || "").localeCompare(String(left.updated_at || ""));

    return importRowIssues(right).length - importRowIssues(left).length;
  });
}

function renderPriceImportReviewFilters(rows = []) {
  if (!priceImportReviewFilters) {
    return;
  }

  priceImportReviewFilters.innerHTML = `
    <label class="table-filter">
      <span>Status</span>
      <select data-import-filter="status">
        <option value="active" ${priceImportFilters.status === "active" ? "selected" : ""}>Needs work</option>
        <option value="" ${priceImportFilters.status === "" ? "selected" : ""}>All rows</option>
        <option value="import_draft" ${priceImportFilters.status === "import_draft" ? "selected" : ""}>Draft</option>
        <option value="ready_for_review" ${priceImportFilters.status === "ready_for_review" ? "selected" : ""}>Needs review</option>
        <option value="needs_edit" ${priceImportFilters.status === "needs_edit" ? "selected" : ""}>Needs edit</option>
        <option value="approved" ${priceImportFilters.status === "approved" ? "selected" : ""}>Approved</option>
        <option value="rejected" ${priceImportFilters.status === "rejected" ? "selected" : ""}>Rejected</option>
        <option value="removed" ${priceImportFilters.status === "removed" ? "selected" : ""}>Removed</option>
      </select>
    </label>
    <label class="table-filter">
      <span>Store</span>
      <select data-import-filter="store">${storeOptionsWithEmpty("All stores", priceImportFilters.store)}</select>
    </label>
    <label class="table-filter">
      <span>Confidence</span>
      <select data-import-filter="confidence">
        <option value="">All</option>
        ${["high", "medium", "low"].map((value) => `<option value="${value}" ${priceImportFilters.confidence === value ? "selected" : ""}>${titleCase(value)}</option>`).join("")}
      </select>
    </label>
    <label class="table-filter">
      <span>Warnings</span>
      <select data-import-filter="duplicate">
        <option value="">All</option>
        <option value="warnings" ${priceImportFilters.duplicate === "warnings" ? "selected" : ""}>Warnings only</option>
        <option value="clean" ${priceImportFilters.duplicate === "clean" ? "selected" : ""}>No warnings</option>
      </select>
    </label>
    <label class="table-filter">
      <span>Sort</span>
      <select data-import-filter="sort">
        <option value="risk" ${priceImportFilters.sort === "risk" ? "selected" : ""}>Risk first</option>
        <option value="price" ${priceImportFilters.sort === "price" ? "selected" : ""}>Lowest price</option>
        <option value="name" ${priceImportFilters.sort === "name" ? "selected" : ""}>Name</option>
        <option value="status" ${priceImportFilters.sort === "status" ? "selected" : ""}>Status</option>
        <option value="updated" ${priceImportFilters.sort === "updated" ? "selected" : ""}>Recently updated</option>
      </select>
    </label>
    <span class="badge confidence-medium">${filteredImportRows(rows).length} visible</span>
  `;

  for (const control of priceImportReviewFilters.querySelectorAll("[data-import-filter]")) {
    control.addEventListener("change", () => {
      priceImportFilters[control.dataset.importFilter] = control.value;
      renderPriceImportRows();
    });
  }
}

function productMatchOptions(row) {
  const matches = row.product_matches || [];
  const linked = row.product_id
    ? `<option value="${row.product_id}">${escapeHtml(row.product_display_name || `Product #${row.product_id}`)}</option>`
    : "";

  return `<option value="">Unlinked</option>${linked}${matches
    .filter((match) => String(match.id) !== String(row.product_id || ""))
    .map((match) => `<option value="${match.id}">${escapeHtml(match.display_name)} (${match.score})</option>`)
    .join("")}`;
}

function renderPriceImportHistory() {
  if (!priceImportHistory) {
    return;
  }

  const history = priceImporterData?.history || [];

  if (!history.length) {
    priceImportHistory.innerHTML = '<div class="empty-state">No import history yet.</div>';
    return;
  }

  priceImportHistory.innerHTML = history.slice(0, 12).map((batch) => `
    <article class="history-row">
      <button class="quiet-button" type="button" data-history-batch="${batch.id}">Open #${batch.id}</button>
      <span>${escapeHtml(batch.title || `Batch #${batch.id}`)}</span>
      <span>${escapeHtml(titleCase(batch.source_type || "source"))}</span>
      <span>${escapeHtml(batch.parsed_count)} parsed</span>
      <span>${escapeHtml(batch.approved_count)} approved</span>
      <span>${escapeHtml(batch.needs_review_count)} needs review</span>
      <span>${escapeHtml(formatDate(batch.created_at))}</span>
    </article>
  `).join("");

  for (const button of priceImportHistory.querySelectorAll("[data-history-batch]")) {
    button.addEventListener("click", () => {
      selectedPriceImportBatchId = button.dataset.historyBatch;
      selectedPriceImportRows.clear();
      renderPriceImporter();
      priceImportRows?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function updateImportBulkButtons(rows = importRowsForCurrentBatch()) {
  const visibleIds = new Set(rows.map((row) => String(row.id)));
  selectedPriceImportRows = new Set([...selectedPriceImportRows].filter((rowId) => visibleIds.has(String(rowId))));
  const canApprove = canApproveImportedPrices();
  const selectedCount = selectedPriceImportRows.size;

  priceImportApproveSelected.disabled = selectedCount === 0 || !canApprove;
  priceImportApproveSelected.title = canApprove ? "" : "Log in as admin to approve imported prices.";
  priceImportRejectSelected.disabled = selectedCount === 0;

  if (priceImportSelectedCount) {
    priceImportSelectedCount.textContent = `${selectedCount} selected`;
  }

  if (priceImportRemoveSelected) {
    priceImportRemoveSelected.disabled = selectedCount === 0;
  }
}

function importRowInlinePayload(rowId) {
  const row = findImportRow(rowId) || {};
  const container = priceImportRows.querySelector(`[data-import-row-card="${CSS.escape(String(rowId))}"]`);
  const valueFor = (field) => {
    const input = container?.querySelector(`[data-row-field="${field}"]`);
    if (!input) return undefined;
    return input.type === "checkbox" ? input.checked : input.value;
  };

  return {
    pin: getPin(),
    product_id: valueFor("product_id") ?? row.product_id ?? "",
    store_id: valueFor("store_id") ?? row.store_id ?? "",
    item_name: valueFor("item_name") ?? row.item_name ?? "",
    brand: valueFor("brand") ?? row.brand ?? "",
    variant: valueFor("variant") ?? row.variant ?? "",
    category: valueFor("category") ?? row.category ?? "other",
    price: valueFor("price") ?? row.price ?? "",
    regular_price: row.regular_price ?? "",
    member_card_price: row.member_card_price ?? "",
    sale_price: valueFor("sale_price") ?? Boolean(row.sale_price),
    coupon_required: valueFor("coupon_required") ?? Boolean(row.coupon_required),
    deal_limit: valueFor("deal_limit") ?? row.deal_limit ?? "",
    multibuy_details: valueFor("multibuy_details") ?? row.multibuy_details ?? "",
    promotion_text: valueFor("promotion_text") ?? row.promotion_text ?? "",
    size_text: valueFor("size_text") ?? row.size_text ?? "",
    quantity: valueFor("quantity") ?? row.quantity ?? 1,
    unit: valueFor("unit") ?? row.unit ?? "each",
    proof_type: row.proof_type || selectedImportBatch()?.proof_type || "weekly_ad",
    observed_at: row.observed_date || "",
    valid_start_at: row.valid_start_date || "",
    valid_end_at: valueFor("valid_end_at") ?? row.valid_end_date ?? "",
    source_url: row.source_url || "",
    source_title: row.source_title || "",
    source_checked_at: row.source_checked_date || "",
    extraction_confidence: row.extraction_confidence || "low",
    extraction_notes: row.extraction_notes || "",
    notes: row.notes || "",
    status: valueFor("status") ?? row.status ?? "ready_for_review"
  };
}

async function saveInlineImportRow(rowId) {
  try {
    setPriceImporterMessage(`Saving row #${rowId}...`);
    const data = await fetchJson(`/api/admin/price-import-rows/${rowId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importRowInlinePayload(rowId))
    });
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
    scrollToImportRow(rowId);
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function useImportProductMatch(rowId, productId) {
  const row = findImportRow(rowId);

  if (!row || !productId) {
    return;
  }

  try {
    const payload = { ...importRowInlinePayload(rowId), product_id: productId };
    const data = await fetchJson(`/api/admin/price-import-rows/${rowId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
    scrollToImportRow(rowId);
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

function renderPriceImportRows() {
  const batch = selectedImportBatch();

  if (!batch) {
    priceImportApproveSelected.disabled = true;
    priceImportApproveSelected.title = "";
    priceImportRejectSelected.disabled = true;
    priceImportRows.innerHTML = '<div class="empty-state">Select or upload a proof image before adding draft rows.</div>';
    resetPriceImportRowForm();
    renderPriceImportReviewFilters([]);
    renderPriceImportHistory();
    updateImportBulkButtons([]);
    return;
  }

  const rows = importRowsForCurrentBatch();
  updateImportBulkButtons(rows);
  renderPriceImportReviewFilters(rows);
  renderPriceImportHistory();

  if (!rows.length) {
    priceImportRows.innerHTML = '<div class="empty-state">No draft rows yet. Enter one reviewed price row using the form above.</div>';
    return;
  }

  const canApprove = canApproveImportedPrices();
  const visibleRows = filteredImportRows(rows);
  const proofUrl = adminUploadUrl(batch.photo_path);
  const allSelectableVisible = visibleRows.filter((row) => !["approved", "removed"].includes(row.status));
  const allSelected = allSelectableVisible.length && allSelectableVisible.every((row) => selectedPriceImportRows.has(String(row.id)));
  const approvalNotice = canApprove
    ? ""
    : '<p class="source-link-warning approval-login-warning">Log in as admin to approve imported prices.</p>';

  if (!visibleRows.length) {
    priceImportRows.innerHTML = approvalNotice + '<div class="empty-state">No rows match the current filters.</div>';
    return;
  }

  priceImportRows.innerHTML = `
    ${approvalNotice}
    <div class="review-table-wrap">
      <table class="review-table">
        <thead>
          <tr>
            <th><input type="checkbox" data-import-select-all ${allSelected ? "checked" : ""} aria-label="Select all visible rows"></th>
            <th>Proof</th>
            <th>Item</th>
            <th>Store</th>
            <th>Price</th>
            <th>Size</th>
            <th>Promo</th>
            <th>Product match</th>
            <th>Review</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map((row) => {
            const selected = selectedPriceImportRows.has(String(row.id));
            const approved = row.status === "approved";
            const rejected = row.status === "rejected";
            const removed = row.status === "removed";
            const issues = importRowIssues(row);
            const approveDisabled = approved || removed || !canApprove;
            const lowRiskClass = issues.length ? "has-review-warning" : "";

            return `
              <tr class="${lowRiskClass}" data-import-row-card="${row.id}">
                <td><input type="checkbox" data-import-select="${row.id}" ${selected ? "checked" : ""} ${approved || removed ? "disabled" : ""} aria-label="Select row ${row.id}"></td>
                <td>
                  ${proofUrl ? `<a class="proof-thumb" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(proofUrl)}" alt="Proof ${batch.id}"></a>` : '<span class="proof-mini-placeholder">URL</span>'}
                  <span class="badge ${importStatusClass(row.status)}">${escapeHtml(titleCase(row.status))}</span>
                </td>
                <td>
                  <input data-row-field="item_name" value="${escapeHtml(row.item_name || "")}" maxlength="120" ${approved || removed ? "disabled" : ""}>
                  <input data-row-field="brand" value="${escapeHtml(row.brand || "")}" maxlength="80" placeholder="Brand" ${approved || removed ? "disabled" : ""}>
                  <input data-row-field="variant" value="${escapeHtml(row.variant || "")}" maxlength="80" placeholder="Variant" ${approved || removed ? "disabled" : ""}>
                </td>
                <td>
                  <select data-row-field="store_id" ${approved || removed ? "disabled" : ""}>${storeOptions(row.store_id || "")}</select>
                  <select data-row-field="category" ${approved || removed ? "disabled" : ""}>${optionRows(categories, row.category || "other")}</select>
                </td>
                <td>
                  <input data-row-field="price" type="number" min="0.01" max="999" step="0.01" value="${row.price ?? ""}" ${approved || removed ? "disabled" : ""}>
                  <label class="mini-checkbox"><input data-row-field="sale_price" type="checkbox" ${row.sale_price ? "checked" : ""} ${approved || removed ? "disabled" : ""}> Sale</label>
                  <label class="mini-checkbox"><input data-row-field="coupon_required" type="checkbox" ${row.coupon_required ? "checked" : ""} ${approved || removed ? "disabled" : ""}> Coupon</label>
                </td>
                <td>
                  <input data-row-field="size_text" value="${escapeHtml(row.size_text || "")}" maxlength="80" placeholder="16 oz" ${approved || removed ? "disabled" : ""}>
                  <div class="inline-split">
                    <input data-row-field="quantity" type="number" min="0.01" step="0.01" value="${row.quantity ?? 1}" ${approved || removed ? "disabled" : ""}>
                    <input data-row-field="unit" value="${escapeHtml(row.unit || "each")}" maxlength="30" ${approved || removed ? "disabled" : ""}>
                  </div>
                </td>
                <td>
                  <input data-row-field="multibuy_details" value="${escapeHtml(row.multibuy_details || "")}" maxlength="120" placeholder="2 for $5" ${approved || removed ? "disabled" : ""}>
                  <input data-row-field="deal_limit" value="${escapeHtml(row.deal_limit || "")}" maxlength="80" placeholder="Limit" ${approved || removed ? "disabled" : ""}>
                  <input data-row-field="valid_end_at" type="date" value="${escapeHtml(row.valid_end_date || "")}" ${approved || removed ? "disabled" : ""}>
                  ${row.source_url ? `<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener noreferrer">View source</a>` : '<span class="muted">No source link</span>'}
                </td>
                <td>
                  <select data-row-field="product_id" ${approved || removed ? "disabled" : ""}>${productMatchOptions(row)}</select>
                  ${(row.product_matches || []).length ? `<small>${escapeHtml((row.product_matches || []).map((match) => `${match.display_name} ${match.score}`).join(" · "))}</small>` : '<small>No likely match</small>'}
                </td>
                <td>
                  <select data-row-field="status" ${approved || removed ? "disabled" : ""}>
                    <option value="import_draft" ${row.status === "import_draft" ? "selected" : ""}>Draft</option>
                    <option value="ready_for_review" ${row.status === "ready_for_review" ? "selected" : ""}>Needs review</option>
                    <option value="needs_edit" ${row.status === "needs_edit" ? "selected" : ""}>Needs edit</option>
                    <option value="approved" ${approved ? "selected" : ""} disabled>Approved</option>
                    <option value="rejected" ${rejected ? "selected" : ""} disabled>Rejected</option>
                    <option value="removed" ${removed ? "selected" : ""} disabled>Removed</option>
                  </select>
                  <div class="row-issues">${issues.length ? issues.map((issue) => `<span>${escapeHtml(issue)}</span>`).join("") : "<span>clear</span>"}</div>
                  ${row.duplicate_warning ? `<small class="duplicate-warning">${escapeHtml(row.duplicate_warning)}</small>` : ""}
                </td>
                <td>
                  <div class="table-actions">
                    <button class="secondary-button" type="button" data-import-save-inline="${row.id}" ${approved || removed ? "disabled" : ""}>Save</button>
                    <button class="quiet-button" type="button" data-import-edit="${row.id}" ${approved ? "disabled" : ""}>Full edit</button>
                    <button class="primary-button" type="button" data-import-approve="${row.id}" ${approveDisabled ? "disabled" : ""} title="${canApprove ? "" : "Log in as admin to approve imported prices."}">Approve</button>
                    <button class="danger-button" type="button" data-import-reject="${row.id}" ${approved || rejected || removed ? "disabled" : ""}>Reject</button>
                    ${!row.product_id && !approved && !removed ? `<button class="quiet-button" type="button" data-import-create-product="${row.id}">Create product</button>` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  const selectAll = priceImportRows.querySelector("[data-import-select-all]");
  selectAll?.addEventListener("change", () => {
    for (const row of allSelectableVisible) {
      if (selectAll.checked) {
        selectedPriceImportRows.add(String(row.id));
      } else {
        selectedPriceImportRows.delete(String(row.id));
      }
    }
    renderPriceImportRows();
  });

  for (const checkbox of priceImportRows.querySelectorAll("[data-import-select]")) {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedPriceImportRows.add(String(checkbox.dataset.importSelect));
      } else {
        selectedPriceImportRows.delete(String(checkbox.dataset.importSelect));
      }

      updateImportBulkButtons(rows);
    });
  }

  for (const button of priceImportRows.querySelectorAll("[data-import-save-inline]")) {
    button.addEventListener("click", () => saveInlineImportRow(button.dataset.importSaveInline));
  }

  for (const select of priceImportRows.querySelectorAll("[data-row-field='product_id']")) {
    select.addEventListener("change", () => {
      const rowCard = select.closest("[data-import-row-card]");
      if (rowCard && select.value) {
        useImportProductMatch(rowCard.dataset.importRowCard, select.value);
      }
    });
  }

  for (const button of priceImportRows.querySelectorAll("[data-import-edit]")) {
    button.addEventListener("click", () => editPriceImportRow(button.dataset.importEdit));
  }

  for (const button of priceImportRows.querySelectorAll("[data-import-approve]")) {
    button.addEventListener("click", () => approvePriceImportRowAction(button.dataset.importApprove));
  }

  for (const button of priceImportRows.querySelectorAll("[data-import-reject]")) {
    button.addEventListener("click", () => rejectPriceImportRowAction(button.dataset.importReject));
  }

  for (const button of priceImportRows.querySelectorAll("[data-import-create-product]")) {
    button.addEventListener("click", () => createProductForImportRow(button.dataset.importCreateProduct));
  }
}

function priceImportRowPayloadFromForm() {
  const formData = new FormData(priceImportRowForm);

  return {
    pin: getPin(),
    product_id: formData.get("product_id"),
    store_id: formData.get("store_id"),
    item_name: formData.get("item_name"),
    brand: formData.get("brand"),
    variant: formData.get("variant"),
    category: formData.get("category"),
    price: formData.get("price"),
    regular_price: formData.get("regular_price"),
    member_card_price: formData.get("member_card_price"),
    sale_price: formData.get("sale_price") === "on",
    coupon_required: formData.get("coupon_required") === "on",
    deal_limit: formData.get("deal_limit"),
    multibuy_details: formData.get("multibuy_details"),
    promotion_text: formData.get("promotion_text"),
    size_text: formData.get("size_text"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    proof_type: formData.get("proof_type"),
    observed_at: formData.get("observed_at"),
    valid_start_at: formData.get("valid_start_at"),
    valid_end_at: formData.get("valid_end_at"),
    source_url: formData.get("source_url"),
    source_title: formData.get("source_title"),
    source_checked_at: formData.get("source_checked_at"),
    extraction_confidence: formData.get("extraction_confidence"),
    extraction_notes: formData.get("extraction_notes"),
    duplicate_warning: formData.get("duplicate_warning"),
    notes: formData.get("notes"),
    status: formData.get("status")
  };
}

function renderPriceImportUploadPreview(files = []) {
  if (!priceImportUploadPreview) {
    return;
  }

  const fileList = [...files].slice(0, 10);

  if (!fileList.length) {
    priceImportUploadPreview.innerHTML = "";
    return;
  }

  priceImportUploadPreview.innerHTML = fileList.map((file) => {
    const url = URL.createObjectURL(file);

    return `
      <figure class="upload-preview-item">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(file.name)}">
        <figcaption>${escapeHtml(file.name)} · ${Math.round(file.size / 1024)} KB</figcaption>
      </figure>
    `;
  }).join("");
}

function setPriceImportFiles(files) {
  if (!priceImportProofInput) {
    return;
  }

  const transfer = new DataTransfer();

  for (const file of [...files].slice(0, 10)) {
    transfer.items.add(file);
  }

  priceImportProofInput.files = transfer.files;
  renderPriceImportUploadPreview(priceImportProofInput.files);
}

async function submitPriceImportUpload(event) {
  event.preventDefault();
  setPriceImporterMessage("Uploading proof image...");

  const formData = new FormData(priceImportUploadForm);
  formData.append("pin", getPin());

  try {
    const data = await fetchJson(`/api/admin/price-imports/upload${adminQuery()}`, {
      method: "POST",
      body: formData
    });
    selectedPriceImportBatchId = String(data.batches?.[0]?.id || selectedPriceImportBatchId || "");
    selectedPriceImportRows.clear();
    priceImportUploadForm.reset();
    renderPriceImportUploadPreview([]);
    setPriceImporterMessage(
      data.extraction_attempt?.message ? `${data.message} ${data.extraction_attempt.message}` : data.message,
      data.extraction_attempt?.status === "failed" ? "warning" : "success"
    );
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function submitPriceIntakeSourceOnly(event) {
  event.preventDefault();
  const formData = new FormData(priceIntakeSourceOnlyForm);
  setPriceImporterMessage("Creating source intake batch...");

  try {
    const data = await fetchJson("/api/admin/price-intake/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        source_type: formData.get("source_type"),
        proof_type: formData.get("proof_type"),
        default_store_id: formData.get("default_store_id"),
        batch_title: formData.get("batch_title"),
        source_url: formData.get("source_url"),
        source_title: formData.get("source_title"),
        observed_at: formData.get("observed_at"),
        valid_start_at: formData.get("valid_start_at"),
        valid_end_at: formData.get("valid_end_at"),
        source_text: formData.get("source_text"),
        notes: formData.get("notes")
      })
    });
    selectedPriceImportBatchId = String(data.batch?.id || "");
    selectedPriceImportRows.clear();
    priceIntakeSourceOnlyForm.reset();
    setPriceImporterMessage(
      data.extraction_attempt?.message ? `${data.message} ${data.extraction_attempt.message}` : data.message,
      data.extraction_attempt?.status === "failed" ? "warning" : "success"
    );
    await loadAdminData();
    const firstRow = (data.batch?.rows || []).find((row) => !["approved", "rejected", "removed"].includes(row.status));
    if (firstRow?.id) {
      scrollToImportRow(firstRow.id);
    }
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function submitPriceImportSourceText(event) {
  event.preventDefault();
  const batchId = selectedPriceImportBatchId;

  if (!batchId) {
    setPriceImporterMessage("Select a proof batch before parsing source text.", "error");
    return;
  }

  const formData = new FormData(priceImportSourceTextForm);
  setPriceImporterMessage("Parsing source text into draft rows...");

  try {
    const data = await fetchJson(`/api/admin/price-imports/${batchId}/parse-price-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        source_url: formData.get("source_url"),
        source_title: formData.get("source_title"),
        source_text: formData.get("source_text")
      })
    });
    selectedPriceImportBatchId = String(data.batch?.id || batchId);
    selectedPriceImportRows.clear();
    setPriceImporterMessage(
      data.extraction_attempt?.message ? `${data.message} ${data.extraction_attempt.message}` : data.message,
      data.duplicate ? "warning" : "success"
    );
    await loadAdminData();
    const firstRow = (data.rows || []).find((row) => !["approved", "rejected", "removed"].includes(row.status));
    if (firstRow?.id) {
      scrollToImportRow(firstRow.id);
    }
  } catch (error) {
    setPriceImporterMessage(error.message || "Source text could not be parsed. Add rows manually.", "warning");
  }
}

async function submitPriceImportReceiptText(event) {
  event.preventDefault();
  const batchId = selectedPriceImportBatchId;

  if (!batchId) {
    setPriceImporterMessage("Select a receipt proof batch before parsing receipt text.", "error");
    return;
  }

  const formData = new FormData(priceImportReceiptTextForm);
  setPriceImporterMessage("Using receipt helper text to create draft rows...");

  try {
    const data = await fetchJson(`/api/admin/price-imports/${batchId}/parse-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        receipt_text: formData.get("receipt_text")
      })
    });
    selectedPriceImportBatchId = String(data.batch?.id || batchId);
    selectedPriceImportRows.clear();
    setPriceImporterMessage(
      data.extraction_attempt?.message ? `${data.message} ${data.extraction_attempt.message}` : data.message,
      data.extraction_attempt?.status === "duplicate" ? "warning" : "success"
    );
    await loadAdminData();
    const firstRow = (data.rows || []).find((row) => !["approved", "rejected", "removed"].includes(row.status));
    if (firstRow?.id) {
      scrollToImportRow(firstRow.id);
    }
  } catch (error) {
    setPriceImporterMessage(error.message || "Receipt text could not be parsed. Enter the item and price manually.", "warning");
  }
}

async function submitPriceImportRow(event) {
  event.preventDefault();
  const rowId = priceImportRowForm.elements.row_id.value;
  const batchId = priceImportRowForm.elements.batch_id.value || selectedPriceImportBatchId;

  if (!batchId) {
    setPriceImporterMessage("Upload or select a proof image before saving a row.", "error");
    return;
  }

  setPriceImporterMessage(rowId ? "Saving import row..." : "Creating draft import row...");

  try {
    const data = await fetchJson(rowId ? `/api/admin/price-import-rows/${rowId}` : `/api/admin/price-imports/${batchId}/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(priceImportRowPayloadFromForm())
    });
    resetPriceImportRowForm();
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    if (error.data?.row?.id) {
      resetPriceImportRowForm(error.data.row);
      await loadAdminData();
      scrollToImportRow(error.data.row.id);
      setPriceImporterMessage(error.message, "warning");
      return;
    }

    setPriceImporterMessage(error.message, "error");
  }
}

function editPriceImportRow(rowId) {
  const row = findImportRow(rowId);

  if (!row) {
    setPriceImporterMessage("That import row is no longer visible.", "error");
    return;
  }

  selectedPriceImportBatchId = String(row.batch_id);
  resetPriceImportRowForm(row);
  priceImportRowForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function approvePriceImportRowAction(rowId) {
  if (!canApproveImportedPrices()) {
    setPriceImporterMessage("Log in as admin to approve imported prices.", "warning");
    return;
  }

  if (!window.confirm("Approve this imported price into public Grocery Radar reports?")) {
    return;
  }

  try {
    setPriceImporterMessage("Approving import row...");
    const displayedRow = findImportRow(rowId);
    const data = await fetchJson(`/api/admin/price-import-rows/${rowId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin(), expected_draft_updated_at: displayedRow?.updated_at || "" })
    });
    selectedPriceImportRows.delete(String(rowId));
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function rejectPriceImportRowAction(rowId) {
  const reason = window.prompt("Why is this import row rejected?", "Rejected by admin.");

  if (reason === null) {
    return;
  }

  try {
    setPriceImporterMessage("Rejecting import row...");
    const data = await fetchJson(`/api/admin/price-import-rows/${rowId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        admin_rejection_note: reason
      })
    });
    selectedPriceImportRows.delete(String(rowId));
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function createProductForImportRow(rowId) {
  if (!window.confirm("Create a product from this reviewed import row and link it?")) {
    return;
  }

  try {
    setPriceImporterMessage("Creating product...");
    const data = await fetchJson(`/api/admin/price-import-rows/${rowId}/create-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin() })
    });
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function bulkPriceImport(action) {
  const rowIds = [...selectedPriceImportRows];

  if (!rowIds.length) {
    setPriceImporterMessage("Choose at least one import row.", "error");
    return;
  }

  let adminRejectionNote = "";

  if (action === "approve" && !canApproveImportedPrices()) {
    setPriceImporterMessage("Log in as admin to approve imported prices.", "warning");
    return;
  }

  if (action === "approve" && !window.confirm(`Approve ${rowIds.length} selected imported row${rowIds.length === 1 ? "" : "s"}?`)) {
    return;
  }

  if (action === "remove" && !window.confirm(`Remove ${rowIds.length} selected draft row${rowIds.length === 1 ? "" : "s"} from review? Approved rows will not be changed.`)) {
    return;
  }

  if (action === "reject") {
    const reason = window.prompt(`Why reject ${rowIds.length} selected import row${rowIds.length === 1 ? "" : "s"}?`, "Bulk rejected by admin.");

    if (reason === null) {
      return;
    }

    adminRejectionNote = reason;
  }

  try {
    setPriceImporterMessage(
      action === "approve"
        ? "Approving selected import rows..."
        : action === "remove"
          ? "Removing selected draft rows..."
          : "Rejecting selected import rows..."
    );
    const data = await fetchJson("/api/admin/price-import-rows/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin: getPin(),
        action,
        row_ids: rowIds,
        admin_rejection_note: adminRejectionNote
      })
    });
    selectedPriceImportRows.clear();
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function submitPriceImportBulkEdit(event) {
  event.preventDefault();
  const rowIds = [...selectedPriceImportRows];

  if (!rowIds.length) {
    setPriceImporterMessage("Choose at least one import row before bulk editing.", "error");
    return;
  }

  const formData = new FormData(priceImportBulkEditForm);
  const payload = {
    pin: getPin(),
    action: "update",
    row_ids: rowIds
  };

  for (const field of ["store_id", "category", "observed_at", "valid_start_at", "valid_end_at", "status"]) {
    const value = formData.get(field);
    if (value) {
      payload[field] = value;
    }
  }

  if (Object.keys(payload).length <= 3) {
    setPriceImporterMessage("Choose at least one bulk field to update.", "error");
    return;
  }

  try {
    setPriceImporterMessage("Applying bulk edits...");
    const data = await fetchJson("/api/admin/price-import-rows/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    priceImportBulkEditForm.reset();
    selectedPriceImportRows.clear();
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

async function undoSelectedImportBatch() {
  const batch = selectedImportBatch();

  if (!batch) {
    setPriceImporterMessage("Select an import batch before undoing approvals.", "error");
    return;
  }

  if (!window.confirm(`Undo safely created public reports from ${importProofLabel(batch)}? Reports with verification or dispute activity will be refused.`)) {
    return;
  }

  try {
    setPriceImporterMessage("Checking and undoing approved batch...");
    const data = await fetchJson(`/api/admin/price-imports/${batch.id}/undo-approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: getPin() })
    });
    selectedPriceImportRows.clear();
    setPriceImporterMessage(data.message, "success");
    await loadAdminData();
  } catch (error) {
    setPriceImporterMessage(error.message, "error");
  }
}

function renderCatalogImport(batch) {
  if (!catalogImportResults || !batch) return;
  catalogImportResults.dataset.batchId = batch.id;
  catalogImagesForm.hidden = false;
  catalogImagesForm.elements.batch_id.value = batch.id;
  const rows = batch.rows || [];
  catalogImportResults.innerHTML = `<div class="admin-panel-heading"><div><h4>${escapeHtml(batch.title || `Catalog #${batch.id}`)}</h4><p>${rows.length} draft product${rows.length === 1 ? "" : "s"}. Nothing is public yet.</p></div><button class="primary-button" type="button" data-publish-catalog>Publish reviewed drafts</button></div>${rows.map((row) => `<article class="inbox-card"><div class="inbox-card-main"><strong>${escapeHtml(row.product_name)}</strong><span>${escapeHtml([row.brand, row.variant, row.size_text].filter(Boolean).join(" · ") || "No extra details")}</span><span>${escapeHtml(titleCase(row.category || "other"))} · Image: ${escapeHtml(titleCase(row.image_match_confidence || "not matched"))}</span>${row.duplicate_product_id ? `<span class="warning">Possible duplicate of product #${row.duplicate_product_id}</span>` : ""}${(row.warnings || []).map((warning) => `<span class="warning">${escapeHtml(warning)}</span>`).join("")}</div><span class="badge ${row.status === "published" ? "confidence-high" : "status-ready"}">${escapeHtml(titleCase(row.status))}</span></article>`).join("")}`;
  catalogImportResults.querySelector("[data-publish-catalog]")?.addEventListener("click", () => publishCatalog(batch.id));
}

async function submitCatalogImport(event) {
  event.preventDefault();
  const form = new FormData(catalogImportForm);
  try {
    setMessage(catalogImportMessage, "Creating draft catalog...");
    const data = await fetchJson(`/api/admin/catalog-imports${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), title: form.get("title"), csv_text: form.get("catalog_text") }) });
    setMessage(catalogImportMessage, data.message, "success");
    renderCatalogImport(data.batch);
  } catch (error) { setMessage(catalogImportMessage, error.message, "error"); }
}

async function submitCatalogImages(event) {
  event.preventDefault();
  const batchId = catalogImagesForm.elements.batch_id.value;
  const body = new FormData(catalogImagesForm);
  body.append("pin", getPin());
  try {
    setMessage(catalogImportMessage, "Matching images to draft products...");
    const data = await fetchJson(`/api/admin/catalog-imports/${batchId}/images${adminQuery()}`, { method: "POST", body });
    setMessage(catalogImportMessage, data.message, "success");
    renderCatalogImport(data.batch);
  } catch (error) { setMessage(catalogImportMessage, error.message, "error"); }
}

async function publishCatalog(batchId) {
  if (!window.confirm("Publish reviewed, non-duplicate catalog drafts? Uncertain image matches will remain private.")) return;
  try {
    const data = await fetchJson(`/api/admin/catalog-imports/${batchId}/publish${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) });
    setMessage(catalogImportMessage, data.message, "success");
    renderCatalogImport(data.batch);
    await loadAdminData();
  } catch (error) { setMessage(catalogImportMessage, error.message, "error"); }
}

async function loadAiSettings() {
  if (!aiSettingsForm) return;
  try {
    const data = await fetchJson(`/api/admin/operations/ai-settings${adminQuery()}`);
    const settings = data.settings || {};
    for (const name of ["max_analyses_per_hour", "max_analyses_per_day", "retry_limit", "max_concurrency", "max_queued_jobs", "primary_model", "fallback_model"]) aiSettingsForm.elements[name].value = settings[name] ?? "";
    aiSettingsForm.elements.enabled.checked = Boolean(settings.enabled);
    aiSettingsForm.elements.manual_only.checked = Boolean(settings.manual_only);
    const today = settings.usage?.today || {};
    const month = settings.usage?.month || {};
    const costLine = today.estimated_cost_usd == null && month.estimated_cost_usd == null ? "Provider did not report cost." : `Reported estimated spend: today $${Number(today.estimated_cost_usd || 0).toFixed(4)} · this month $${Number(month.estimated_cost_usd || 0).toFixed(4)}`;
    aiUsageSummary.innerHTML = `<div class="simple-status-row"><span>Today</span><span>${Number(today.analyses || 0)} analyses · ${Number(today.retries || 0)} retries · ${Number(today.failures || 0)} failures</span></div><div class="simple-status-row"><span>This month</span><span>${Number(month.analyses || 0)} analyses · ${Number(month.retries || 0)} retries</span></div><p class="field-help">${escapeHtml(costLine)}</p>`;
    setMessage(aiSettingsMessage, settings.credential_configured ? `Provider configured: ${settings.provider}.` : "No server-side AI credential is configured. Manual fallback remains available.", settings.credential_configured ? "success" : "info");
  } catch (error) { setMessage(aiSettingsMessage, error.message, "error"); }
}

async function saveAiSettings(event) {
  event.preventDefault();
  const form = new FormData(aiSettingsForm);
  try {
    const data = await fetchJson(`/api/admin/operations/ai-settings${adminQuery()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin(), enabled: form.get("enabled") === "on", manual_only: form.get("manual_only") === "on", max_analyses_per_hour: form.get("max_analyses_per_hour"), max_analyses_per_day: form.get("max_analyses_per_day"), retry_limit: form.get("retry_limit"), max_concurrency: form.get("max_concurrency"), max_queued_jobs: form.get("max_queued_jobs"), primary_model: form.get("primary_model"), fallback_model: form.get("fallback_model") }) });
    setMessage(aiSettingsMessage, data.message, "success");
    await loadAiSettings();
  } catch (error) { setMessage(aiSettingsMessage, error.message, "error"); }
}

function renderBulkPriceIntake(data) {
  if (!bulkPriceIntakeResults || !data?.batch) return;
  const batch = data.batch;
  const counts = batch.counts || {};
  bulkPriceIntakeResults.innerHTML = `<article class="admin-card compact-card"><div class="card-topline"><div><h3>Batch #${batch.id} · ${escapeHtml(batch.title)}</h3><p class="field-help">${escapeHtml(batch.submitted_store_name || "Store not supplied")} · ${batch.file_count} images</p></div><span class="badge confidence-medium">${escapeHtml(titleCase(batch.status))}</span></div><div class="simple-status-list"><div class="simple-status-row"><span>Progress</span><span>${Number(counts.ready || 0)} ready · ${Number(counts.processing || 0)} processing · ${Number(counts.needs_attention || 0)} need attention · ${Number(counts.failed || 0)} failed · ${Number(counts.duplicate || 0)} duplicate · ${Number(counts.reviewed || 0)} reviewed</span></div><div class="simple-status-row"><span>AI usage</span><span>${batch.usage.attempts} attempts · ${batch.usage.retries} retries · ${batch.usage.failures} failures${batch.usage.total_tokens == null ? "" : ` · ${batch.usage.total_tokens} tokens`}</span></div></div><div class="card-actions"><button class="secondary-button" type="button" data-open-bulk-review>Review Drafts</button><button class="quiet-button" type="button" data-pause-bulk>${batch.paused ? "Resume Processing" : "Pause Processing"}</button></div>${batch.items.map((item) => `<div class="simple-status-row"><span>${escapeHtml(item.original_name)}</span><span>${escapeHtml(titleCase(item.status))}${item.error ? ` · ${escapeHtml(item.error)}` : ""}${item.duplicate_of_proof_id ? ` · Duplicate of proof #${item.duplicate_of_proof_id}` : ""} ${["failed","needs_attention"].includes(item.status) && item.proof_id ? `<button class="quiet-button" data-retry-bulk-item="${item.id}">Retry</button>` : ""}${item.status === "duplicate" ? `<button class="quiet-button" data-process-bulk-item="${item.id}">Process Anyway</button>` : ""}</span></div>`).join("")}</article>`;
  bulkPriceIntakeResults.querySelector("[data-open-bulk-review]")?.addEventListener("click", () => { const proof = batch.items.find((item) => item.proof_id && ["ready", "needs_attention"].includes(item.status)); if (proof) openReceiptReview(proof.proof_id); else setMessage(bulkPriceIntakeMessage, "No draft is ready for review yet.", "info"); });
  bulkPriceIntakeResults.querySelector("[data-pause-bulk]")?.addEventListener("click", async () => { const next = !batch.paused; const result = await fetchJson(`/api/admin/bulk-price-intake/${batch.id}/pause`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: next, pin: getPin() }) }); renderBulkPriceIntake(result); });
  for (const button of bulkPriceIntakeResults.querySelectorAll("[data-retry-bulk-item]")) button.addEventListener("click", async () => { const result = await fetchJson(`/api/admin/bulk-price-intake/items/${button.dataset.retryBulkItem}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) }); setMessage(bulkPriceIntakeMessage, result.message, "success"); });
  for (const button of bulkPriceIntakeResults.querySelectorAll("[data-process-bulk-item]")) button.addEventListener("click", async () => { if (!window.confirm("Process this exact duplicate and allow another AI call?")) return; const result = await fetchJson(`/api/admin/bulk-price-intake/items/${button.dataset.processBulkItem}/process-anyway`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: getPin() }) }); renderBulkPriceIntake(result); });
}

async function submitBulkPriceIntake(event) {
  event.preventDefault();
  const body = new FormData(bulkPriceIntakeForm);
  body.append("pin", getPin());
  try { setMessage(bulkPriceIntakeMessage, "Uploading batch..."); const data = await fetchJson("/api/admin/bulk-price-intake", { method: "POST", body }); setMessage(bulkPriceIntakeMessage, data.message, "success"); renderBulkPriceIntake(data); }
  catch (error) { setMessage(bulkPriceIntakeMessage, error.message, "error"); }
}

function renderBulkProductImages(data) {
  if (!bulkProductImagesResults || !data?.batch) return;
  const batch = data.batch;
  const products = productTools?.products || [];
  bulkProductImagesResults.innerHTML = `<article class="admin-card compact-card"><h3>Image Batch #${batch.id} · ${escapeHtml(batch.title)}</h3>${batch.items.map((item) => `<div class="simple-status-row"><span><strong>${escapeHtml(item.original_name)}</strong><br>${escapeHtml(item.suggested_product_name || "Product match needs review")} · ${escapeHtml(titleCase(item.match_confidence))}${item.duplicate_of_image_id ? ` · Existing image #${item.duplicate_of_image_id}` : ""}</span><span>${!item.duplicate_of_image_id && item.status !== "failed" ? `<select data-image-product="${item.id}"><option value="">Choose product</option>${products.map((product) => `<option value="${product.id}" ${Number(product.id) === Number(item.suggested_product_id) ? "selected" : ""}>${escapeHtml(product.display_name)}</option>`).join("")}</select><button class="secondary-button" data-accept-image="${item.id}">Accept</button>` : escapeHtml(titleCase(item.status))}</span></div>`).join("")}</article>`;
  for (const button of bulkProductImagesResults.querySelectorAll("[data-accept-image]")) button.addEventListener("click", async () => { const select = bulkProductImagesResults.querySelector(`[data-image-product="${button.dataset.acceptImage}"]`); if (!select?.value) { setMessage(bulkProductImagesMessage, "Choose the correct product first.", "warning"); return; } const approve = window.confirm("Approve this human-confirmed match as the public primary product image? Cancel saves it as a private moderation draft."); const result = await fetchJson(`/api/admin/product-images/bulk/items/${button.dataset.acceptImage}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: select.value, approve_public: approve, pin: getPin() }) }); setMessage(bulkProductImagesMessage, result.message, "success"); renderBulkProductImages(result); });
}

async function submitBulkProductImages(event) {
  event.preventDefault();
  const body = new FormData(bulkProductImagesForm);
  body.append("pin", getPin());
  try { setMessage(bulkProductImagesMessage, "Uploading private image drafts..."); const data = await fetchJson("/api/admin/product-images/bulk", { method: "POST", body }); setMessage(bulkProductImagesMessage, data.message, "success"); renderBulkProductImages(data); }
  catch (error) { setMessage(bulkProductImagesMessage, error.message, "error"); }
}

function setupAdminTabs() {
  for (const button of document.querySelectorAll("[data-admin-tab]")) {
    button.addEventListener("click", () => goToAdminTab(button.dataset.adminTab));
  }
  for (const button of document.querySelectorAll("[data-jump-tab]")) {
    button.addEventListener("click", () => goToAdminTab(button.dataset.jumpTab));
  }
}

async function boot() {
  setupAdminTabs();
  populateCategorySelect(manualCategory);
  populateCategorySelect(priceImportRowForm.elements.category);
  setPriceImportMode("weekly_ad", { skipRender: true });
  updateManualPhotoRequirement();
  await loadStores();

  await loadAdminData();

  applyAdminInitialRoute();
}

function applyAdminInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (!tab) {
    return;
  }

  goToAdminTab(tab, {
    reportId: params.get("report") || "",
    userId: params.get("user") || "",
    storeRequestId: params.get("storeRequest") || "",
    suggestionId: params.get("suggestion") || "",
    filter: params.get("filter") || "",
    priceImportBatchId: params.get("batch") || ""
  });
  if (tab === "inboxTab" && params.get("batch")) {
    openReceiptReview(params.get("batch"));
  }
}

pinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadAdminData().catch((error) => setAdminMessage(error.message, "error"));
});
emailTestForm.addEventListener("submit", sendEmailTest);
runEmailDiagnosticButton.addEventListener("click", runEmailDiagnostic);
adminStoreForm.addEventListener("submit", addStore);
if (usernameBlockForm) {
  usernameBlockForm.addEventListener("submit", addUsernamePhrase);
}
sponsorForm.addEventListener("submit", saveSponsor);
manualProofType.addEventListener("change", updateManualPhotoRequirement);
manualProofPhotoInput.addEventListener("change", updateManualPhotoStatus);
manualEntryForm.addEventListener("submit", submitManualEntry);
priceImportUploadForm.addEventListener("submit", submitPriceImportUpload);
priceIntakeSourceOnlyForm.addEventListener("submit", submitPriceIntakeSourceOnly);
priceImportSourceTextForm.addEventListener("submit", submitPriceImportSourceText);
priceImportReceiptTextForm.addEventListener("submit", submitPriceImportReceiptText);
priceImportRowForm.addEventListener("submit", submitPriceImportRow);
priceImportResetRow.addEventListener("click", () => resetPriceImportRowForm());
priceImportApproveSelected.addEventListener("click", () => bulkPriceImport("approve"));
priceImportRejectSelected.addEventListener("click", () => bulkPriceImport("reject"));
priceImportBulkEditForm.addEventListener("submit", submitPriceImportBulkEdit);
priceImportRemoveSelected.addEventListener("click", () => bulkPriceImport("remove"));
priceImportUndoBatch.addEventListener("click", undoSelectedImportBatch);
catalogImportForm?.addEventListener("submit", submitCatalogImport);
catalogImagesForm?.addEventListener("submit", submitCatalogImages);
aiSettingsForm?.addEventListener("submit", saveAiSettings);
bulkPriceIntakeForm?.addEventListener("submit", submitBulkPriceIntake);
bulkProductImagesForm?.addEventListener("submit", submitBulkProductImages);
operationsRefreshButton?.addEventListener("click", () => loadOperationsCenter());
operationsAutoRefresh?.addEventListener("change", scheduleOperationsRefresh);
reviewNextButton?.addEventListener("click", startReviewNext);
for (const button of inboxFilters?.querySelectorAll("[data-inbox-filter]") || []) {
  button.addEventListener("click", () => {
    activeInboxFilter = button.dataset.inboxFilter;
    for (const filter of inboxFilters.querySelectorAll("[data-inbox-filter]")) filter.classList.toggle("is-active", filter === button);
    renderInbox();
  });
}
adminNotificationBell?.addEventListener("click", () => {
  if (!adminV2NotificationPanel) return;
  adminV2NotificationPanel.hidden = !adminV2NotificationPanel.hidden;
  adminNotificationBell.setAttribute("aria-expanded", String(!adminV2NotificationPanel.hidden));
});

priceImportProofInput.addEventListener("change", () => renderPriceImportUploadPreview(priceImportProofInput.files));
priceImportDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  priceImportDropZone.classList.add("is-dragover");
});
priceImportDropZone.addEventListener("dragleave", () => {
  priceImportDropZone.classList.remove("is-dragover");
});
priceImportDropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  priceImportDropZone.classList.remove("is-dragover");
  setPriceImportFiles([...event.dataTransfer.files].filter((file) => /^image\/(jpeg|png|webp)$/i.test(file.type)));
});

for (const button of priceImportModeTabs.querySelectorAll("[data-import-mode]")) {
  button.addEventListener("click", () => setPriceImportMode(button.dataset.importMode));
}

pinInput.value = localStorage.getItem("groceryRadarAdminPin") || "";

boot().catch((error) => setAdminMessage(error.message, "error"));
