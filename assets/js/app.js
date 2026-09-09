const DEFAULT_TITLE = "13 Dimensions Studio Privacy Policies";
const DEFAULT_LOGO = "assets/images/logo.jpg";

const state = {
    policies: [],
    selectedId: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    initialize().catch((error) => {
        console.error(error);
        showPolicyView();
        renderErrorState("The privacy policy directory could not load its data.");
    });
});

async function initialize() {
    const manifest = window.PRIVACY_POLICY_DATA;
    if (!manifest || !Array.isArray(manifest.policies)) {
        throw new Error("Bundled policy data is missing.");
    }

    state.policies = manifest.policies
        .slice()
        .sort((first, second) => {
            const orderDelta = (first.order ?? 9999) - (second.order ?? 9999);
            if (orderDelta !== 0) {
                return orderDelta;
            }
            return (first.name || "").localeCompare(second.name || "");
        });

    renderSidebar();
    els.metricTotalPolicies.textContent = String(state.policies.length);
    initializeParallax();

    const requestedId = getRequestedPolicyId();
    if (state.policies.some((policy) => policy.id === requestedId)) {
        await selectPolicy(requestedId, { updateHistory: false });
    } else {
        showDashboard();
    }
}

function cacheElements() {
    [
        "sidebar",
        "sidebarScrim",
        "policyList",
        "dashboardMenuToggle",
        "policyMenuToggle",
        "openPoliciesButton",
        "backHomeButton",
        "copyLinkButton",
        "dashboardHero",
        "policyView",
        "metricTotalPolicies",
        "dashboardLogo",
        "policyHeading",
        "policySummary",
        "policyDate",
        "policyStatus",
        "policyPlatform",
        "policyLogo",
        "policyLogoTitle",
        "policyLinkCaption",
        "policyLink",
        "policyTitle",
        "policyContent"
    ].forEach((id) => {
        els[id] = document.getElementById(id);
    });
}

function bindEvents() {
    [els.dashboardMenuToggle, els.policyMenuToggle, els.openPoliciesButton].forEach((button) => {
        button.addEventListener("click", () => setSidebarOpen(true));
    });

    els.sidebarScrim.addEventListener("click", () => setSidebarOpen(false));
    els.backHomeButton.addEventListener("click", goHome);
    els.copyLinkButton.addEventListener("click", copySelectedLink);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setSidebarOpen(false);
        }
    });
}

function renderSidebar() {
    els.policyList.innerHTML = "";

    state.policies.forEach((policy) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `policy-item${policy.id === state.selectedId ? " is-active" : ""}`;
        button.innerHTML = `
            <div class="policy-item-head">
                <span class="policy-item-name">${escapeHtml(policy.name)}</span>
                <span class="mini-chip">${escapeHtml(policy.status || "Published")}</span>
            </div>
            <p>${escapeHtml(policy.excerpt || "")}</p>
        `;

        button.addEventListener("click", async () => {
            await selectPolicy(policy.id, { updateHistory: true });
            setSidebarOpen(false);
        });

        els.policyList.appendChild(button);
    });
}

async function selectPolicy(policyId, options = {}) {
    const policy = state.policies.find((entry) => entry.id === policyId);
    if (!policy) {
        return;
    }

    state.selectedId = policy.id;
    renderSidebar();
    showPolicyView();
    renderLoadingState();
    updateMeta(policy);

    try {
        els.policyContent.innerHTML = markdownToHtml(getPolicyContent(policy));
        updateMeta(policy);
        if (options.updateHistory !== false) {
            updatePolicyUrl(policy.id);
        }
        document.title = `${policy.name} | ${DEFAULT_TITLE}`;
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error(error);
        renderErrorState("The selected privacy policy could not be displayed.");
    }
}

function goHome() {
    state.selectedId = null;
    renderSidebar();
    showDashboard();
    clearPolicyUrl();
}

function showDashboard() {
    els.dashboardHero.hidden = false;
    els.policyView.hidden = true;
    document.title = DEFAULT_TITLE;
}

function showPolicyView() {
    els.dashboardHero.hidden = true;
    els.policyView.hidden = false;
}

function updateMeta(policy) {
    const formattedDate = formatDate(policy.effectiveDate);
    const logoSrc = policy.logo || DEFAULT_LOGO;

    els.policyHeading.textContent = policy.name;
    els.policySummary.textContent = policy.excerpt || "";
    els.policyDate.textContent = formattedDate;
    els.policyStatus.textContent = policy.status || "Published";
    els.policyPlatform.textContent = policy.platform || "-";
    els.policyTitle.textContent = policy.name;
    els.policyLink.textContent = buildSelectedLink(policy.id);
    els.policyLogo.src = logoSrc;
    els.policyLogo.alt = `${policy.name} logo`;
    els.policyLogoTitle.textContent = policy.name;
    els.policyLinkCaption.textContent = `Direct link ready for ${policy.name}.`;
}

