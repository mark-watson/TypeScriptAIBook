// sqlite_knowledge.ts - Knowledge representation with SQLite

import Database from "better-sqlite3";

function buildKnowledgeBase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE scientists (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      birth_year INTEGER,
      nationality TEXT
    )
  `);

  db.exec(`
    CREATE TABLE fields (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  db.exec(`
    CREATE TABLE discoveries (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER,
      description TEXT
    )
  `);

  db.exec(`
    CREATE TABLE scientist_field (
      scientist_id INTEGER REFERENCES scientists(id),
      field_id INTEGER REFERENCES fields(id),
      PRIMARY KEY (scientist_id, field_id)
    )
  `);

  db.exec(`
    CREATE TABLE scientist_discovery (
      scientist_id INTEGER REFERENCES scientists(id),
      discovery_id INTEGER REFERENCES discoveries(id),
      PRIMARY KEY (scientist_id, discovery_id)
    )
  `);

  // Populate
  const insertScientist = db.prepare("INSERT INTO scientists VALUES (?, ?, ?, ?)");
  insertScientist.run(1, "Albert Einstein", 1879, "German");
  insertScientist.run(2, "Marie Curie", 1867, "Polish");
  insertScientist.run(3, "Richard Feynman", 1918, "American");

  const insertField = db.prepare("INSERT INTO fields VALUES (?, ?, ?)");
  insertField.run(1, "Physics", "Study of matter, energy, and their interactions");
  insertField.run(2, "Chemistry", "Study of composition and properties of matter");
  insertField.run(3, "Quantum Mechanics", "Physics of atomic and subatomic systems");

  const insertDiscovery = db.prepare("INSERT INTO discoveries VALUES (?, ?, ?, ?)");
  insertDiscovery.run(1, "Special Relativity", 1905, "Time and space are relative");
  insertDiscovery.run(2, "Radioactivity", 1898, "Discovery of radium and polonium");
  insertDiscovery.run(3, "Quantum Electrodynamics", 1948, "Quantum theory of light and matter");

  const insertSF = db.prepare("INSERT INTO scientist_field VALUES (?, ?)");
  insertSF.run(1, 1); insertSF.run(1, 3);
  insertSF.run(2, 1); insertSF.run(2, 2);
  insertSF.run(3, 1); insertSF.run(3, 3);

  const insertSD = db.prepare("INSERT INTO scientist_discovery VALUES (?, ?)");
  insertSD.run(1, 1);
  insertSD.run(2, 2);
  insertSD.run(3, 3);

  return db;
}

function queryKnowledgeBase(db: Database.Database): void {
  console.log("=== Scientists in Quantum Mechanics ===");
  const qmScientists = db.prepare(`
    SELECT s.name, s.nationality
    FROM scientists s
    JOIN scientist_field sf ON s.id = sf.scientist_id
    JOIN fields f ON sf.field_id = f.id
    WHERE f.name = 'Quantum Mechanics'
  `).all();
  for (const row of qmScientists as any[]) {
    console.log(`  ${row.name} (${row.nationality})`);
  }

  console.log("\n=== Discoveries by scientist ===");
  const discoveries = db.prepare(`
    SELECT s.name, d.name AS discovery, d.year, d.description
    FROM scientists s
    JOIN scientist_discovery sd ON s.id = sd.scientist_id
    JOIN discoveries d ON sd.discovery_id = d.id
    ORDER BY d.year
  `).all();
  for (const row of discoveries as any[]) {
    console.log(`  ${row.name}: ${row.discovery} (${row.year}) — ${row.description}`);
  }

  console.log("\n=== Scientists who share a field ===");
  const shared = db.prepare(`
    SELECT s1.name AS name1, s2.name AS name2, f.name AS field
    FROM scientist_field sf1
    JOIN scientist_field sf2 ON sf1.field_id = sf2.field_id
                            AND sf1.scientist_id < sf2.scientist_id
    JOIN scientists s1 ON sf1.scientist_id = s1.id
    JOIN scientists s2 ON sf2.scientist_id = s2.id
    JOIN fields f ON sf1.field_id = f.id
  `).all();
  for (const row of shared as any[]) {
    console.log(`  ${row.name1} & ${row.name2}: ${row.field}`);
  }
}

const db = buildKnowledgeBase();
queryKnowledgeBase(db);
db.close();
