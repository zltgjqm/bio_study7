// Biology Second Brain — localStorage data + dependency-free search + relationship graph

(function () {
  const STORAGE_KEY = "biologySecondBrain.localData.v1";
  const TYPE_LABELS = {
    disease: "Disease",
    gene: "Gene",
    cell_type: "Cell Type",
    tissue: "Tissue",
    paper: "Paper",
    knowledge: "Knowledge",
  };

  // API 없이 쓰는 표준화 사전. 필요한 alias는 여기만 계속 추가하면 됩니다.
  const CANONICAL_ALIASES = {
    disease: {
      "pdac": "PDAC",
      "pancreatic ductal adenocarcinoma": "PDAC",
      "pancreatic cancer": "PDAC",
      "췌장암": "PDAC",
      "crc": "CRC",
      "colorectal cancer": "CRC",
      "colon cancer": "CRC",
      "lung cancer": "Lung cancer",
      "fibrotic lung disease": "Fibrotic lung disease",
      "pulmonary fibrosis": "Fibrotic lung disease",
    },
    gene: {
      "kras": "KRAS",
      "cxcl13": "CXCL13",
      "cxcl12": "CXCL12",
      "cxcr4": "CXCR4",
      "il1b": "IL1B",
      "il-1b": "IL1B",
      "il1β": "IL1B",
      "il-1β": "IL1B",
    },
    cell_type: {
      "macrophage": "Macrophage",
      "macrophages": "Macrophage",
      "대식세포": "Macrophage",
      "caf": "CAF",
      "cancer associated fibroblast": "CAF",
      "cancer-associated fibroblast": "CAF",
      "fibroblast": "Fibroblast",
      "treg": "Regulatory T cell",
      "regulatory t cell": "Regulatory T cell",
      "cd8 t cell": "CD8 T cell",
      "cd8+ t cell": "CD8 T cell",
      "exhausted cd8 t cell": "Exhausted CD8 T cell",
    },
    tissue: {
      "lung": "Lung",
      "lung tissue": "Lung",
      "pulmonary tissue": "Lung",
      "폐": "Lung",
      "폐조직": "Lung",
      "pancreas": "Pancreas",
      "pancreatic tissue": "Pancreas",
      "췌장": "Pancreas",
      "colon": "Colon",
      "colon tissue": "Colon",
    },
  };

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
    return String(value).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  }
  function unique(values) {
    const seen = new Set();
    return asArray(values).filter((v) => {
      const key = norm(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function canonicalize(type, value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const key = norm(raw).replace(/[–—]/g, "-").replace(/\s+/g, " ");
    const map = CANONICAL_ALIASES[type] || {};
    if (map[key]) return map[key];
    if (type === "gene") return raw.toUpperCase();
    return raw;
  }
  function canonicalArray(type, values) {
    return unique(asArray(values).map((v) => canonicalize(type, v)));
  }
  function canonicalObjectKeys(type, obj = {}) {
    const out = {};
    Object.keys(obj || {}).forEach((key) => {
      const canon = canonicalize(type, key);
      const lines = Array.isArray(obj[key]) ? obj[key].filter(Boolean) : asArray(obj[key]);
      if (!canon || !lines.length) return;
      out[canon] = unique([...(out[canon] || []), ...lines]);
    });
    return out;
  }
  function normalizeKnowledgeUnits(units) {
    if (!Array.isArray(units)) return [];
    return units.map((u, idx) => ({
      id: u.id || `unit-${idx + 1}`,
      title: String(u.title || u.claim || `Knowledge unit ${idx + 1}`).trim(),
      claim: String(u.claim || u.title || "").trim(),
      disease: canonicalArray("disease", u.disease || u.diseases),
      genes: canonicalArray("gene", u.genes),
      cellTypes: canonicalArray("cell_type", u.cellTypes),
      tissues: canonicalArray("tissue", u.tissues),
      evidence: String(u.evidence || u.figure || u.method || "").trim(),
      note: String(u.note || u.description || "").trim(),
      tags: unique(u.tags),
    })).filter((u) => u.claim || u.title || u.evidence || u.note);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }

  function emptyLocalData() { return { papers: [], knowledge: [] }; }
  function loadLocalData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        papers: Array.isArray(parsed.papers) ? parsed.papers : [],
        knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
      };
    } catch (e) { return emptyLocalData(); }
  }
  function saveLocalData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ papers: data.papers || [], knowledge: data.knowledge || [] }));
  }
  function collectionName(type) { return type === "knowledge" ? "knowledge" : "papers"; }
  function findLocalItem(type, id) {
    const local = loadLocalData();
    const collection = collectionName(type);
    const index = (local[collection] || []).findIndex((item) => String(item.id) === String(id));
    return { local, collection, index, item: index >= 0 ? local[collection][index] : null };
  }
  function upsertLocalItem(item) {
    const local = loadLocalData();
    const collection = collectionName(item.type);
    local[collection] = local[collection] || [];
    const index = local[collection].findIndex((x) => String(x.id) === String(item.id));
    if (index >= 0) local[collection][index] = item;
    else local[collection].push(item);
    saveLocalData(local);
    return item;
  }
  function deleteLocalItem(type, id) {
    const { local, collection, index } = findLocalItem(type, id);
    if (index < 0) return false;
    local[collection].splice(index, 1);
    saveLocalData(local);
    return true;
  }

  function normalizePaper(p, source = "local", idx = 0) {
    const disease = canonicalArray("disease", p.disease || p.diseases);
    const diseaseNotes = p.diseaseNotes && typeof p.diseaseNotes === "object" ? canonicalObjectKeys("disease", p.diseaseNotes) : {};
    const knowledgeUnits = normalizeKnowledgeUnits(p.knowledgeUnits || p.claims || p.findings);
    return {
      ...p,
      type: "paper",
      source,
      id: p.id || `${source}-paper-${idx + 1}`,
      title: String(p.title || "Untitled Paper").trim(),
      displayName: String(p.title || "Untitled Paper").trim(),
      label: TYPE_LABELS.paper,
      disease,
      genes: canonicalArray("gene", p.genes),
      cellTypes: canonicalArray("cell_type", p.cellTypes),
      tissues: canonicalArray("tissue", p.tissues),
      summary: Array.isArray(p.summary) ? p.summary.filter(Boolean) : asArray(p.summary),
      newKnowledge: Array.isArray(p.newKnowledge) ? p.newKnowledge.filter(Boolean) : asArray(p.newKnowledge),
      diseaseNotes,
      knowledgeUnits,
      tags: unique(p.tags),
      description: (Array.isArray(p.summary) ? p.summary[0] : asArray(p.summary)[0]) || `${p.journal || "Paper"} · ${p.year || ""}`,
    };
  }
  function normalizeKnowledge(k, source = "local", idx = 0) {
    return {
      ...k,
      type: "knowledge",
      source,
      id: k.id || `${source}-knowledge-${idx + 1}`,
      title: String(k.title || "Untitled Knowledge").trim(),
      displayName: String(k.title || "Untitled Knowledge").trim(),
      label: TYPE_LABELS.knowledge,
      category: String(k.category || "Note").trim(),
      relatedDiseases: canonicalArray("disease", k.relatedDiseases || k.disease || k.diseases),
      relatedGenes: canonicalArray("gene", k.relatedGenes || k.genes),
      relatedCellTypes: canonicalArray("cell_type", k.relatedCellTypes || k.cellTypes),
      relatedTissues: canonicalArray("tissue", k.relatedTissues || k.tissues),
      knowledge: Array.isArray(k.knowledge) ? k.knowledge.filter(Boolean) : asArray(k.knowledge),
      tags: unique(k.tags),
      description: (Array.isArray(k.knowledge) ? k.knowledge[0] : asArray(k.knowledge)[0]) || k.source || "Personal knowledge",
    };
  }

  function makeEntity(type, raw, source = "static") {
    const displayName = type === "gene" ? (raw.symbol || raw.name || raw.title || raw.id) : (raw.name || raw.symbol || raw.title || raw.id);
    return {
      ...raw,
      source,
      id: raw.id || slugify(displayName),
      type,
      label: TYPE_LABELS[type],
      displayName,
      description: raw.description || raw.fullName || raw.summary?.[0] || raw.knowledge?.[0] || "",
    };
  }
  function entityFromName(type, name) {
    return makeEntity(type, { id: slugify(name), name, symbol: type === "gene" ? name : undefined, description: "" }, "derived");
  }
  function uniqueByKey(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.type}:${norm(item.displayName)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildKnowledgeGraph(staticData) {
    const localData = loadLocalData();
    const staticPapers = (staticData.papers || []).map((p, idx) => normalizePaper(p, "static", idx));
    const localPapers = (localData.papers || []).map((p, idx) => normalizePaper(p, "local", idx));
    const staticKnowledge = (staticData.knowledge || []).map((k, idx) => normalizeKnowledge(k, "static", idx));
    const localKnowledge = (localData.knowledge || []).map((k, idx) => normalizeKnowledge(k, "local", idx));
    const papers = [...staticPapers, ...localPapers];
    const knowledge = [...staticKnowledge, ...localKnowledge];

    const units = papers.flatMap((p) => p.knowledgeUnits || []);
    const diseaseNames = [...(staticData.diseases || []).map((d) => d.name), ...papers.flatMap((p) => p.disease), ...units.flatMap((u) => u.disease), ...knowledge.flatMap((k) => k.relatedDiseases)];
    const geneNames = [...(staticData.genes || []).map((g) => g.symbol || g.name), ...papers.flatMap((p) => p.genes), ...units.flatMap((u) => u.genes), ...knowledge.flatMap((k) => k.relatedGenes)];
    const cellNames = [...(staticData.cellTypes || []).map((c) => c.name), ...papers.flatMap((p) => p.cellTypes), ...units.flatMap((u) => u.cellTypes), ...knowledge.flatMap((k) => k.relatedCellTypes)];
    const tissueNames = [...(staticData.tissues || []).map((t) => t.name), ...papers.flatMap((p) => p.tissues), ...units.flatMap((u) => u.tissues), ...knowledge.flatMap((k) => k.relatedTissues)];

    const diseases = uniqueByKey([...(staticData.diseases || []).map((d) => makeEntity("disease", d, "static")), ...unique(diseaseNames).map((n) => entityFromName("disease", n))]);
    const genes = uniqueByKey([...(staticData.genes || []).map((g) => makeEntity("gene", g, "static")), ...unique(geneNames).map((n) => entityFromName("gene", n))]);
    const cellTypes = uniqueByKey([...(staticData.cellTypes || []).map((c) => makeEntity("cell_type", c, "static")), ...unique(cellNames).map((n) => entityFromName("cell_type", n))]);
    const tissues = uniqueByKey([...(staticData.tissues || []).map((t) => makeEntity("tissue", t, "static")), ...unique(tissueNames).map((n) => entityFromName("tissue", n))]);

    return { diseases, genes, cellTypes, tissues, papers, knowledge, all: [...diseases, ...genes, ...cellTypes, ...tissues, ...papers, ...knowledge] };
  }

  function entityUrl(item, basePath = "") {
    const params = new URLSearchParams({ type: item.type, id: item.id || slugify(item.displayName || item.title) });
    if (item.displayName || item.title) params.set("name", item.displayName || item.title);
    return `${basePath}pages/entity.html?${params.toString()}`;
  }
  function addUrl(basePath = "", item = null) {
    if (!item) return `${basePath}pages/add.html`;
    return `${basePath}pages/add.html?edit=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}`;
  }

  function buildIndex(graph) {
    return graph.all.map((item) => ({
      ...item,
      searchText: [item.displayName, item.title, item.description, item.fullName, item.authors, item.journal, ...(item.tags || []), ...(item.genes || []), ...(item.cellTypes || []), ...(item.tissues || []), ...(item.disease || []), ...(item.relatedGenes || []), ...(item.relatedDiseases || []), ...Object.values(item.diseaseNotes || {}).flat(), ...(item.knowledgeUnits || []).flatMap((u) => [u.title, u.claim, u.evidence, u.note, ...(u.genes || []), ...(u.cellTypes || []), ...(u.tissues || []), ...(u.disease || [])])].join(" ").toLowerCase(),
    }));
  }
  function score(row, query) {
    const q = norm(query);
    const name = String(row.displayName || row.title || "").toLowerCase();
    if (name === q) return 100;
    if (name.startsWith(q)) return 82;
    if (name.includes(q)) return 62;
    if (row.searchText.includes(q)) return 28;
    return 0;
  }

  function initSearch({ inputId, resultsId, basePath = "" }) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;
    const graph = buildKnowledgeGraph(window.WIKI_DATA || {});
    const index = buildIndex(graph);
    function render(query) {
      if (!query) { results.classList.remove("open"); results.innerHTML = ""; return; }
      const matches = index.map((r) => ({ r, s: score(r, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
      if (!matches.length) {
        results.innerHTML = `<div class="search-empty">"${escapeHtml(query)}"에 대한 결과가 없어요.</div>`;
        results.classList.add("open"); return;
      }
      results.innerHTML = matches.map(({ r }) => {
        const rel = relatedFor(r, graph);
        const hint = r.type === "paper" ? `${r.journal || ""} ${r.year || ""}` : `${rel.papers.length} Paper · ${rel.knowledge.length} Knowledge`;
        return `<a class="search-result" href="${entityUrl(r, basePath)}">
          <span class="dot ${r.type}"></span><span class="label">${r.label}</span>
          <span class="name">${escapeHtml(r.displayName || r.title)}</span>
          <span class="desc">${escapeHtml(hint || r.description || "")}</span>
        </a>`;
      }).join("");
      results.classList.add("open");
    }
    input.addEventListener("input", (e) => render(e.target.value.trim()));
    input.addEventListener("focus", (e) => { if (e.target.value.trim()) render(e.target.value.trim()); });
    document.addEventListener("click", (e) => { if (!results.contains(e.target) && e.target !== input) results.classList.remove("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
  }

  function relatedFor(item, graph) {
    const name = norm(item.displayName || item.title);
    const contains = (arr) => asArray(arr).some((v) => norm(v) === name);
    const relatedPapers = graph.papers.filter((p) => {
      const units = p.knowledgeUnits || [];
      if (item.type === "disease") return contains(p.disease) || units.some((u) => asArray(u.disease).some((v) => norm(v) === name));
      if (item.type === "gene") return contains(p.genes) || units.some((u) => asArray(u.genes).some((v) => norm(v) === name));
      if (item.type === "cell_type") return contains(p.cellTypes) || units.some((u) => asArray(u.cellTypes).some((v) => norm(v) === name));
      if (item.type === "tissue") return contains(p.tissues) || units.some((u) => asArray(u.tissues).some((v) => norm(v) === name));
      return p.id === item.id;
    });
    const relatedKnowledge = graph.knowledge.filter((k) => {
      if (item.type === "disease") return contains(k.relatedDiseases);
      if (item.type === "gene") return contains(k.relatedGenes);
      if (item.type === "cell_type") return contains(k.relatedCellTypes);
      if (item.type === "tissue") return contains(k.relatedTissues);
      return k.id === item.id;
    });
    const unitFieldMap = { disease: "disease", genes: "genes", cellTypes: "cellTypes", tissues: "tissues" };
    const fromPapers = (field) => unique(relatedPapers.flatMap((p) => [
      ...(p[field] || []),
      ...(p.knowledgeUnits || []).flatMap((u) => u[unitFieldMap[field] || field] || [])
    ]));
    const fromKnowledge = (field) => unique(relatedKnowledge.flatMap((k) => k[field] || []));
    return {
      papers: relatedPapers,
      knowledge: relatedKnowledge,
      diseases: unique([...fromPapers("disease"), ...fromKnowledge("relatedDiseases")]).filter((x) => norm(x) !== name),
      genes: unique([...fromPapers("genes"), ...fromKnowledge("relatedGenes")]).filter((x) => norm(x) !== name),
      cellTypes: unique([...fromPapers("cellTypes"), ...fromKnowledge("relatedCellTypes")]).filter((x) => norm(x) !== name),
      tissues: unique([...fromPapers("tissues"), ...fromKnowledge("relatedTissues")]).filter((x) => norm(x) !== name),
    };
  }
  function knowledgeUnitsFor(item, graph) {
    if (!item) return [];
    const itemName = norm(item.displayName || item.title);
    const match = (arr) => asArray(arr).some((v) => norm(v) === itemName);
    return graph.papers.flatMap((p) => (p.knowledgeUnits || []).filter((u) => {
      if (item.type === "paper") return p.id === item.id;
      if (item.type === "disease") return match(u.disease);
      if (item.type === "gene") return match(u.genes);
      if (item.type === "cell_type") return match(u.cellTypes);
      if (item.type === "tissue") return match(u.tissues);
      return false;
    }).map((u) => ({ ...u, paper: p })));
  }
  function duplicatePaperCandidates(paper, graph = null) {
    const g = graph || buildKnowledgeGraph(window.WIKI_DATA || {});
    const title = norm(paper.title);
    const doi = norm(paper.doiOrUrl || paper.doi || paper.url);
    return g.papers.filter((p) => {
      if (paper.id && p.id === paper.id) return false;
      const sameDoi = doi && norm(p.doiOrUrl || p.doi || p.url) === doi;
      const sameTitle = title && norm(p.title) === title;
      const closeTitle = title && norm(p.title).replace(/[^a-z0-9]/g, "") === title.replace(/[^a-z0-9]/g, "");
      return sameDoi || sameTitle || closeTitle;
    });
  }

  function diseaseSpecificNote(paper, diseaseName) {
    const notes = paper.diseaseNotes || {};
    const key = Object.keys(notes).find((k) => norm(k) === norm(diseaseName));
    const value = key ? notes[key] : null;
    return Array.isArray(value) ? value.filter(Boolean) : asArray(value);
  }

  window.BiologyWiki = {
    STORAGE_KEY, TYPE_LABELS, CANONICAL_ALIASES, slugify, asArray, unique, escapeHtml, norm, canonicalize, canonicalArray, normalizeKnowledgeUnits, duplicatePaperCandidates, knowledgeUnitsFor,
    loadLocalData, saveLocalData, findLocalItem, upsertLocalItem, deleteLocalItem,
    buildKnowledgeGraph, entityUrl, addUrl, initSearch, relatedFor, diseaseSpecificNote,
    normalizePaper, normalizeKnowledge,
  };
  window.initWikiSearch = initSearch;
})();