function renderLoadingState() {
    els.policyContent.innerHTML = `
        <div class="empty-state">
            <p class="empty-kicker">Loading</p>
            <h2>Opening privacy policy</h2>
            <p>Please wait while the selected policy is displayed.</p>
        </div>
    `;
}

function renderErrorState(message) {
    els.policyContent.innerHTML = `
        <div class="empty-state">
            <p class="empty-kicker">Load Error</p>
            <h2>Something went wrong</h2>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function getPolicyContent(policy) {
    if (!policy.content) {
        throw new Error("Policy content is missing.");
    }
    return policy.content;
}

function setSidebarOpen(open) {
    els.sidebar.classList.toggle("is-open", open);
    els.sidebarScrim.classList.toggle("is-visible", open);
    els.sidebar.setAttribute("aria-hidden", String(!open));
}

function getRequestedPolicyId() {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("app");
    const hashId = window.location.hash.replace(/^#/, "");
    return slugify(queryId || hashId || "");
}

function updatePolicyUrl(policyId) {
    const url = new URL(window.location.href);
    url.searchParams.set("app", policyId);
    url.hash = policyId;
    history.replaceState({}, "", url);
}

function clearPolicyUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    url.hash = "";
    history.replaceState({}, "", url);
}

function buildSelectedLink(policyId = state.selectedId) {
    const url = new URL(window.location.href);
    if (!policyId) {
        url.searchParams.delete("app");
        url.hash = "";
        return url.toString();
    }
    url.searchParams.set("app", policyId);
    url.hash = policyId;
    return url.toString();
}

async function copySelectedLink() {
    if (!state.selectedId) {
        return;
    }

    try {
        await navigator.clipboard.writeText(buildSelectedLink());
        els.copyLinkButton.textContent = "Link Copied";
        window.setTimeout(() => {
            els.copyLinkButton.textContent = "Copy Policy Link";
        }, 1400);
    } catch (error) {
        console.error(error);
    }
}

function initializeParallax() {
    const layers = Array.from(document.querySelectorAll("[data-parallax-layer]"));
    if (!layers.length) {
        return;
    }

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;

    window.addEventListener("pointermove", (event) => {
        const x = (event.clientX / window.innerWidth) - 0.5;
        const y = (event.clientY / window.innerHeight) - 0.5;
        targetX = x;
        targetY = y;

        if (!rafId) {
            rafId = window.requestAnimationFrame(() => {
                layers.forEach((layer) => {
                    const depth = Number(layer.dataset.parallaxLayer || 0);
                    layer.style.transform = `translate3d(${targetX * 80 * depth}px, ${targetY * 80 * depth}px, 0)`;
                });
                rafId = 0;
            });
        }
    }, { passive: true });
}

function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r/g, "").split("\n");
    const html = [];
    let paragraph = [];
    let unordered = [];
    let ordered = [];

    const flushParagraph = () => {
        if (!paragraph.length) {
            return;
        }
        html.push(`<p>${parseInline(paragraph.join(" "))}</p>`);
        paragraph = [];
    };

    const flushUnordered = () => {
        if (!unordered.length) {
            return;
        }
        html.push(`<ul>${unordered.map((item) => `<li>${parseInline(item)}</li>`).join("")}</ul>`);
        unordered = [];
    };

    const flushOrdered = () => {
        if (!ordered.length) {
            return;
        }
        html.push(`<ol>${ordered.map((item) => `<li>${parseInline(item)}</li>`).join("")}</ol>`);
        ordered = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushUnordered();
            flushOrdered();
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushUnordered();
            flushOrdered();
            const level = Math.min(headingMatch[1].length, 6);
            html.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
            return;
        }

        const unorderedMatch = line.match(/^-\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            flushOrdered();
            unordered.push(unorderedMatch[1]);
            return;
        }

        const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            flushUnordered();
            ordered.push(orderedMatch[1]);
            return;
        }

        paragraph.push(line);
    });

    flushParagraph();
    flushUnordered();
    flushOrdered();
    return html.join("");
}

function parseInline(text) {
    const storedLinks = [];
    const withPlaceholders = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
        (_, label, url) => {
            const token = `@@LINK${storedLinks.length}@@`;
            storedLinks.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`);
            return token;
        }
    );

    let output = escapeHtml(withPlaceholders);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');

    storedLinks.forEach((link, index) => {
        output = output.replace(`@@LINK${index}@@`, link);
    });

    return output;
}

function formatDate(value) {
    if (!value) {
        return "No date";
    }

    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
