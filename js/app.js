/* Convenios urbanísticos · San Andrés de Giles — plano, cifras y verificación */
(function () {
"use strict";
const $ = s => document.querySelector(s);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (v, d = 0) => v == null ? "s/d" : Number(v).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d && v % 1 ? 1 : 0 });
const fecha = s => s ? s.slice(0, 10).split("-").reverse().join("/") : "";

const TIPOS = { A: "Incorporación de suelo con cesión", B: "Permuta o canje", C: "Compensación en obra o materiales", D: "Regularización dominial", E: "Excepción de uso", P: "Sin ordenanza" };
const EST = { hom: "Homologados", tram: "Firmados o en trámite", proy: "Proyectos" };
const ESTLBL = { homologado: "Homologado", firmado_sin_ordenanza: "Firmado sin ordenanza", en_tramite_hcd: "En trámite en el H.C.D.", proximo_a_firma: "Próximo a la firma", proyecto_no_homologado: "Proyecto o propuesta", registro_sin_ordenanza: "Suelo fiscal (registro)" };
const LOCLBL = { exacta: "Parcela identificada", aproximada: "Ubicación aproximada", inferida: "Ubicación inferida", no_localizada: "Sin localizar" };
const ARBA = { registrada: ["Registrada", "--ok"], parcial: ["Parcial", "--medio"], no_registrada: ["No registrada", "--no"], no_aplica: ["No aplica", "--neutro"], sin_dato: ["Sin dato", "--neutro"] };
const estOf = r => r.estado === "homologado" ? "hom" : (["firmado_sin_ordenanza", "en_tramite_hcd", "proximo_a_firma"].includes(r.estado) ? "tram" : "proy");
const tipoKey = r => r.estado === "homologado" ? (r.tipo || "P") : "P";
const color = k => css("--t" + k);
const LOCS = ["Cabecera", "Cucullú", "Villa Espil", "Azcuénaga", "Villa Ruiz", "San Alberto", "Varias"];
const locOf = r => {
  const l = (r.localidad || "").toLowerCase();
  if (l.includes("/") || l.includes(" y ")) return "Varias";
  for (const k of ["cucullú", "villa espil", "azcuénaga", "villa ruiz", "san alberto"]) if (l.includes(k)) return k.replace(/(^|\s)\S/g, m => m.toUpperCase());
  return "Cabecera";
};
const anioOf = r => r.anio_homologacion || r.anio || null;

let REC = [], META = null, sel = null;
const layerById = {};
const state = { est: new Set(Object.keys(EST)), tipo: new Set(Object.keys(TIPOS)), loc: "", q: "", ver: new Set(Object.keys(ARBA)) };

