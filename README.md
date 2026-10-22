# Convenios urbanísticos · San Andrés de Giles 2008–2026

Sitio estático con el registro, el plano y la verificación catastral de los convenios urbanísticos de San Andrés de Giles (Buenos Aires): 35 convenios homologados por el H.C.D. en 34 ordenanzas y 23 convenios firmados, en trámite o proyectados.

**Ver en línea:** https://surtecto.github.io/convenios-urbanisticos-sag/

## Secciones

- **Plano.** Áreas convenidas sobre la zonificación del COU 2026, sobre imagen satelital (Esri), con fondo de calles opcional. Cada capa se prende, se apaga y regula su opacidad. Filtros por estado, tipo y localidad, buscador y ficha de cada convenio. Cada ficha tiene su enlace (`#c=CU-012`).
- **Cifras.** Convenios por año y tipo, parcelas que vuelven al Municipio en cada loteo y estado catastral en ARBA.
- **Verificación.** Estado de la subdivisión o la transferencia pactada en el catastro ARBA de septiembre de 2026.
- **Datos.** Descargas en JSON, GeoPackage, GeoJSON y CSV.
- **Método.** Fuentes, criterios de localización, advertencias y marco normativo.

## Estructura

```
index.html
css/estilo.css          identidad del Plan SAG (IM Fell English, Barlow, DM Mono)
js/app.js               plano (Leaflet 1.9.4), gráficos SVG y tablas
lib/                    Leaflet local
fonts/                  tipografías woff2 locales
data/                   datos livianos para el plano
descargas/              datos completos para descargar
```

No usa compilación ni dependencias externas salvo los fondos de mapa. Para verlo en local: `python3 -m http.server` en esta carpeta y abrir `http://localhost:8000`.

## Fuentes

- Digesto del H.C.D. de San Andrés de Giles (textos sancionados).
- Registro «Gestión de suelo 2009-2026», Dirección de Planeamiento y Obras Particulares.
- Parcelario ARBA, corte del 09-09-2026.
- Parcelario y zonificación del Código de Ordenamiento Urbano 2026.

Las parcelas que quedan en dominio municipal no son donaciones: son la compensación por el mayor valor que la decisión pública otorga al suelo (Ley 14.449, art. 46 y ss.). Homologado no equivale a ejecutado. Los titulares sólo se nombran cuando son parte del convenio, tal como figuran en la ordenanza publicada.

Arq. Juan Patricio Addesso · Mat. CAPBA 020811 · revisión 22-10-2026
