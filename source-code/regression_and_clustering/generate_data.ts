// Generate synthetic housing.csv and iris.csv datasets
import { writeFileSync } from "node:fs";

// ---- Housing dataset (synthetic California-style) ----
function generateHousing(): string {
  const headers = "MedInc,HouseAge,AveRooms,AveBedrms,Population,AveOccup,Latitude,Longitude,MedHouseVal";
  const rows: string[] = [headers];
  const rng = () => Math.random();
  for (let i = 0; i < 500; i++) {
    const medInc = 1 + rng() * 10;
    const houseAge = 1 + Math.floor(rng() * 52);
    const aveRooms = 3 + rng() * 8;
    const aveBedrms = 0.5 + rng() * 2;
    const population = 100 + Math.floor(rng() * 5000);
    const aveOccup = 1 + rng() * 5;
    const latitude = 32 + rng() * 10;
    const longitude = -124 + rng() * 10;
    // Target: mostly driven by income + location
    const val = medInc * 0.4 + (42 - latitude) * 0.1 + aveRooms * 0.05 + rng() * 0.5;
    rows.push([medInc, houseAge, aveRooms, aveBedrms, population, aveOccup, latitude, longitude, val]
      .map(v => v.toFixed(4)).join(","));
  }
  return rows.join("\n");
}

// ---- Iris dataset (classic) ----
function generateIris(): string {
  const headers = "sepal_length,sepal_width,petal_length,petal_width,species";
  const species = [
    { name: "setosa", sl: [4.3, 5.8], sw: [2.3, 4.4], pl: [1.0, 1.9], pw: [0.1, 0.6] },
    { name: "versicolor", sl: [4.9, 7.0], sw: [2.0, 3.4], pl: [3.0, 5.1], pw: [1.0, 1.8] },
    { name: "virginica", sl: [4.9, 7.9], sw: [2.2, 3.8], pl: [4.5, 6.9], pw: [1.4, 2.5] },
  ];
  const rows: string[] = [headers];
  const rr = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  for (const sp of species) {
    for (let i = 0; i < 50; i++) {
      rows.push([rr(...sp.sl), rr(...sp.sw), rr(...sp.pl), rr(...sp.pw)]
        .map(v => v.toFixed(1)).join(",") + "," + sp.name);
    }
  }
  return rows.join("\n");
}

writeFileSync("housing.csv", generateHousing());
writeFileSync("iris.csv", generateIris());
console.log("Generated housing.csv (500 rows) and iris.csv (150 rows)");