/* ---------------- tema ---------------- */
const esOscuro = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
$("#tema").addEventListener("click", () => {
  const nuevo = esOscuro() ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem("cu-sag-tema", nuevo); } catch (e) {}
  repintar();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", repintar);

/* ---------------- plano ---------------- */
const map = L.map("mapa", { preferCanvas: true, zoomControl: true, attributionControl: true }).setView([-34.44, -59.43], 12);
map.attributionControl.setPrefix(false);
const renderer = L.canvas({ padding: .3 });
map.createPane("zonas").style.zIndex = 300;
map.createPane("parc").style.zIndex = 350;
map.createPane("conv").style.zIndex = 420;

const fondos = {
  "Zonificación COU 2026": L.layerGroup(),
  "Calles · OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }),
  "Satélite · Esri": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" })
};
let fondo = "Zonificación COU 2026";
fondos[fondo].addTo(map);

function zonaStyle(f) {
  const t = f.properties.f;
  const fill = t === "urb" ? css("--zurb") : (t === "rural" ? css("--zrur") : css("--zcomp"));
  const sobreFondo = fondo !== "Zonificación COU 2026";
  return { pane: "zonas", renderer, color: css("--zlinea"), weight: sobreFondo ? 0 : .6, fillColor: fill, fillOpacity: sobreFondo ? 0 : .8 };
}
function convStyle(f) {
  const p = f.properties, k = tipoKey(p), on = sel === p.id;
  const dashed = p.localizacion !== "exacta" || p.estado !== "homologado";
  const sat = fondo === "Satélite · Esri";
  return { pane: "conv", renderer, color: on ? css("--sel") : (sat ? "#fff" : color(k)), weight: on ? 3.4 : (sat ? 1.6 : 1.8), dashArray: dashed ? "5 4" : null,
    fillColor: color(k), fillOpacity: on ? .6 : (p.estado === "homologado" ? .42 : .2) };
}

let zonasL, parcL, convL, convZL;
Promise.all(["data/zonas.geojson", "data/convenios.geojson", "data/registros.json", "data/zonas_convenio.geojson", "data/meta.json"].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); })))
  .then(([zon, conv, regs, zc, meta]) => {
    REC = regs; META = meta;
    zonasL = L.geoJSON(zon, { style: zonaStyle, interactive: false }).addTo(map);
    convZL = L.geoJSON(zc, { style: () => ({ pane: "parc", renderer, color: css("--zconv"), weight: 1.2, dashArray: "2 3", fillOpacity: 0 }), interactive: false }).addTo(map);
    convL = L.geoJSON(conv, { style: convStyle, onEachFeature: (f, l) => {
      layerById[f.properties.id] = l;
      l.on("click", () => select(f.properties.id, false));
      l.bindTooltip(esc(f.properties.partes) + (f.properties.ordenanza ? ` · Ord. ${esc(f.properties.ordenanza)}` : ""), { sticky: true, direction: "top", opacity: .95 });
    } }).addTo(map);
    map.fitBounds(convL.getBounds(), { padding: [20, 20] });
    L.control.layers(fondos, null, { position: "topleft", collapsed: true }).addTo(map);
    rotulos(); filtros(); render(); kpis(); cifras(); verificacion(); metodo();
    leerHash();
  })
  .catch(err => { $("#lista").innerHTML = `<p style="padding:16px">No se pudieron cargar los datos (${esc(err.message)}). Si abrió el archivo directamente, sírvalo desde un servidor web.</p>`; });

map.on("baselayerchange", e => { fondo = e.name; zonasL && zonasL.setStyle(zonaStyle); convL && convL.setStyle(convStyle); });
map.on("zoomend", () => {
  if (map.getZoom() >= 15 && !parcL) {
    parcL = "cargando";
    fetch("data/parcelas.geojson").then(r => r.json()).then(g => {
      parcL = L.geoJSON(g, { style: () => ({ pane: "parc", renderer, color: css("--parc"), weight: .45, fill: false }), interactive: false });
      if (map.getZoom() >= 15) parcL.addTo(map);
    });
  }
  if (parcL && parcL !== "cargando") { if (map.getZoom() >= 15) parcL.addTo(map); else map.removeLayer(parcL); }
});

function rotulos() {
  [["San Andrés de Giles", -34.4455, -59.4464], ["Cucullú", -34.4449, -59.3643], ["Villa Espil", -34.5064, -59.3412], ["Azcuénaga", -34.3657, -59.3739], ["Villa Ruiz", -34.4346, -59.2594], ["San Alberto", -34.4638, -59.5669], ["Solís", -34.2965, -59.3275]]
    .forEach(([n, la, lo]) => L.tooltip({ permanent: true, direction: "center", className: "rot", interactive: false }).setLatLng([la, lo]).setContent(n).addTo(map));
}

function kpis() {
  const R = META.resumen;
  const tram = REC.filter(r => estOf(r) === "tram").length;
  const enPlano = REC.filter(r => r.localizacion && r.localizacion !== "no_localizada").length;
  $("#kpis").innerHTML = [[R.convenios_homologados, "homologados"], [tram, "firmados o en trámite"], [fmt(R.suelo_municipio_ha, 1), "ha al Municipio"], [enPlano, "áreas en el plano"]]
    .map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
}

