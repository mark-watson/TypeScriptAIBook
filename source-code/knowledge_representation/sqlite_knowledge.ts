// sqlite_knowledge.ts - Knowledge representation with SQLite

import Database from "better-sqlite3";

function buildKnowledgeBase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE scientists (id INTEGER PRIMARY KEY, name TEXT NOT NULL, birth_year INTEGER, nationality TEXT);
    CREATE TABLE fields (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT);
    CREATE TABLE discoveries (id INTEGER PRIMARY KEY, name TEXT NOT NULL, year INTEGER, description TEXT);
    CREATE TABLE scientist_field (scientist_id INTEGER REFERENCES scientists(id), field_id INTEGER REFERENCES fields(id), PRIMARY KEY (scientist_id, field_id));
    CREATE TABLE scientist_discovery (scientist_id INTEGER REFERENCES scientists(id), discovery_id INTEGER REFERENCES discoveries(id), PRIMARY KEY (scientist_id, discovery_id));
  `);

  const ins = (tbl: string, cols: number) =>
    db.prepare(`INSERT INTO ${tbl} VALUES (${Array(cols).fill("?").join(",")})`);

  const [iS, iF, iD, iSF, iSD] = [
    ins("scientists", 4), ins("fields", 3), ins("discoveries", 4),
    ins("scientist_field", 2), ins("scientist_discovery", 2),
  ];

  iS.run(1, "Albert Einstein", 1879, "German");
  iS.run(2, "Marie Curie", 1867, "Polish");
  iS.run(3, "Richard Feynman", 1918, "American");

  iF.run(1, "Physics", "Study of matter, energy, and their interactions");
  iF.run(2, "Chemistry", "Study of composition and properties of matter");
  iF.run(3, "Quantum Mechanics", "Physics of atomic and subatomic systems");

  iD.run(1, "Special Relativity", 1905, "Time and space are relative");
  iD.run(2, "Radioactivity", 1898, "Discovery of radium and polonium");
  iD.run(3, "Quantum Electrodynamics", 1948, "Quantum theory of light and matter");

  iSF.run(1, 1); iSF.run(1, 3); iSF.run(2, 1); iSF.run(2, 2); iSF.run(3, 1); iSF.run(3, 3);
  iSD.run(1, 1); iSD.run(2, 2); iSD.run(3, 3);

  return db;
}

function queryKnowledgeBase(db: Database.Database) {
  console.log("=== Scientists in Quantum Mechanics ===");
  for (const r of db.prepare(`
    SELECT s.name, s.nationality FROM scientists s
    JOIN scientist_field sf ON s.id = sf.scientist_id
    JOIN fields f ON sf.field_id = f.id
    WHERE f.name = 'Quantum Mechanics'
  `).all() as any[]) console.log(`  ${r.name} (${r.nationality})`);

  console.log("\n=== Discoveries by scientist ===");
  for (const r of db.prepare(`
    SELECT s.name, d.name AS discovery, d.year, d.description FROM scientists s
    JOIN scientist_discovery sd ON s.id = sd.scientist_id
    JOIN discoveries d ON sd.discovery_id = d.id ORDER BY d.year
  `).all() as any[]) console.log(`  ${r.name}: ${r.discovery} (${r.year}) — ${r.description}`);

  console.log("\n=== Scientists who share a field ===");
  for (const r of db.prepare(`
    SELECT s1.name AS name1, s2.name AS name2, f.name AS field FROM scientist_field sf1
    JOIN scientist_field sf2 ON sf1.field_id = sf2.field_id AND sf1.scientist_id < sf2.scientist_id
    JOIN scientists s1 ON sf1.scientist_id = s1.id
    JOIN scientists s2 ON sf2.scientist_id = s2.id
    JOIN fields f ON sf1.field_id = f.id
  `).all() as any[]) console.log(`  ${r.name1} & ${r.name2}: ${r.field}`);
}

const db = buildKnowledgeBase();
queryKnowledgeBase(db);
db.close();
