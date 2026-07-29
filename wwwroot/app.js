(() => {
  "use strict";

  const REL_BADGE_CLASS = {
    PARENT_OF: "badge-parent",
    MARRIED_TO: "badge-married",
    ADOPTED_PARENT_OF: "badge-adopted",
    DIVORCED_FROM: "badge-divorced",
  };

  let persons = [];
  let relTypes = [];
  let sortState = { key: "name", dir: 1 };

  function relTypeLabel(code) {
    return relTypes.find((t) => t.code === code)?.label || code;
  }

  // ---------- helpers ----------

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function isFemale(gender) {
    return (gender || "").trim().toLowerCase() === "nữ" || (gender || "").trim().toLowerCase() === "nu";
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = el("div", { class: `toast ${type}`, role: "status" }, message);
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    setConnected(true);
    if (!res.ok) {
      let message = `Lỗi ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.detail || message;
      } catch { /* no json body */ }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function setConnected(ok) {
    const dot = document.getElementById("connDot");
    const text = document.getElementById("connText");
    dot.classList.remove("ok", "error");
    if (ok) {
      dot.classList.add("ok");
      text.textContent = "Đã kết nối Neo4j";
    } else {
      dot.classList.add("error");
      text.textContent = "Mất kết nối Neo4j";
    }
  }

  function setButtonLoading(btn, loading, labelWhileLoading) {
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = "";
      btn.appendChild(el("span", { class: "spinner", "aria-hidden": "true" }));
      btn.appendChild(document.createTextNode(" " + (labelWhileLoading || "Đang xử lý…")));
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  // ---------- tabs ----------

  function initTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        buttons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
        document.querySelectorAll(".tab-panel").forEach((panel) => {
          const active = panel.id === `tab-${target}`;
          panel.classList.toggle("active", active);
          panel.hidden = !active;
        });
        if (target === "graph") renderGraph();
      });
    });
  }

  // ---------- persons ----------

  function sortedPersons() {
    const { key, dir } = sortState;
    return [...persons].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "vi") * dir;
    });
  }

  function extraPropsSummary(extraProps) {
    const entries = Object.entries(extraProps || {});
    if (entries.length === 0) return "—";
    return el(
      "div",
      { class: "extra-props-cell" },
      entries.map(([k, v]) => el("div", {}, `${k}: ${v}`))
    );
  }

  function renderPersonsTable() {
    const tbody = document.getElementById("personsTbody");
    tbody.innerHTML = "";
    const list = sortedPersons();
    document.getElementById("personsEmpty").hidden = list.length > 0;

    for (const p of list) {
      const tr = el("tr", {}, [
        el("td", {}, p.name),
        el("td", {}, el("span", { class: "gender-badge" }, isFemale(p.gender) ? "♀ Nữ" : "♂ Nam")),
        el("td", { class: "num" }, String(p.birthYear)),
        el("td", {}, p.birthPlace || "—"),
        el("td", {}, p.occupation || "—"),
        el("td", {}, p.cccd || "—"),
        el("td", {}, p.phoneNumber || "—"),
        el("td", {}, extraPropsSummary(p.extraProps)),
        el("td", {}, el("div", { class: "row-actions" }, [
          el("button", {
            class: "btn btn-secondary btn-icon", type: "button", "aria-label": `Sửa ${p.name}`,
            onclick: () => openPersonModal(p),
          }, iconEdit()),
          el("button", {
            class: "btn btn-danger btn-icon", type: "button", "aria-label": `Xoá ${p.name}`,
            onclick: () => deletePerson(p),
          }, iconTrash()),
        ])),
      ]);
      tbody.appendChild(tr);
    }
    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll("#personsTable th[data-sort]").forEach((th) => {
      const key = th.dataset.sort;
      th.setAttribute("aria-sort", key === sortState.key ? (sortState.dir === 1 ? "ascending" : "descending") : "none");
    });
  }

  function iconEdit() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
    svg.innerHTML = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>';
    return svg;
  }
  function iconTrash() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
    svg.innerHTML = '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/>';
    return svg;
  }

  function fillPersonSelects() {
    const opts = sortedPersonsByName();
    for (const selectId of ["relFrom", "relTo", "kinA", "kinB"]) {
      const select = document.getElementById(selectId);
      const prev = select.value;
      select.innerHTML = "";
      for (const p of opts) {
        select.appendChild(el("option", { value: p.id }, `${p.name} (${p.gender}, ${p.birthYear})`));
      }
      if (prev && opts.some((p) => p.id === prev)) select.value = prev;
    }
  }

  function sortedPersonsByName() {
    return [...persons].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  async function loadPersons(search = "") {
    persons = await api(`/api/persons?search=${encodeURIComponent(search)}`);
    renderPersonsTable();
    fillPersonSelects();
  }

  function addExtraPropRow(key = "", value = "") {
    const list = document.getElementById("pExtraList");
    const row = el("div", { class: "extra-prop-row" }, [
      el("input", { class: "extra-key", placeholder: "Tên thuộc tính", maxlength: "60", value: key }),
      el("input", { class: "extra-value", placeholder: "Giá trị", maxlength: "200", value: value }),
      el("button", {
        type: "button", class: "btn btn-danger btn-icon", "aria-label": "Xoá thuộc tính",
        onclick: () => row.remove(),
      }, iconTrash()),
    ]);
    list.appendChild(row);
  }

  function readExtraProps() {
    const props = {};
    document.querySelectorAll("#pExtraList .extra-prop-row").forEach((row) => {
      const key = row.querySelector(".extra-key").value.trim();
      const value = row.querySelector(".extra-value").value.trim();
      if (key) props[key] = value;
    });
    return props;
  }

  function openPersonModal(existing) {
    const overlay = document.getElementById("personModalOverlay");
    const form = document.getElementById("personForm");
    document.getElementById("personModalTitle").textContent = existing ? "Sửa thông tin người" : "Thêm người mới";
    form.dataset.editId = existing ? existing.id : "";
    form.name.value = existing?.name || "";
    form.gender.value = existing?.gender || "Nam";
    form.birthYear.value = existing?.birthYear ?? 1990;
    form.birthPlace.value = existing?.birthPlace || "";
    form.occupation.value = existing?.occupation || "";
    form.cccd.value = existing?.cccd || "";
    form.phoneNumber.value = existing?.phoneNumber || "";
    form.note.value = existing?.note || "";
    document.getElementById("pExtraList").innerHTML = "";
    for (const [key, value] of Object.entries(existing?.extraProps || {})) addExtraPropRow(key, value);
    document.getElementById("pNameError").textContent = "";
    document.getElementById("pCCCDError").textContent = "";
    document.getElementById("pPhoneNumberError").textContent = "";
    overlay.hidden = false;
    form.name.focus();
  }

  function closePersonModal() {
    document.getElementById("personModalOverlay").hidden = true;
  }

  async function savePerson(ev) {
    ev.preventDefault();
    const form = ev.target;
    const name = form.name.value.trim();
    if (!name) {
      document.getElementById("pNameError").textContent = "Vui lòng nhập họ và tên.";
      form.name.focus();
      return;
    }
    const cccd = form.cccd.value.trim();
    if (cccd && !/^\d{9,12}$/.test(cccd)) {
      document.getElementById("pCCCDError").textContent = "CCCD phải gồm 9-12 chữ số.";
      form.cccd.focus();
      return;
    }
    const phoneNumber = form.phoneNumber.value.trim();
    if (phoneNumber && !/^0\d{9,10}$/.test(phoneNumber)) {
      document.getElementById("pPhoneNumberError").textContent = "Số điện thoại phải bắt đầu bằng 0 và có 10-11 chữ số.";
      form.phoneNumber.focus();
      return;
    }
    const payload = {
      id: form.dataset.editId || "",
      name,
      gender: form.gender.value,
      birthYear: Number(form.birthYear.value) || 2000,
      birthPlace: form.birthPlace.value.trim(),
      occupation: form.occupation.value.trim(),
      cccd,
      phoneNumber,
      note: form.note.value.trim(),
      extraProps: readExtraProps(),
    };
    const btn = document.getElementById("btnSavePerson");
    setButtonLoading(btn, true, "Đang lưu…");
    try {
      if (form.dataset.editId) {
        await api(`/api/persons/${encodeURIComponent(form.dataset.editId)}`, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Đã cập nhật thông tin.", "success");
      } else {
        await api("/api/persons", { method: "POST", body: JSON.stringify(payload) });
        showToast("Đã thêm người mới.", "success");
      }
      closePersonModal();
      await loadPersons(document.getElementById("searchInput").value.trim());
      await loadRelationships();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function deletePerson(person) {
    if (!confirm(`Xác nhận xoá '${person.name}' khỏi gia phả?\nMọi mối quan hệ của người này cũng sẽ bị xoá.`)) return;
    try {
      await api(`/api/persons/${encodeURIComponent(person.id)}`, { method: "DELETE" });
      showToast(`Đã xoá ${person.name}.`, "success");
      await loadPersons(document.getElementById("searchInput").value.trim());
      await loadRelationships();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // ---------- relationships ----------

  function renderRelationshipsTable(rels) {
    const tbody = document.getElementById("relTbody");
    tbody.innerHTML = "";
    document.getElementById("relEmpty").hidden = rels.length > 0;
    for (const r of rels) {
      const tr = el("tr", {}, [
        el("td", {}, r.fromName),
        el("td", {}, el("span", { class: `badge ${REL_BADGE_CLASS[r.relType] || "badge-custom"}` }, relTypeLabel(r.relType))),
        el("td", {}, r.toName),
        el("td", {}, el("div", { class: "row-actions" }, [
          el("button", {
            class: "btn btn-danger btn-icon", type: "button", "aria-label": `Xoá quan hệ ${r.fromName} - ${r.toName}`,
            onclick: () => deleteRelationship(r),
          }, iconTrash()),
        ])),
      ]);
      tbody.appendChild(tr);
    }
  }

  async function loadRelationships() {
    const rels = await api("/api/relationships");
    relationshipsCache = rels;
    renderRelationshipsTable(rels);
  }

  // ---------- relation types ----------

  function fillRelTypeSelect() {
    const select = document.getElementById("relType");
    const prev = select.value;
    select.innerHTML = "";
    for (const t of relTypes) {
      select.appendChild(el("option", { value: t.code }, `${t.label} (${t.code})`));
    }
    if (prev && relTypes.some((t) => t.code === prev)) select.value = prev;
  }

  function renderRelTypesTable() {
    const tbody = document.getElementById("relTypesTbody");
    tbody.innerHTML = "";
    for (const t of relTypes) {
      tbody.appendChild(el("tr", {}, [
        el("td", {}, t.code),
        el("td", {}, t.label),
        el("td", {}, el("div", { class: "row-actions" }, [
          el("button", {
            class: "btn btn-danger btn-icon", type: "button", "aria-label": `Xoá loại quan hệ ${t.label}`,
            onclick: () => deleteRelType(t),
          }, iconTrash()),
        ])),
      ]));
    }
  }

  async function loadRelTypes() {
    relTypes = await api("/api/relation-types");
    renderRelTypesTable();
    fillRelTypeSelect();
  }

  async function createRelType() {
    const codeInput = document.getElementById("rtCode");
    const labelInput = document.getElementById("rtLabel");
    const code = codeInput.value.trim().toUpperCase();
    const label = labelInput.value.trim();
    if (!label) {
      showToast("Vui lòng nhập tên hiển thị.", "error");
      return;
    }
    const btn = document.getElementById("btnCreateRelType");
    setButtonLoading(btn, true, "Đang thêm…");
    try {
      await api("/api/relation-types", { method: "POST", body: JSON.stringify({ code, label }) });
      showToast("Đã thêm loại quan hệ.", "success");
      codeInput.value = "";
      labelInput.value = "";
      await loadRelTypes();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function deleteRelType(type) {
    if (!confirm(`Xác nhận xoá loại quan hệ '${type.label}' (${type.code})?\nCác mối quan hệ đã tạo với loại này sẽ không còn hiển thị tên.`)) return;
    try {
      await api(`/api/relation-types/${encodeURIComponent(type.code)}`, { method: "DELETE" });
      showToast("Đã xoá loại quan hệ.", "success");
      await loadRelTypes();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function createRelationship() {
    const fromId = document.getElementById("relFrom").value;
    const toId = document.getElementById("relTo").value;
    const relType = document.getElementById("relType").value;
    const btn = document.getElementById("btnCreateRel");
    setButtonLoading(btn, true, "Đang tạo…");
    try {
      await api("/api/relationships", { method: "POST", body: JSON.stringify({ fromId, toId, relType }) });
      showToast("Đã tạo mối quan hệ.", "success");
      await loadRelationships();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function deleteRelationship(rel) {
    if (!confirm(`Xác nhận xoá mối quan hệ: ${rel.fromName} → ${rel.toName}?`)) return;
    try {
      const qs = new URLSearchParams({ fromId: rel.fromId, toId: rel.toId, relType: rel.relType });
      await api(`/api/relationships?${qs}`, { method: "DELETE" });
      showToast("Đã xoá mối quan hệ.", "success");
      await loadRelationships();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // ---------- kinship ----------

  async function findKinship() {
    const fromId = document.getElementById("kinA").value;
    const toId = document.getElementById("kinB").value;
    const resultCard = document.getElementById("kinshipResult");
    const chainWrap = document.getElementById("kinshipChainWrap");
    const btn = document.getElementById("btnFindKinship");

    setButtonLoading(btn, true, "Đang tra cứu…");
    try {
      const data = await api(`/api/kinship?fromId=${encodeURIComponent(fromId)}&toId=${encodeURIComponent(toId)}`);
      const personA = persons.find((p) => p.id === fromId);
      const personB = persons.find((p) => p.id === toId);

      resultCard.hidden = false;
      resultCard.classList.remove("error");
      const titleEl = document.getElementById("kinshipTitle");
      titleEl.innerHTML = "";

      if (!data.title) {
        resultCard.classList.add("error");
        titleEl.textContent = `Không tìm thấy mối quan hệ họ hàng giữa ${personA?.name ?? ""} và ${personB?.name ?? ""}.`;
        chainWrap.hidden = true;
        return;
      }

      if (data.stepCount === 0 && !data.nodes) {
        titleEl.textContent = data.title;
        chainWrap.hidden = true;
        return;
      }

      titleEl.append(
        personB?.name ?? "",
        " là ",
        el("span", { class: "highlight" }, `【${data.title}】`),
        " của ",
        personA?.name ?? ""
      );
      if (data.generationGap > 0) {
        titleEl.append(el("span", { class: "gen-gap" }, ` (cách nhau ${data.generationGap} đời)`));
      }

      renderChain(data.nodes, data.steps);
      chainWrap.hidden = false;
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function stepLabel(step) {
    if (step.relType === "MARRIED_TO") return "kết hôn";
    if (step.relType === "DIVORCED_FROM") return "ly hôn";
    if (step.relType === "ADOPTED_PARENT_OF") return step.isUp ? "con nuôi của" : "cha/mẹ nuôi của";
    if (step.relType === "PARENT_OF") return step.isUp ? "con của" : "cha/mẹ của";
    return relTypeLabel(step.relType).toLowerCase();
  }

  function renderChain(nodes, steps) {
    const chain = document.getElementById("kinshipChain");
    chain.innerHTML = "";
    nodes.forEach((node, i) => {
      const isEndpoint = i === 0 || i === nodes.length - 1;
      chain.appendChild(el("div", { class: `chain-node${isEndpoint ? " endpoint" : ""}` }, [
        el("div", { class: "chain-avatar", "aria-hidden": "true" }, node.name.charAt(0)),
        el("div", { class: "chain-name" }, node.name),
        el("div", { class: "chain-meta" }, `${node.gender} · ${node.birthYear}`),
      ]));
      if (i < steps.length) {
        chain.appendChild(el("div", { class: "chain-step" }, [
          el("span", {}, stepLabel(steps[i])),
          el("span", { class: "arrow-line", "aria-hidden": "true" }),
        ]));
      }
    });
  }

  // ---------- graph ----------

  const REL_COLOR_VAR = {
    PARENT_OF: "--rel-parent",
    MARRIED_TO: "--rel-married",
    ADOPTED_PARENT_OF: "--rel-adopted",
    DIVORCED_FROM: "--rel-divorced",
  };

  let graphRels = [];
  let graphNodes = [];
  let relationshipsCache = [];
  let graphActiveTypes = null; // Set of relType codes currently shown; null = not yet initialized

  function relColor(relType) {
    const varName = REL_COLOR_VAR[relType] || "--muted-foreground";
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  const NODE_R = 28;
  const COL_GAP = 150;
  const ROW_GAP = 190;

  function computeGenerations(nodes, rels) {
    const parentRels = rels.filter((r) => r.relType === "PARENT_OF" || r.relType === "ADOPTED_PARENT_OF");
    const spouseRels = rels.filter((r) => r.relType === "MARRIED_TO" || r.relType === "DIVORCED_FROM");
    const childrenOf = new Map(), parentsOf = new Map();
    for (const r of parentRels) {
      (childrenOf.get(r.fromId) ?? childrenOf.set(r.fromId, []).get(r.fromId)).push(r.toId);
      (parentsOf.get(r.toId) ?? parentsOf.set(r.toId, []).get(r.toId)).push(r.fromId);
    }

    const gen = new Map();
    // BFS out from every node with no recorded parent (a root), propagating
    // down through children and sideways through spouses, until stable.
    const roots = nodes.filter((n) => !parentsOf.has(n.id));
    const queue = roots.length ? roots.map((n) => n.id) : [nodes[0].id];
    for (const id of queue) gen.set(id, 0);

    let changed = true, guard = 0;
    while (changed && guard++ < nodes.length * 4) {
      changed = false;
      for (const r of parentRels) {
        const pg = gen.get(r.fromId);
        if (pg == null) continue;
        const want = pg + 1;
        if (gen.get(r.toId) == null || gen.get(r.toId) < want) { gen.set(r.toId, want); changed = true; }
      }
      for (const r of spouseRels) {
        const ga = gen.get(r.fromId), gb = gen.get(r.toId);
        if (ga != null && (gb == null || gb !== ga)) { gen.set(r.toId, ga); changed = true; }
        else if (gb != null && (ga == null || ga !== gb)) { gen.set(r.fromId, gb); changed = true; }
      }
    }
    for (const n of nodes) if (!gen.has(n.id)) gen.set(n.id, 0);
    return gen;
  }

  // Bottom-up tree layout (Reingold-Tilford-lite): each parent is centered
  // over the midpoint of its own children/spouse unit, computed by DFS from
  // the leaves up, then sibling subtrees are pushed apart if they'd overlap.
  function layoutGraph(nodes, rels, width) {
    if (nodes.length === 0) return { width, height: 0 };

    const gen = computeGenerations(nodes, rels);
    const minGen = Math.min(...gen.values());
    for (const node of nodes) node.generation = gen.get(node.id) - minGen;
    const maxGen = Math.max(...nodes.map((n) => n.generation));

    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const childrenOf = new Map();
    for (const r of rels) {
      if (r.relType !== "PARENT_OF" && r.relType !== "ADOPTED_PARENT_OF") continue;
      if (!byId[r.fromId] || !byId[r.toId]) continue;
      (childrenOf.get(r.fromId) ?? childrenOf.set(r.fromId, []).get(r.fromId)).push(r.toId);
    }
    const spouseOf = new Map();
    for (const r of rels) {
      if (r.relType !== "MARRIED_TO" || !byId[r.fromId] || !byId[r.toId]) continue;
      spouseOf.set(r.fromId, r.toId);
      spouseOf.set(r.toId, r.fromId);
    }

    // a "unit" is a person plus their spouse (if any and same generation) — they
    // move together as one block so couples always end up adjacent
    function unitOf(id) {
      const spouseId = spouseOf.get(id);
      if (spouseId && byId[spouseId] && byId[spouseId].generation === byId[id].generation) {
        return id < spouseId ? [id, spouseId] : [spouseId, id];
      }
      return [id];
    }

    // each generation gets its own horizontal cursor — a root's row must not be
    // pushed around by how wide its grandchildren's row turned out to be
    const cursorPerGen = new Map();
    const visited = new Set();

    // returns the horizontal center of the placed unit containing nodeId
    function placeUnit(nodeId) {
      if (visited.has(nodeId)) return byId[nodeId].x;
      const unit = unitOf(nodeId);
      unit.forEach((id) => visited.add(id));
      const g = byId[nodeId].generation;
      const rowCursor = cursorPerGen.get(g) ?? 0;

      // children of either spouse in the unit, deduped, left-to-right by birth order
      const kids = [...new Set(unit.flatMap((id) => childrenOf.get(id) || []))]
        .filter((id) => byId[id] && !visited.has(id))
        .sort((a, b) => (byId[a].birthYear || 0) - (byId[b].birthYear || 0));

      let center;
      if (kids.length === 0) {
        unit.forEach((id, i) => { byId[id].x = rowCursor + i * COL_GAP; });
        center = unit.length === 1 ? byId[unit[0]].x : (byId[unit[0]].x + byId[unit[1]].x) / 2;
      } else {
        for (const id of kids) placeUnit(id);
        const spans = kids.flatMap((id) => unitOf(id).map((m) => byId[m].x));
        center = (Math.min(...spans) + Math.max(...spans)) / 2;
        // this unit's own row is independent of its children's row, so it can
        // still collide with a sibling subtree placed earlier on the same row
        const halfWidth = unit.length === 2 ? COL_GAP / 2 : 0;
        center = Math.max(center, rowCursor + halfWidth);
        if (unit.length === 2) {
          byId[unit[0]].x = center - COL_GAP / 2;
          byId[unit[1]].x = center + COL_GAP / 2;
        } else {
          byId[unit[0]].x = center;
        }
      }
      const rightEdge = unit.length === 2 ? Math.max(byId[unit[0]].x, byId[unit[1]].x) : byId[unit[0]].x;
      cursorPerGen.set(g, rightEdge + COL_GAP);
      return center;
    }

    // a "true" root has no parent and isn't married into a family that does —
    // e.g. a spouse who married in should be discovered via their partner's
    // side, not started as their own independent tree
    const hasParent = new Set();
    for (const kids of childrenOf.values()) for (const k of kids) hasParent.add(k);
    const isTrueRoot = (id) => {
      if (hasParent.has(id)) return false;
      const spouseId = spouseOf.get(id);
      return !spouseId || !hasParent.has(spouseId);
    };
    const trueRoots = nodes.filter((n) => isTrueRoot(n.id));
    const marriedInRoots = nodes.filter((n) => !hasParent.has(n.id) && !isTrueRoot(n.id));
    const rootIds = trueRoots.length ? trueRoots.map((n) => n.id) : nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
    for (const id of (rootIds.length ? rootIds : [nodes[0].id])) if (!visited.has(id)) placeUnit(id);
    // spouses who married in but whose partner never got visited (partner filtered out, etc.)
    for (const id of marriedInRoots.map((n) => n.id)) if (!visited.has(id)) placeUnit(id);
    // any node unreachable from a root (disconnected fragment) still needs a slot
    for (const node of nodes) if (!visited.has(node.id)) placeUnit(node.id);

    for (const node of nodes) node.y = 60 + node.generation * ROW_GAP;

    const allMinX = Math.min(...nodes.map((n) => n.x));
    const allMaxX = Math.max(...nodes.map((n) => n.x));
    const treeWidth = allMaxX - allMinX + COL_GAP * 2;
    const finalWidth = Math.max(width, treeWidth);
    const shift = finalWidth / 2 - (allMinX + allMaxX) / 2;
    for (const node of nodes) node.x += shift;

    return { width: finalWidth, height: 60 + (maxGen + 1) * ROW_GAP };
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function renderGraphFilter() {
    const usedTypes = [...new Set(relationshipsCache.map((r) => r.relType))];
    if (graphActiveTypes === null) graphActiveTypes = new Set(usedTypes);

    const container = document.getElementById("graphFilter");
    container.innerHTML = "";
    for (const code of usedTypes) {
      const active = graphActiveTypes.has(code);
      const checkbox = el("input", {
        type: "checkbox",
        onchange: (e) => {
          if (e.target.checked) graphActiveTypes.add(code);
          else graphActiveTypes.delete(code);
          renderGraph();
        },
      });
      checkbox.checked = active;
      const label = el("label", { class: `legend-item${active ? "" : " off"}` }, [
        checkbox,
        el("span", { class: "legend-line", style: `background:${relColor(code)}` }),
        relTypeLabel(code),
      ]);
      container.appendChild(label);
    }
  }

  function renderGraph() {
    const svg = document.getElementById("graphSvg");
    const wrap = document.getElementById("graphWrap");
    svg.innerHTML = "";
    document.getElementById("graphEmpty").hidden = persons.length > 0;
    if (persons.length === 0) return;

    renderGraphFilter();

    const wrapWidth = wrap.clientWidth || 800;
    const wrapHeight = wrap.clientHeight || 500;

    // only people who have at least one relationship of a currently-checked
    // type stay in the diagram — matching, unchecked types disappear entirely
    const visibleRels = relationshipsCache.filter((r) => graphActiveTypes.has(r.relType));
    const visiblePersonIds = new Set(visibleRels.flatMap((r) => [r.fromId, r.toId]));
    const visiblePersons = persons.filter((p) => visiblePersonIds.has(p.id));

    document.getElementById("graphEmpty").hidden = visiblePersons.length > 0;
    if (visiblePersons.length === 0) return;

    graphNodes = visiblePersons.map((p) => ({ id: p.id, name: p.name, gender: p.gender, birthYear: p.birthYear }));
    graphRels = visibleRels;

    const { width, height } = layoutGraph(graphNodes, graphRels, wrapWidth);
    svg.setAttribute("viewBox", `0 0 ${width} ${Math.max(height, wrapHeight)}`);

    const gEdges = svgEl("g", { class: "graph-edges" });
    const gNodes = svgEl("g", { class: "graph-nodes-layer" });
    svg.appendChild(gEdges);
    svg.appendChild(gNodes);

    const byId = Object.fromEntries(graphNodes.map((node) => [node.id, node]));

    for (const rel of visibleRels) {
      const a = byId[rel.fromId], b = byId[rel.toId];
      if (!a || !b) continue;
      const color = relColor(rel.relType);
      const line = svgEl("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: color, "stroke-width": rel.relType === "MARRIED_TO" ? 2 : 1.6,
        "marker-end": rel.relType === "MARRIED_TO" || rel.relType === "DIVORCED_FROM" ? "" : "url(#arrow)",
        "stroke-dasharray": rel.relType === "DIVORCED_FROM" ? "4,4" : "",
      });
      line.dataset.fromId = rel.fromId;
      line.dataset.toId = rel.toId;
      gEdges.appendChild(line);

      const label = svgEl("text", {
        class: "graph-edge-label",
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 4,
      });
      label.textContent = relTypeLabel(rel.relType);
      label.dataset.fromId = rel.fromId;
      label.dataset.toId = rel.toId;
      gEdges.appendChild(label);
    }

    const defs = svgEl("defs");
    defs.innerHTML = `<marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="var(--primary)"></path>
    </marker>`;
    svg.appendChild(defs);

    for (const node of graphNodes) {
      const g = svgEl("g", { class: `graph-node${isFemale(node.gender) ? " female" : ""}`, transform: `translate(${node.x},${node.y})` });
      g.appendChild(svgEl("circle", { r: NODE_R }));
      const initials = node.name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join("").toUpperCase();
      const avatarLabel = svgEl("text", { class: "graph-avatar-label", y: 5 });
      avatarLabel.textContent = initials;
      g.appendChild(avatarLabel);

      const label = svgEl("text", { class: "graph-label", y: NODE_R + 18 });
      label.textContent = node.name;
      g.appendChild(label);
      const sub = svgEl("text", { class: "graph-sub", y: NODE_R + 33 });
      sub.textContent = String(node.birthYear);
      g.appendChild(sub);
      g.dataset.id = node.id;
      makeDraggable(g, node, svg);
      gNodes.appendChild(g);
    }
  }

  function makeDraggable(g, node, svg) {
    let dragging = false;
    function toSvgPoint(evt) {
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const x = ((evt.clientX - rect.left) / rect.width) * vb.width + vb.x;
      const y = ((evt.clientY - rect.top) / rect.height) * vb.height + vb.y;
      return { x, y };
    }
    g.addEventListener("pointerdown", (e) => {
      dragging = true;
      g.setPointerCapture(e.pointerId);
    });
    g.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const p = toSvgPoint(e);
      node.x = p.x;
      node.y = p.y;
      g.setAttribute("transform", `translate(${node.x},${node.y})`);
      updateEdgesFor(node.id, svg);
    });
    g.addEventListener("pointerup", () => { dragging = false; });
    g.addEventListener("pointercancel", () => { dragging = false; });
  }

  function updateEdgesFor(nodeId, svg) {
    const byId = Object.fromEntries(graphNodes.map((node) => [node.id, node]));
    svg.querySelectorAll(`line[data-from-id="${nodeId}"], line[data-to-id="${nodeId}"]`).forEach((line) => {
      const a = byId[line.dataset.fromId], b = byId[line.dataset.toId];
      if (!a || !b) return;
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
    });
    svg.querySelectorAll(`text.graph-edge-label[data-from-id="${nodeId}"], text.graph-edge-label[data-to-id="${nodeId}"]`).forEach((label) => {
      const a = byId[label.dataset.fromId], b = byId[label.dataset.toId];
      if (!a || !b) return;
      label.setAttribute("x", (a.x + b.x) / 2);
      label.setAttribute("y", (a.y + b.y) / 2 - 4);
    });
  }

  function resetAndRenderGraph() {
    graphNodes = [];
    renderGraph();
  }

  // ---------- wiring ----------

  function init() {
    initTabs();

    document.getElementById("btnRefreshPersons").addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      loadPersons();
    });

    let searchDebounce;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => loadPersons(e.target.value.trim()), 300);
    });

    document.getElementById("btnAddPerson").addEventListener("click", () => openPersonModal(null));
    document.getElementById("btnAddExtraProp").addEventListener("click", () => addExtraPropRow());
    document.getElementById("btnCancelPerson").addEventListener("click", closePersonModal);
    document.getElementById("personForm").addEventListener("submit", savePerson);
    document.getElementById("personModalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "personModalOverlay") closePersonModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("personModalOverlay").hidden) closePersonModal();
    });

    document.querySelectorAll("#personsTable th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        sortState.dir = sortState.key === key ? -sortState.dir : 1;
        sortState.key = key;
        renderPersonsTable();
      });
    });

    document.getElementById("btnCreateRel").addEventListener("click", createRelationship);
    document.getElementById("btnCreateRelType").addEventListener("click", createRelType);
    document.getElementById("btnFindKinship").addEventListener("click", findKinship);
    document.getElementById("btnRefreshGraph").addEventListener("click", resetAndRenderGraph);
    window.addEventListener("resize", () => {
      if (!document.getElementById("tab-graph").hidden) renderGraph();
    });

    (async () => {
      try {
        await loadRelTypes();
        await Promise.all([loadPersons(), loadRelationships()]);
      } catch (err) {
        setConnected(false);
        showToast(`Không thể kết nối đến Neo4j: ${err.message}`, "error");
      }
    })();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