function filtros() {
  const fe = $("#fEstado");
  fe.innerHTML = Object.entries(EST).map(([k, v]) => `<button class="chip" type="button" aria-pressed="true" data-k="${k}">${v}</button>`).join("");
  fe.onclick = e => { const b = e.target.closest(".chip"); if (b) { alternar(state.est, b.dataset.k, b); render(); } };
  const ft = $("#fTipo");
  ft.innerHTML = Object.entries(TIPOS).map(([k, v]) => `<button class="chip" type="button" aria-pressed="true" data-k="${k}" title="${v}"><span class="sw" style="background:var(--t${k})"></span>${k === "P" ? "Sin ordenanza" : v}</button>`).join("");
  ft.onclick = e => { const b = e.target.closest(".chip"); if (b) { alternar(state.tipo, b.dataset.k, b); render(); } };
  const fl = $("#fLoc");
  fl.innerHTML = '<option value="">Todas las localidades</option>' + LOCS.map(l => `<option>${l}</option>`).join("");
  fl.onchange = () => { state.loc = fl.value; render(); };
  $("#fQ").oninput = e => { state.q = e.target.value.toLowerCase().trim(); render(); };
  $("#leyenda").innerHTML = '<summary>Referencias</summary>' + Object.entries(TIPOS).map(([k, v]) => `<div class="l"><span class="sw" style="background:var(--t${k})"></span>${k === "P" ? "Firmado sin ordenanza, en trámite o proyecto" : v}</div>`).join("")
    + '<div class="l"><span class="raya"></span>Ubicación aproximada o inferida</div>'
    + '<div class="l"><span class="raya" style="border-color:var(--zconv);border-top-style:dotted"></span>Zona COU sujeta a convenio</div>'
    + '<div class="l"><span class="sw" style="background:var(--zurb);outline:1px solid var(--zlinea)"></span>Área urbana COU</div>'
    + '<div class="l"><span class="sw" style="background:var(--zcomp);outline:1px solid var(--zlinea)"></span>Área complementaria COU</div>';
  if (innerWidth < 1100) $("#leyenda").open = false;
}
function alternar(set, k, b) { if (set.has(k)) set.delete(k); else set.add(k); b.setAttribute("aria-pressed", set.has(k)); }

function visible(r) {
  if (!state.est.has(estOf(r))) return false;
  if (!state.tipo.has(tipoKey(r))) return false;
  if (state.loc && locOf(r) !== state.loc) return false;
  if (state.q) {
    const s = [r.partes, r.ordenanza, r.nomenclatura, r.parcelas_mapa, r.localidad, r.contraprestacion, r.destino, r.normas_relacionadas].join(" ").toLowerCase();
    if (!s.includes(state.q)) return false;
  }
  return true;
}

function render() {
  const vis = REC.filter(visible).sort((a, b) => (anioOf(a) - anioOf(b)) || String(a.fecha_sancion || "").localeCompare(String(b.fecha_sancion || "")) || String(a.id).localeCompare(b.id));
  const enPlano = vis.filter(r => r.localizacion && r.localizacion !== "no_localizada").length;
  $("#cuenta").textContent = `${vis.length} de ${REC.length} registros · ${enPlano} en el plano`;
  $("#lista").innerHTML = vis.map(r => {
    const k = tipoKey(r);
    const tag = (!r.localizacion || r.localizacion === "no_localizada") ? '<span class="tag alerta">sin plano</span>' : (r.localizacion !== "exacta" ? '<span class="tag">aprox.</span>' : "");
    const sub = r.estado === "homologado" ? `Ord. ${esc(r.ordenanza)} · ${esc(locOf(r))}` : `${esc(ESTLBL[r.estado] || r.estado)} · ${esc(locOf(r))}`;
    return `<div class="it${sel === r.id ? " on" : ""}" role="listitem" tabindex="0" data-id="${r.id}"><span class="sw" style="background:var(--t${k})"></span><span class="t">${esc(r.partes)}${tag}</span><span class="y">${anioOf(r) || ""}</span><span class="m">${sub}</span></div>`;
  }).join("") || '<p style="padding:16px;color:var(--texto-3)">Ningún registro con esos filtros.</p>';
  const ids = new Set(vis.map(r => r.id));
  Object.entries(layerById).forEach(([id, l]) => { if (ids.has(id)) { if (!convL.hasLayer(l)) convL.addLayer(l); } else convL.removeLayer(l); });
}
$("#lista").addEventListener("click", e => { const it = e.target.closest(".it"); if (it) select(it.dataset.id, true); });
$("#lista").addEventListener("keydown", e => { if (e.key === "Enter") { const it = e.target.closest(".it"); if (it) select(it.dataset.id, true); } });

