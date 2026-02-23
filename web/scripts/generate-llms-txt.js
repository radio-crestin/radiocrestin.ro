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
      lines.push(`- Ascultă live: ${SITE_URL}/${station.slug}`);
      if (station.website) {
        lines.push(`- Website oficial: ${station.website}`);
      }
      if (station.description) {
        const desc = station.description.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        lines.push(`- Descriere: ${desc}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const content = `# RadioCrestin.ro

> Platformă online pentru ascultarea posturilor de radio creștine din România

## Ce este RadioCrestin.ro?

RadioCrestin.ro este o platformă gratuită care reunește cele mai importante posturi de radio creștine din România într-un singur loc. Utilizatorii pot asculta muzică creștină, predici și emisiuni creștine de la multiple posturi, direct din browser sau prin aplicația mobilă.

## Pentru cine este?

Platforma este deschisă oricui dorește să asculte muzică creștină în limba română, atât pentru românii din țară, cât și pentru cei din diaspora.

## Ce pot face utilizatorii?

- Să asculte live posturi de radio creștine românești
- Să vadă ce melodie și ce artist cântă în timp real (la anumite posturi)
- Să adauge radiourile preferate în lista de favorite
- Să evalueze și să lase recenzii pentru posturi
- Să vadă câți ascultători are fiecare post (la anumite posturi)
- Să instaleze aplicația pe telefon (Android și iOS)
- Să partajeze posturile preferate pe WhatsApp și rețele sociale

## Cum funcționează?

Utilizatorul accesează site-ul, alege un post de radio din listă și apasă pe el pentru a începe ascultarea. Poate căuta posturi după nume sau după melodia care cântă. Nu este necesară crearea unui cont.

## Limbă

Interfața și conținutul sunt în limba română.

## Aplicația mobilă

Aplicația Radio Creștin este disponibilă gratuit pe Android și iOS, cu un rating de 4.9 stele din 5 și peste 1900 de recenzii. Aplicația suportă și Apple CarPlay, permițând ascultarea radio creștin direct din mașină.

## Contact

- Website: ${SITE_URL}
- Android: https://play.google.com/store/apps/details?id=com.radiocrestin.radio_crestin
- iOS: https://apps.apple.com/ro/app/radio-crestin/id6451270471

## Posturi de radio disponibile (${stations.length} posturi)

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
