/**
 * Ontology registry: loads .obo files from a directory and builds a
 * name+synonym -> [{id, name, source}] lookup index.
 *
 * Lookup is case-insensitive and matches both canonical names and synonyms.
 * Returns ordered: exact matches first, then synonym matches.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type OboTerm, parseObo } from "./obo-parser.js";

export type MatchType = "name" | "synonym";

export interface OntologyMatch {
	id: string;
	name: string;
	source: string;
	matchType: MatchType;
}

interface IndexEntry {
	id: string;
	name: string;
	source: string;
	matchType: MatchType;
}

export class OntologyRegistry {
	private readonly index = new Map<string, IndexEntry[]>();
	private readonly sources = new Map<string, number>();

	loadDirectory(dir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.toLowerCase().endsWith(".obo")) continue;
			const path = join(dir, entry);
			try {
				if (!statSync(path).isFile()) continue;
			} catch {
				continue;
			}
			const source = entry.replace(/\.obo$/i, "").toUpperCase();
			const text = readFileSync(path, "utf-8");
			this.loadTerms(source, parseObo(text));
		}
	}

	loadTerms(source: string, terms: OboTerm[]): void {
		this.sources.set(source, terms.length);
		for (const term of terms) {
			this.insert(term.name.toLowerCase(), { id: term.id, name: term.name, source, matchType: "name" });
			for (const synonym of term.synonyms) {
				this.insert(synonym.toLowerCase(), {
					id: term.id,
					name: term.name,
					source,
					matchType: "synonym",
				});
			}
		}
	}

	private insert(key: string, entry: IndexEntry): void {
		const bucket = this.index.get(key);
		if (bucket) {
			bucket.push(entry);
		} else {
			this.index.set(key, [entry]);
		}
	}

	lookup(term: string, ontology?: string, max = 5): OntologyMatch[] {
		const key = term.trim().toLowerCase();
		const hits = this.index.get(key) ?? [];
		const filtered = ontology ? hits.filter((h) => h.source === ontology.toUpperCase()) : hits;
		filtered.sort((a, b) => {
			if (a.matchType !== b.matchType) return a.matchType === "name" ? -1 : 1;
			return a.source.localeCompare(b.source);
		});
		return filtered.slice(0, max);
	}

	loadedSources(): { source: string; termCount: number }[] {
		return [...this.sources.entries()].map(([source, termCount]) => ({ source, termCount }));
	}

	get size(): number {
		return this.index.size;
	}
}