const fila = (l, v, cls = "") => v == null || v === "" ? "" : `<dt>${l}</dt><dd class="${cls}">${v}</dd>`;
function estadoArba(k) { if (!k || !ARBA[k]) return ""; const [t, c] = ARBA[k]; return `<span class="estado" style="--c:var(${c})">${t}</span>`; }

function select(id, volar) {
  const r = REC.find(x => x.id === id); if (!r) return;
  sel = id;
  convL && convL.setStyle(convStyle);
  const l = layerById[id];
  if (l) { l.bringToFront(); if (volar) map.flyToBounds(l.getBounds(), { padding: [70, 70], maxZoom: 17, duration: .6 }); }
  const k = tipoKey(r), d = $("#ficha");
  const reg = r.registro_dpyop ? esc(r.registro_dpyop).replaceAll("; ", "<br>") : null;
  const cif = [];
  if (r.superficie_m2 != null) cif.push([r.superficie_m2 >= 10000 ? fmt(r.superficie_m2 / 1e4, 1) + " ha" : fmt(r.superficie_m2) + " m²", "superficie"]);
  if (r.parcelas_proyecto != null) cif.push([fmt(r.parcelas_proyecto), "parcelas"]);
  if (r.parcelas_municipio != null) cif.push([fmt(r.parcelas_municipio) + (r.cesion_pct_parcelas != null ? ` <small style="font-size:.6em;color:var(--texto-3)">${fmt(r.cesion_pct_parcelas, 1)} %</small>` : ""), "al Municipio"]);
  else if (r.suelo_municipio_m2) cif.push([fmt(r.suelo_municipio_m2) + " m²", "suelo al Municipio"]);
  d.innerHTML = `<header><span class="sw" style="background:var(--t${k});margin-top:9px"></span><div style="min-width:0">
      <h2>${esc(r.partes)}</h2>
      <div class="ord">${r.estado === "homologado" ? "Ord. " + esc(r.ordenanza) + (r.fecha_sancion ? " · " + fecha(r.fecha_sancion) : "") : esc(ESTLBL[r.estado] || r.estado) + " · " + (anioOf(r) || "")}${r.normas_relacionadas ? " · rel. " + esc(r.normas_relacionadas) : ""}</div></div>
      <button class="x" id="cerrar" type="button" aria-label="Cerrar ficha">×</button></header>
    ${cif.length ? `<div class="cifras">${cif.map(([v, t]) => `<div><b>${v}</b><span>${t}</span></div>`).join("")}</div>` : ""}
    <dl>${fila("Tipo", r.estado === "homologado" ? esc(TIPOS[r.tipo] || "") : "—")}
    ${fila("Localidad", esc(r.localidad))}
    ${fila("Nomenclatura", esc(r.nomenclatura), "mono")}
    ${fila("Zona COU 2026", esc(r.zona_cou_2026), "mono")}
    ${fila("Contra&shy;prestación", esc(r.contraprestacion))}
    ${fila("Destino", esc(r.destino))}
    ${fila("Cuadras", r.cuadras_mejoradas ? fmt(r.cuadras_mejoradas) : null)}
    ${fila("Seguimiento", esc(r.seguimiento))}
    ${fila("Catastro ARBA", r.subdivision_arba ? estadoArba(r.subdivision_arba) + (r.dominio_arba ? `<br>${esc(r.dominio_arba)}` : "") : null)}
    ${fila("Registro DPyOP", reg)}
    ${fila("Parcelas dibujadas", r.parcelas_mapa ? `<span class="mono">${esc(r.parcelas_mapa).replaceAll(" | ", "<br>")}</span>` : null)}
    ${fila("Área dibujada", r.area_mapa_m2 ? fmt(r.area_mapa_m2) + " m²" : null)}
    ${fila("Geometría", esc(r.fuente_geometria))}</dl>
    ${(!r.localizacion || r.localizacion === "no_localizada") ? `<p class="nota"><b>Sin localizar.</b> La nomenclatura no alcanza para dibujarlo en el plano.</p>`
      : (r.localizacion !== "exacta" ? `<p class="nota"><b>${LOCLBL[r.localizacion] || ""}.</b> ${esc(r.nota_localizacion || "")}</p>` : "")}`;
  d.hidden = false; d.scrollTop = 0;
  $("#cerrar").onclick = cerrar;
  history.replaceState(null, "", "#c=" + id);
  render();
  const it = document.querySelector(`.it[data-id="${id}"]`), li = $("#lista");
  if (it && (it.offsetTop < li.scrollTop || it.offsetTop + it.offsetHeight > li.scrollTop + li.clientHeight)) li.scrollTop = it.offsetTop - li.clientHeight / 3;
}
function cerrar() { $("#ficha").hidden = true; sel = null; convL && convL.setStyle(convStyle); history.replaceState(null, "", location.pathname); render(); }
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#ficha").hidden) cerrar(); });
function ir(id) { history.replaceState(null, "", "#c=" + id); leerHash(); }
function leerHash() { const m = location.hash.match(/^#c=([A-Z]{2}-\d{3})$/); if (m) { select(m[1], true); setTimeout(() => scrollTo({ top: $("#plano").getBoundingClientRect().top + scrollY - 47 }), 30); } }
addEventListener("hashchange", leerHash);

/* ---------------- cifras ---------------- */
const NS = "http://www.w3.org/2000/svg";
const tip = $("#tip");
function mostrarTip(e, html) { tip.innerHTML = html; tip.hidden = false; const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8); tip.style.left = x + "px"; tip.style.top = (e.clientY + 14) + "px"; }
function ocultarTip() { tip.hidden = true; }

function cifras() {
  const R = META.resumen, V = META.verificacion.subdivision_arba;
  const aplic = Object.entries(V).filter(([k]) => k !== "no_aplica" && k !== "sin_dato").reduce((s, [, v]) => s + v, 0);
  $("#tiras").innerHTML = [
    [R.convenios_homologados, "", `convenios homologados en ${R.ordenanzas_homologatorias} ordenanzas`],
    [fmt(R.parcelas_proyectadas), "", "parcelas proyectadas en los loteos convenidos"],
    [fmt(R.suelo_municipio_ha, 1), "ha", `de suelo al Municipio; ${fmt(R.suelo_municipio_reserva_y_parque_ha, 0)} ha son reserva y parque`],
    [fmt(R.cesion_parcelas_tipo_A_pct, 1), "%", `de las parcelas va al Municipio en los convenios tipo A (mediana ${fmt(R.cesion_parcelas_tipo_A_mediana_pct, 1)} %)`],
    [V.registrada, `de ${aplic}`, "subdivisiones o transferencias inscriptas en ARBA"]
  ].map(([v, u, t]) => `<div class="tira"><b>${v}${u ? `<small>${u}</small>` : ""}</b><span>${t}</span></div>`).join("");
  $("#lgAnio").innerHTML = Object.entries(TIPOS).filter(([k]) => k !== "P").map(([k, v]) => `<span><span class="sw" style="background:var(--t${k})"></span>${k} · ${v}</span>`).join("");
  graficos();
  const R2 = R.registro_dpyop;
  const hom = REC.filter(r => r.estado === "homologado"), desde20 = hom.filter(r => r.anio_homologacion >= 2020);
  $("#lectura").innerHTML = `
    <p><b>Lo homologado no está inscripto.</b> De ${aplic} convenios con loteo, cesión o transferencia, ${V.registrada} figuran registrados en ARBA, ${V.parcial} en parte y ${V.no_registrada} no figuran. Las parcelas donadas para el Parque Urbano Natural siguen a nombre del donante y la 118DW, donde el segundo convenio García ubica los lotes municipales, sigue sin subdividir.</p>
    <p><b>La cesión real es menor que la declarada.</b> El registro de la Dirección declara ${fmt(R2.pct_declarado, 0)} % de parcelas conveniadas sobre ${fmt(R2.parcelas_totales)}. Depurado de entradas duplicadas o sin convenio baja a ${fmt(R2.depurado.pct, 1)} %, y sin los acuerdos de precio queda en ${fmt(R2.cesion_efectiva_sin_acuerdos_de_precio_pct, 1).replace(/,0$/, "")} %.</p>
    <p><b>El instrumento se aceleró.</b> ${desde20.length} de las ${hom.length} ordenanzas se sancionaron desde 2020. En ese período aparecen las compensaciones en obra o materiales (${desde20.filter(r => r.tipo === "C").length} de ${hom.filter(r => r.tipo === "C").length}), y la incorporación de suelo con cesión sigue siendo la mitad: ${desde20.filter(r => r.tipo === "A").length} convenios.</p>`;
}

function medir(el) { return Math.max(300, Math.floor(el.clientWidth || el.parentNode.clientWidth || 600)); }
function svgEl(tag, at, txt) { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; return e; }

function graficos() {
  if (!META) return;
  gAnio(); gCesion(); gArba();
}

function gAnio() {
  const box = $("#gAnio"); box.innerHTML = "";
  const hom = REC.filter(r => r.estado === "homologado");
  const a0 = 2008, a1 = 2026, anios = []; for (let a = a0; a <= a1; a++) anios.push(a);
  const W = medir(box), H = 230, m = { t: 18, r: 6, b: 26, l: 24 };
  const bw = (W - m.l - m.r) / anios.length;
  const por = {}; anios.forEach(a => por[a] = []);
  hom.forEach(r => { if (por[r.anio_homologacion]) por[r.anio_homologacion].push(r); });
  const max = Math.max(...anios.map(a => por[a].length), 1);
  const y = v => H - m.b - v / Math.ceil(max) * (H - m.t - m.b);
  const s = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Convenios homologados por año y tipo" });
  for (let v = 2; v <= max; v += 2) { s.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "eje", "stroke-width": 1 })); s.append(svgEl("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end", "font-size": 11 }, v)); }
  anios.forEach((a, i) => {
    const x = m.l + i * bw + bw * .16, w = bw * .68;
    let acum = 0;
    ["A", "B", "C", "D", "E"].forEach(k => {
      const rs = por[a].filter(r => r.tipo === k); if (!rs.length) return;
      const r0 = y(acum), r1 = y(acum + rs.length);
      const rect = svgEl("rect", { x, y: r1 + 1, width: w, height: Math.max(0, r0 - r1 - 1), fill: color(k) });
      rect.addEventListener("mousemove", e => mostrarTip(e, `<b>${a} · ${TIPOS[k]}</b><br>` + rs.map(r => `Ord. ${esc(r.ordenanza)} · ${esc(r.partes)}`).join("<br>")));
      rect.addEventListener("mouseleave", ocultarTip);
      rect.style.cursor = "pointer";
      rect.addEventListener("click", () => { if (rs.length === 1) { ir(rs[0].id); } });
      s.append(rect); acum += rs.length;
    });
    if (acum) s.append(svgEl("text", { x: x + w / 2, y: y(acum) - 5, "text-anchor": "middle", "font-size": 13, class: "cifra" }, acum));
    if (W > 520 || a % 2 === 0) s.append(svgEl("text", { x: x + w / 2, y: H - 8, "text-anchor": "middle", "font-size": 11 }, W > 640 ? a : "’" + String(a).slice(2)));
  });
  s.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: "base", "stroke-width": 1 }));
  box.append(s);
}

