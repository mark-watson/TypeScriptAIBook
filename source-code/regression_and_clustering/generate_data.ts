// Generate synthetic housing.csv and iris.csv datasets
import { writeFileSync } from "node:fs";

function generateHousing(): string {
  const headers = "MedInc,HouseAge,AveRooms,AveBedrms,Population,AveOccup,Latitude,Longitude,MedHouseVal";
  const rows: string[] = [headers];
  for (let i = 0; i < 500; i++) {
    const [r, medInc, age] = [Math.random, 1 + Math.random() * 10, 1 + Math.floor(Math.random() * 52)];
    const [rooms, bedrms, pop, occ] = [3 + r() * 8, 0.5 + r() * 2, 100 + Math.floor(r() * 5000), 1 + r() * 5];
    const [lat, lng] = [32 + r() * 10, -124 + r() * 10];
    const val = medInc * 0.4 + (42 - lat) * 0.1 + rooms * 0.05 + r() * 0.5;
    rows.push([medInc, age, rooms, bedrms, pop, occ, lat, lng, val].map(v => v.toFixed(4)).join(","));
  }
  return rows.join("\n");
}

function generateIris(): string {
  const species = [
    { name: "setosa", sl: [4.3, 5.8], sw: [2.3, 4.4], pl: [1.0, 1.9], pw: [0.1, 0.6] },
    { name: "versicolor", sl: [4.9, 7.0], sw: [2.0, 3.4], pl: [3.0, 5.1], pw: [1.0, 1.8] },
    { name: "virginica", sl: [4.9, 7.9], sw: [2.2, 3.8], pl: [4.5, 6.9], pw: [1.4, 2.5] },
  ];
  const rr = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const rows = ["sepal_length,sepal_width,petal_length,petal_width,species"];
  for (const sp of species)
    for (let i = 0; i < 50; i++)
      rows.push([rr(...sp.sl), rr(...sp.sw), rr(...sp.pl), rr(...sp.pw)].map(v => v.toFixed(1)).join(",") + "," + sp.name);
  return rows.join("\n");
}

writeFileSync("housing.csv", generateHousing());
writeFileSync("iris.csv", generateIris());
console.log("Generated housing.csv (500 rows) and iris.csv (150 rows)");
