const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

// We'll parse SQL CREATE TABLE, ALTER TABLE, CREATE INDEX
const tables = new Map(); // tableName -> { name, file, columns: [], pk: [], fks: [], uqs: [], checks: [], indexes: [] }

files.forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Find CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];

    if (!tables.has(tableName)) {
      tables.set(tableName, {
        name: tableName,
        file,
        columns: [],
        primaryKey: [],
        foreignKeys: [],
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: []
      });
    }

    const tableObj = tables.get(tableName);

    // Split body by lines/commas taking into account parentheses
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));

    lines.forEach(line => {
      // Remove trailing comma
      const cleanLine = line.replace(/,$/, '').trim();

      // Check for table constraints
      if (/^PRIMARY\s+KEY\s*\(([^)]+)\)/i.test(cleanLine)) {
        const pkCols = cleanLine.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)[1].split(',').map(c => c.trim().replace(/"/g, ''));
        tableObj.primaryKey.push(...pkCols);
      } else if (/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i.test(cleanLine)) {
        const m = cleanLine.match(/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        tableObj.primaryKey.push(...m[2].split(',').map(c => c.trim().replace(/"/g, '')));
      } else if (/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*\(([^)]+)\)(.*)/i.test(cleanLine)) {
        const m = cleanLine.match(/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*\(([^)]+)\)(.*)/i);
        tableObj.foreignKeys.push({
          name: m[1],
          columns: m[2].split(',').map(c => c.trim().replace(/"/g, '')),
          refTable: m[3],
          refColumns: m[4].split(',').map(c => c.trim().replace(/"/g, '')),
          action: m[5].trim()
        });
      } else if (/^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*\(([^)]+)\)(.*)/i.test(cleanLine)) {
        const m = cleanLine.match(/^FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*\(([^)]+)\)(.*)/i);
        tableObj.foreignKeys.push({
          columns: m[1].split(',').map(c => c.trim().replace(/"/g, '')),
          refTable: m[2],
          refColumns: m[3].split(',').map(c => c.trim().replace(/"/g, '')),
          action: m[4].trim()
        });
      } else if (/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+UNIQUE\s*\(([^)]+)\)/i.test(cleanLine)) {
        const m = cleanLine.match(/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+UNIQUE\s*\(([^)]+)\)/i);
        tableObj.uniqueConstraints.push({
          name: m[1],
          columns: m[2].split(',').map(c => c.trim().replace(/"/g, ''))
        });
      } else if (/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+CHECK\s*\((.*)\)/i.test(cleanLine)) {
        const m = cleanLine.match(/^CONSTRAINT\s+([a-zA-Z0-9_]+)\s+CHECK\s*\((.*)\)/i);
        tableObj.checkConstraints.push({
          name: m[1],
          expression: m[2]
        });
      } else {
        // It's a column definition: col_name data_type [constraints...]
        const colMatch = cleanLine.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)(.*)/);
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2];
          const rest = colMatch[3];

          const isPk = /PRIMARY\s+KEY/i.test(rest);
          const isNotNull = /NOT\s+NULL/i.test(rest);
          const defaultMatch = rest.match(/DEFAULT\s+([^,]+?)(?=\s+(?:NOT\s+NULL|CHECK|REFERENCES|$))/i);
          const refMatch = rest.match(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_.]+)\s*(?:\(([^)]+)\))?(.*)/i);
          const checkMatch = rest.match(/CHECK\s*\((.*)\)/i);

          if (isPk) tableObj.primaryKey.push(colName);
          if (refMatch) {
            tableObj.foreignKeys.push({
              columns: [colName],
              refTable: refMatch[1],
              refColumns: [refMatch[2] || 'id'],
              action: (refMatch[3] || '').trim()
            });
          }
          if (checkMatch) {
            tableObj.checkConstraints.push({
              name: `${tableName}_${colName}_check`,
              expression: checkMatch[1]
            });
          }

          tableObj.columns.push({
            name: colName,
            type: colType,
            notNull: isNotNull || isPk,
            default: defaultMatch ? defaultMatch[1].trim() : null
          });
        }
      }
    });
  }

  // Find CREATE INDEX statements
  const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)\s*(?:USING\s+[a-zA-Z0-9_]+\s*)?\(([^)]+)\)/gi;
  let idxMatch;
  while ((idxMatch = indexRegex.exec(content)) !== null) {
    const idxName = idxMatch[1];
    const idxTable = idxMatch[2].toLowerCase();
    const idxCols = idxMatch[3].split(',').map(c => c.trim().replace(/"/g, ''));

    if (tables.has(idxTable)) {
      tables.get(idxTable).indexes.push({
        name: idxName,
        columns: idxCols,
        isUnique: idxMatch[0].toUpperCase().includes('UNIQUE')
      });
    }
  }
});

// Save complete inventory
fs.writeFileSync('scratch/db-schema-inventory.json', JSON.stringify(Array.from(tables.values()), null, 2));
console.log('Processed tables count:', tables.size);
