/**
 * Minimal OBO 1.4 parser.
 *
 * Extracts only what helix-ontology needs for name->id lookup:
 *   - id:        OBO term id (e.g. CL:0000624)
 *   - name:      canonical name
 *   - synonym:   any synonym values (we discard scope/type metadata)
 *   - is_obsolete: filter these out
 *
 * Anything else in the OBO file (def, xref, is_a, relationship, ...) is ignored.
 * This is intentional -- a richer parser belongs in a sibling helix-ontology-hierarchy
 * extension if traversal of the term graph is ever needed.
 */

export interface OboTerm {
	id: string;
	name: string;
	synonyms: string[];
}

const SYNONYM_VALUE_RE = /^"([^"]*)"/;

export function parseObo(source: string): OboTerm[] {
	const terms: OboTerm[] = [];
	const lines = source.split(/\r?\n/);

	let inTerm = false;
	let id: string | undefined;
	let name: string | undefined;
	let synonyms: string[] = [];
	let obsolete = false;

	const flush = (): void => {
		if (inTerm && id && name && !obsolete) {
			terms.push({ id, name, synonyms });
		}
		inTerm = false;
		id = undefined;
		name = undefined;
		synonyms = [];
		obsolete = false;
	};

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line === "") continue;

		if (line.startsWith("[")) {
			flush();
			inTerm = line === "[Term]";
			continue;
		}
		if (!inTerm) continue;

		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();

		switch (key) {
			case "id":
				id = value;
				break;
			case "name":
				name = value;
				break;
			case "synonym": {
				const match = SYNONYM_VALUE_RE.exec(value);
				if (match) synonyms.push(match[1]);
				break;
			}
			case "is_obsolete":
				if (value === "true") obsolete = true;
				break;
		}
	}
	flush();
	return terms;
}