function gCesion() {
  const box = $("#gCesion"); box.innerHTML = "";
  const R = META.resumen;
  const rs = REC.filter(r => r.estado === "homologado" && r.tipo === "A" && r.cesion_pct_parcelas != null).sort((a, b) => b.cesion_pct_parcelas - a.cesion_pct_parcelas);
  const W = medir(box), fh = 24, m = { t: 26, r: 58, b: 8, l: Math.min(200, W * .46) };
  const H = m.t + rs.length * fh + m.b;
  const max = 30; // eje cortado: los valores mayores se marcan con «»
  const x = v => m.l + v / max * (W - m.l - m.r);
  const s = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Porcentaje de parcelas cedidas al Municipio por convenio" });
  [[R.cesion_parcelas_tipo_A_pct, "conjunto " + fmt(R.cesion_parcelas_tipo_A_pct, 1) + " %", "start"], [R.cesion_parcelas_tipo_A_mediana_pct, "mediana " + fmt(R.cesion_parcelas_tipo_A_mediana_pct, 1) + " %", "end"]].forEach(([v, t, anc]) => {
    s.append(svgEl("line", { x1: x(v), x2: x(v), y1: m.t - 6, y2: H - m.b, stroke: css("--texto-3"), "stroke-dasharray": "3 3", "stroke-width": 1 }));
    s.append(svgEl("text", { x: x(v) + (anc === "start" ? 4 : -4), y: m.t - 10, "text-anchor": anc, "font-size": 11 }, t));
  });
  rs.forEach((r, i) => {
    const cy = m.t + i * fh + fh / 2;
    const corto = r.partes.replace(/\s*\(.*$/, "");
    const nom = (corto.length > 24 ? corto.slice(0, 23) + "…" : corto) + " · " + r.ordenanza;
    const g = svgEl("g", { style: "cursor:pointer" });
    g.append(svgEl("text", { x: m.l - 8, y: cy + 4, "text-anchor": "end", "font-size": 12.5 }, nom));
    const v = Math.min(r.cesion_pct_parcelas, max), corte = r.cesion_pct_parcelas > max;
    g.append(svgEl("line", { x1: x(0), x2: x(v), y1: cy, y2: cy, stroke: color("A"), "stroke-width": 2 }));
    if (corte) g.append(svgEl("text", { x: x(v) - 2, y: cy + 4.5, "text-anchor": "end", "font-size": 14, fill: color("A"), style: "fill:" + color("A") }, "»"));
    else g.append(svgEl("circle", { cx: x(v), cy, r: 4.5, fill: color("A") }));
    g.append(svgEl("text", { x: x(v) + 8, y: cy + 4, "font-size": 12.5, class: "cifra" }, fmt(r.cesion_pct_parcelas, 1) + " %" + (corte ? " ›" : "")));
    g.append(svgEl("rect", { x: 0, y: cy - fh / 2, width: W, height: fh, fill: "transparent" }));
    g.addEventListener("mousemove", e => mostrarTip(e, `<b>${esc(r.partes)}</b><br>Ord. ${esc(r.ordenanza)} · ${r.parcelas_municipio} de ${r.parcelas_proyecto} parcelas`));
    g.addEventListener("mouseleave", ocultarTip);
    g.addEventListener("click", () => { ir(r.id); });
    s.append(g);
  });
  s.append(svgEl("line", { x1: x(0), x2: x(0), y1: m.t - 4, y2: H - m.b, class: "base", "stroke-width": 1 }));
  [0, 10, 20, 30].forEach(t => s.append(svgEl("text", { x: x(t), y: H + 6, "text-anchor": "middle", "font-size": 10.5 }, t + " %")));
  s.setAttribute("viewBox", `0 0 ${W} ${H + 12}`);
  box.append(s);
}

function gArba() {
  const box = $("#gArba"); box.innerHTML = "";
  const V = META.verificacion.subdivision_arba;
  const orden = ["registrada", "parcial", "no_registrada", "no_aplica", "sin_dato"].filter(k => V[k]);
  const W = medir(box), fh = 40, m = { t: 6, r: 40, b: 6, l: 112 };
  const H = m.t + orden.length * fh + m.b;
  const max = Math.max(...orden.map(k => V[k]));
  const x = v => m.l + v / max * (W - m.l - m.r);
  const s = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Estado catastral en ARBA de los convenios homologados" });
  orden.forEach((k, i) => {
    const cy = m.t + i * fh + fh / 2, [t, c] = ARBA[k];
    const rs = REC.filter(r => r.estado === "homologado" && r.subdivision_arba === k);
    s.append(svgEl("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", "font-size": 13 }, t));
    const rect = svgEl("rect", { x: m.l, y: cy - 11, width: Math.max(2, x(V[k]) - m.l), height: 22, fill: css(c), rx: 1 });
    rect.addEventListener("mousemove", e => mostrarTip(e, `<b>${t}</b><br>` + rs.map(r => `Ord. ${esc(r.ordenanza)} · ${esc(r.partes)}`).join("<br>")));
    rect.addEventListener("mouseleave", ocultarTip);
    rect.addEventListener("click", () => { state.ver = new Set([k]); verFiltros(); verTabla(); $("#verificacion").scrollIntoView(); });
    rect.style.cursor = "pointer";
    s.append(rect);
    s.append(svgEl("text", { x: x(V[k]) + 7, y: cy + 5, "font-size": 15, class: "cifra" }, V[k]));
  });
  box.append(s);
}

