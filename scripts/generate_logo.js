const fs = require('fs');
const path = require('path');

// Hexagon points centered at (512, 512) with radius R = 390
const hexOuter = "512,122 850,317 850,707 512,902 174,707 174,317";
const hexInner = "512,148 830,332 830,692 512,876 194,692 194,332";

function buildLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>

    <!-- Obsidian & Slate Shading Gradients -->
    <linearGradient id="obsidianPrimary" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="obsidianLight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="obsidianDark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#050811"/>
    </linearGradient>
    <linearGradient id="titaniumHighlight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="titaniumLight" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>

    <!-- Electric Cyan & Indigo Pulse Optics -->
    <linearGradient id="cyanOptics" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f5ff"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="indigoPulse" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>

    <clipPath id="squircleClip">
      <rect x="24" y="24" width="976" height="976" rx="220"/>
    </clipPath>
  </defs>

  <!-- Luxury White Squircle Container -->
  <rect x="24" y="24" width="976" height="976" rx="220" fill="url(#bgGrad)" stroke="#e2e8f0" stroke-width="6"/>

  <g clip-path="url(#squircleClip)">
    <!-- Architectural Hexagonal Gateway Frame -->
    <polygon points="${hexOuter}" fill="none" stroke="#0f172a" stroke-width="36" stroke-linejoin="round"/>
    <polygon points="${hexInner}" fill="none" stroke="#00f5ff" stroke-width="4" stroke-dasharray="14 10" opacity="0.4" stroke-linejoin="round"/>

    <!-- Technical Radar Pulse Rings -->
    <circle cx="512" cy="512" r="330" fill="none" stroke="#6366f1" stroke-width="1.5" opacity="0.12"/>
    <circle cx="512" cy="512" r="260" fill="none" stroke="#00f5ff" stroke-width="1.5" opacity="0.18" stroke-dasharray="8 8"/>

    <!-- 100% Watertight Solid Falcon Silhouette -->
    <!-- Symmetrical across x = 512 -->
    <path d="M 512 165
             L 550 200 L 600 240 L 680 260 L 780 320 L 830 420 L 780 540 L 690 640 L 620 730 L 512 840
             L 404 730 L 334 640 L 244 540 L 194 420 L 244 320 L 344 260 L 424 240 L 474 200 Z"
          fill="#050811" />

    <!-- Sharp Aerodynamic Wing Pinions (Swept Back High-Speed Wings) -->
    <!-- Left Wing -->
    <polygon points="344,260 244,320 310,400 390,340" fill="url(#obsidianPrimary)"/>
    <polygon points="244,320 194,420 270,490 310,400" fill="url(#obsidianDark)"/>
    <polygon points="194,420 244,540 320,500 270,490" fill="url(#obsidianLight)"/>
    <polygon points="244,540 334,640 380,570 320,500" fill="url(#obsidianDark)"/>

    <!-- Right Wing -->
    <polygon points="680,260 780,320 714,400 634,340" fill="url(#obsidianLight)"/>
    <polygon points="780,320 830,420 754,490 714,400" fill="url(#obsidianPrimary)"/>
    <polygon points="830,420 780,540 704,500 754,490" fill="url(#obsidianDark)"/>
    <polygon points="780,540 690,640 644,570 704,500" fill="url(#obsidianLight)"/>

    <!-- Falcon Head & Cranial Crest -->
    <polygon points="512,165 470,210 512,240" fill="url(#titaniumHighlight)"/>
    <polygon points="512,165 554,210 512,240" fill="url(#titaniumLight)"/>

    <polygon points="470,210 410,250 460,290 512,240" fill="url(#obsidianLight)"/>
    <polygon points="554,210 614,250 564,290 512,240" fill="url(#obsidianPrimary)"/>

    <!-- Temples & Brow -->
    <polygon points="410,250 344,260 390,340 460,290" fill="url(#obsidianDark)"/>
    <polygon points="614,250 680,260 634,340 564,290" fill="url(#obsidianPrimary)"/>

    <!-- Supraorbital Brow Ridge (Alert Predator Frown) -->
    <polygon points="512,240 460,290 480,340 512,315" fill="url(#titaniumLight)"/>
    <polygon points="512,240 564,290 544,340 512,315" fill="url(#titaniumHighlight)"/>

    <!-- Deep Eye Sockets -->
    <polygon points="460,290 390,340 430,375 480,340" fill="#050811"/>
    <polygon points="564,290 634,340 594,375 544,340" fill="#050811"/>

    <!-- Electric Cyan Eyes (Piercing Slit Cant, Raptor Focus) -->
    <polygon points="425,335 470,325 455,350 415,348" fill="url(#cyanOptics)"/>
    <polygon points="445,332 460,328 452,342" fill="#ffffff" opacity="0.95"/>

    <polygon points="599,335 554,325 569,350 609,348" fill="url(#cyanOptics)"/>
    <polygon points="579,332 564,328 572,342" fill="#ffffff" opacity="0.95"/>

    <!-- Sharp Falcon Beak Base & Bridge -->
    <polygon points="512,315 480,340 485,395 512,380" fill="url(#titaniumLight)"/>
    <polygon points="512,315 544,340 539,395 512,380" fill="url(#titaniumHighlight)"/>

    <!-- Chiseled Curved Raptor Beak -->
    <polygon points="512,380 475,410 512,490" fill="#1e293b"/>
    <polygon points="512,380 549,410 512,490" fill="#334155"/>
    <polygon points="475,410 512,490 512,530" fill="#0f172a"/>
    <polygon points="549,410 512,490 512,530" fill="#1e293b"/>

    <!-- Black Falcon Tear Stripes (Malar Streaks) -->
    <polygon points="480,340 430,375 440,465 485,415" fill="url(#obsidianDark)"/>
    <polygon points="544,340 594,375 584,465 539,415" fill="url(#obsidianDark)"/>

    <!-- Throat & Origami Mail Envelope Flap (The MailPulse Core) -->
    <polygon points="512,530 440,465 512,485" fill="#0f172a"/>
    <polygon points="512,530 584,465 512,485" fill="#1e293b"/>

    <!-- Mail Envelope Fold in Radiant Indigo & Cyan -->
    <polygon points="512,535 390,565 512,650" fill="url(#indigoPulse)"/>
    <polygon points="512,535 634,565 512,650" fill="url(#cyanOptics)"/>

    <!-- Lateral Pectoral Armor -->
    <polygon points="390,565 320,500 380,570 512,650" fill="url(#obsidianPrimary)"/>
    <polygon points="634,565 704,500 644,570 512,650" fill="url(#obsidianLight)"/>

    <!-- Central Pulse Waveform (Inscribed in Breastplate) -->
    <polygon points="512,655 425,705 512,750" fill="#00f5ff" opacity="0.95"/>
    <polygon points="512,655 599,705 512,750" fill="#6366f1" opacity="0.95"/>

    <!-- Lower Abdomen & Tail Rudder Vectors -->
    <polygon points="425,705 344,730 430,780 512,750" fill="url(#obsidianDark)"/>
    <polygon points="599,705 680,730 594,780 512,750" fill="url(#obsidianPrimary)"/>

    <polygon points="512,755 430,780 512,835" fill="url(#titaniumLight)"/>
    <polygon points="512,755 594,780 512,835" fill="url(#titaniumHighlight)"/>

    <polygon points="430,780 380,795 512,840 512,835" fill="#050811"/>
    <polygon points="594,780 644,795 512,840 512,835" fill="#0f172a"/>

    <!-- Hexagon Vertex Cyan Telemetry Dots -->
    <circle cx="512" cy="122" r="9" fill="#00f5ff"/>
    <circle cx="850" cy="317" r="9" fill="#00f5ff"/>
    <circle cx="850" cy="707" r="9" fill="#00f5ff"/>
    <circle cx="512" cy="902" r="9" fill="#00f5ff"/>
    <circle cx="174" cy="707" r="9" fill="#00f5ff"/>
    <circle cx="174" cy="317" r="9" fill="#00f5ff"/>
  </g>
</svg>`;
}

async function renderLogo() {
  const outputDir = path.resolve(__dirname, '..', 'docs', 'images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const svg = buildLogoSvg();
  const svgPath = path.join(outputDir, 'mailpulse_logo.svg');
  fs.writeFileSync(svgPath, svg, 'utf8');
  console.log(`Saved SVG to ${svgPath}`);

  try {
    const { Resvg } = require('@resvg/resvg-js');
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 1024,
      },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const pngPath = path.join(outputDir, 'mailpulse_logo.png');
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`Rendered PNG to ${pngPath} (${pngBuffer.length} bytes)`);
  } catch (err) {
    console.error('Failed to render PNG via Resvg:', err);
  }
}

renderLogo();
