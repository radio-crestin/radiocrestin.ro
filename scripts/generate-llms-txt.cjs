const fs = require("fs");
const path = require("path");

const fallbackData = require("../src/common/data/fallback-stations.json");

const SITE_URL = "https://www.radiocrestin.ro";
const API_URL = "https://api.radiocrestin.ro/api/v1/stations";

async function generateLlmsTxt() {
  console.log("Generating llms.txt...");

  let stations = [];

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    stations = data.data?.stations || [];

    if (stations.length === 0) {
      throw new Error("Empty stations list from API");
    }

    console.log(`Found ${stations.length} stations from API`);
  } catch (err) {
    console.warn(`API unavailable (${err.message}), using fallback stations`);
    stations = fallbackData?.data?.stations || [];
    console.log(`Using ${stations.length} fallback stations`);
  }

  const stationEntries = stations
    .sort((a, b) => a.order - b.order)
    .map((station) => {
      const lines = [];
      lines.push(`### ${station.title}`);
      lines.push("");
      lines.push(`- [Ascultă ${station.title} live online](${SITE_URL}/${station.slug}/)`);
      if (station.website) {
        lines.push(`- [Website oficial ${station.title}](${station.website})`);
      }
      if (station.description) {
        const desc = station.description.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        lines.push("");
        lines.push(desc);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const content = `# RadioCrestin.ro

> Ascultă radio creștin online gratuit: ${stations.length} de posturi de radio creștine din România, cu muzică creștină non-stop, predici creștine și emisiuni live — direct din browser sau din aplicația mobilă, fără cont.

RadioCrestin.ro reunește cele mai importante radiouri creștine românești într-un singur loc, atât pentru românii din țară, cât și pentru cei din diaspora. Interfața și conținutul sunt în limba română.

Utilizatorii pot asculta live radiouri creștine online, pot vedea în timp real ce cântare creștină și ce artist rulează (la anumite posturi), pot adăuga radiourile preferate la favorite, pot evalua și lăsa recenzii pentru posturi, pot vedea câți ascultători are fiecare post și pot partaja posturile preferate pe WhatsApp și rețele sociale.

Cum funcționează: utilizatorul accesează site-ul, alege un post de radio din listă și apasă pe el pentru a începe ascultarea. Poate căuta posturi după numele postului sau după melodia care cântă. Nu este necesară crearea unui cont.

## Pagini principale

- [Radio creștin online – toate stațiile](${SITE_URL}/): ascultă gratuit toate radiourile creștine românești, live în browser
- [Muzică creștină online](${SITE_URL}/muzica-crestina/): worship, cântări creștine vechi și noi, gospel — muzică creștină non-stop
- [Predici creștine audio](${SITE_URL}/predici/): predici, învățătură biblică și emisiuni de zidire sufletească, online gratuit
- [Radio creștin pentru copii](${SITE_URL}/radio-crestin-pentru-copii/): cântecele creștine și povestiri biblice pentru cei mici
- [Întrebări frecvente](${SITE_URL}/intrebari-frecvente/): răspunsuri despre ascultarea radioului creștin online
- [Descarcă aplicația Radio Creștin](${SITE_URL}/descarca-aplicatia-radio-crestin/): aplicația mobilă gratuită pentru Android și iOS
- [Church Hub](${SITE_URL}/church-hub/): program gratuit de proiecție versuri pentru biserică, alternativă la EasyWorship

## Aplicația mobilă

Aplicația Radio Creștin este disponibilă gratuit pe Android și iOS, cu un rating de 4.9 stele din 5 și peste 2175 de recenzii. Aplicația suportă și Apple CarPlay, permițând ascultarea radio creștin direct din mașină.

- [Radio Creștin pe Google Play (Android)](https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin)
- [Radio Creștin pe App Store (iOS)](https://apps.apple.com/ro/app/radio-crestin/id6451270471)

## Posturi de radio creștine disponibile (${stations.length})

${stationEntries}
`;

  const publicDir = path.join(__dirname, "..", "public");
  fs.writeFileSync(path.join(publicDir, "llms.txt"), content);

  console.log(`llms.txt generated with ${stations.length} stations`);
}

generateLlmsTxt().catch((err) => {
  console.error("Failed to generate llms.txt:", err);
  process.exit(1);
});