/* ---------------- verificación ---------------- */
function verificacion() { verFiltros(); verTabla(); }
function verFiltros() {
  const V = META.verificacion.subdivision_arba;
  const f = $("#fVer");
  f.innerHTML = Object.entries(ARBA).filter(([k]) => V[k]).map(([k, [t, c]]) => `<button class="chip" type="button" data-k="${k}" aria-pressed="${state.ver.has(k)}"><span class="sw" style="background:var(${c});border-radius:50%"></span>${t} · ${V[k]}</button>`).join("")
    + `<button class="chip" type="button" data-k="*" aria-pressed="true" style="margin-left:6px">Todas</button>`;
  f.onclick = e => {
    const b = e.target.closest(".chip"); if (!b) return;
    if (b.dataset.k === "*") state.ver = new Set(Object.keys(ARBA)); else alternar(state.ver, b.dataset.k, b);
    verFiltros(); verTabla();
  };
}
function verTabla() {
  const rs = REC.filter(r => r.estado === "homologado" && state.ver.has(r.subdivision_arba || "sin_dato")).sort((a, b) => String(a.fecha_sancion).localeCompare(String(b.fecha_sancion)));
  $("#tVer tbody").innerHTML = rs.map(r => `<tr data-id="${r.id}" tabindex="0">
    <td class="n">${esc(r.ordenanza)}</td><td class="n">${fecha(r.fecha_sancion)}</td>
    <td><span class="parte">${esc(r.partes)}</span></td><td>${esc(r.localidad)}</td>
    <td><span class="sw" style="background:var(--t${r.tipo});margin-right:5px"></span>${r.tipo}</td>
    <td>${estadoArba(r.subdivision_arba || "sin_dato")}</td><td><div class="obs">${esc(r.dominio_arba || "")}</div></td></tr>`).join("");
}
$("#tVer").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) { ir(tr.dataset.id); } });
$("#tVer").addEventListener("keydown", e => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-id]"); if (tr) ir(tr.dataset.id); } });

/* ---------------- método ---------------- */
function metodo() {
  $("#adv").innerHTML = META.advertencias.map(a => `<li>${esc(a)}</li>`).join("");
  $("#tMarco").innerHTML = META.marco_normativo.map(m => `<tr><td class="n">${m.anio}</td><td class="n">${esc(m.norma)}</td><td>${esc(m.contenido)}</td></tr>`).join("");
  $("#version").textContent = "revisión " + fecha(META.version);
}

/* ---------------- repintado y navegación ---------------- */
function repintar() {
  zonasL && zonasL.setStyle(zonaStyle); convL && convL.setStyle(convStyle);
  convZL && convZL.setStyle(() => ({ pane: "parc", renderer, color: css("--zconv"), weight: 1.2, dashArray: "2 3", fillOpacity: 0 }));
  parcL && parcL !== "cargando" && parcL.setStyle(() => ({ pane: "parc", renderer, color: css("--parc"), weight: .45, fill: false }));
  graficos();
}
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(graficos, 150); });
const links = [...document.querySelectorAll(".nav a")];
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main > section").forEach(s => io.observe(s));
})();
