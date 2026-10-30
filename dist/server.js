exports = globalThis.exports;
let node_fs_promises = require("node:fs/promises");
// ../../../packages/lib/src/server/rateLimit.ts
var SourceLock = class {
	active = new Set();
	async run(source, busy, task) {
		if (this.active.has(source)) return busy;
		this.active.add(source);
		try {
			return await task();
		} finally {
			this.active.delete(source);
		}
	}
	release(source) {
		this.active.delete(source);
	}
}, RateLimit = class {
	count;
	windowMs;
	hits = new Map();
	constructor(count, windowMs) {
		this.count = count, this.windowMs = windowMs;
	}
	take(source) {
		let now = GetGameTimer(), recent = (this.hits.get(source) ?? []).filter((at) => now - at < this.windowMs);
		return recent.length >= this.count ? (this.hits.set(source, recent), !1) : (recent.push(now), this.hits.set(source, recent), !0);
	}
	release(source) {
		this.hits.delete(source);
	}
};
// ../../../packages/lib/src/shared/read.ts
function num(value, fallback, min = -Infinity, max = Infinity) {
	return typeof value == "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function int$1(value, fallback, min = -Infinity, max = Infinity) {
	return Math.round(num(value, fallback, min, max));
}
function bool(value, fallback) {
	return typeof value == "boolean" ? value : fallback;
}
function str(value, fallback, max = 64) {
	return typeof value == "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
function record(value) {
	return typeof value == "object" && value && !Array.isArray(value) ? value : {};
}
// ../../../packages/lib/src/shared/vehicleProps.ts
const isObj = (v) => typeof v == "object" && !!v && !Array.isArray(v), nums = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x == "number") ? v : null;
function toVehicleProps(v) {
	if (!isObj(v) || v.v !== 1 || typeof v.model != "number" || typeof v.plate != "string") return null;
	let colors = nums(v.colors, 2), extraColors = nums(v.extraColors, 2), neonColor = nums(v.neonColor, 3), tyreSmoke = nums(v.tyreSmoke, 3);
	if (!colors || !extraColors || !neonColor || !tyreSmoke || !isObj(v.mods) || !isObj(v.extras) || !Array.isArray(v.neon)) return null;
	let mods = {};
	for (let [k, x] of Object.entries(v.mods)) typeof x == "number" && (mods[Number(k)] = x);
	let extras = {};
	for (let [k, x] of Object.entries(v.extras)) typeof x == "boolean" && (extras[Number(k)] = x);
	let n = (x, d) => typeof x == "number" ? x : d, rgb = (x) => nums(x, 3);
	return {
		v: 1,
		model: v.model,
		plate: v.plate.slice(0, 8),
		plateIndex: n(v.plateIndex, 0),
		colors: [colors[0] ?? 0, colors[1] ?? 0],
		extraColors: [extraColors[0] ?? 0, extraColors[1] ?? 0],
		customPrimary: rgb(v.customPrimary),
		customSecondary: rgb(v.customSecondary),
		wheelType: n(v.wheelType, 0),
		windowTint: n(v.windowTint, -1),
		livery: n(v.livery, -1),
		mods,
		xenonColor: n(v.xenonColor, 255),
		neon: [
			0,
			1,
			2,
			3
		].map((i) => v.neon instanceof Array && v.neon[i] === !0),
		neonColor: [
			neonColor[0] ?? 255,
			neonColor[1] ?? 0,
			neonColor[2] ?? 255
		],
		tyreSmoke: [
			tyreSmoke[0] ?? 255,
			tyreSmoke[1] ?? 255,
			tyreSmoke[2] ?? 255
		],
		extras,
		dirt: n(v.dirt, 0),
		engineHealth: n(v.engineHealth, 1e3),
		bodyHealth: n(v.bodyHealth, 1e3)
	};
}
// ../../../packages/lib/src/shared/placePed.ts
const isRecord$1 = (v) => typeof v == "object" && !!v && !Array.isArray(v), SCENARIOS = [
	"",
	"WORLD_HUMAN_STAND_IMPATIENT",
	"WORLD_HUMAN_CLIPBOARD",
	"WORLD_HUMAN_STAND_MOBILE",
	"WORLD_HUMAN_AA_COFFEE",
	"WORLD_HUMAN_SMOKING",
	"WORLD_HUMAN_GUARD_STAND",
	"WORLD_HUMAN_COP_IDLES",
	"WORLD_HUMAN_HANG_OUT_STREET"
], PLACE_PED_SPEC = {
	type: "object",
	optional: !0,
	fields: {
		model: {
			type: "text",
			max: 64,
			optional: !0
		},
		scenario: {
			type: "enum",
			values: [...SCENARIOS],
			optional: !0
		},
		coords: {
			type: "vec4",
			optional: !0
		}
	}
};
function placePedFields(path = "ped") {
	return [
		{
			widget: "model",
			kind: "ped",
			path: `${path}.model`,
			label: "ADMIN_F_PED_MODEL",
			hint: "ADMIN_H_PED_MODEL",
			placeholder: "ADMIN_PH_PED_MODEL"
		},
		{
			widget: "select",
			path: `${path}.scenario`,
			label: "ADMIN_F_PED_SCENARIO",
			hint: "ADMIN_H_PED_SCENARIO",
			options: SCENARIOS.map((value) => ({
				value,
				label: value ? `ADMIN_O_SCENARIO_${value}` : "ADMIN_O_SCENARIO_NONE"
			}))
		},
		{
			widget: "point",
			path: `${path}.coords`,
			heading: !0,
			ground: !0,
			label: "ADMIN_F_PED_POSITION",
			hint: "ADMIN_H_PED_POSITION"
		}
	];
}
function readPlacePed(value) {
	if (!isRecord$1(value) || typeof value.model != "string" || !value.model.trim()) return null;
	let c = value.coords, coords = isRecord$1(c) && [
		c.x,
		c.y,
		c.z,
		c.heading
	].every((n) => typeof n == "number") ? {
		x: Number(c.x),
		y: Number(c.y),
		z: Number(c.z),
		heading: Number(c.heading)
	} : void 0;
	return {
		model: value.model.trim(),
		scenario: typeof value.scenario == "string" && value.scenario ? value.scenario : void 0,
		coords
	};
}
// ../../../packages/lib/src/shared/index.ts
function isRecord(value) {
	return typeof value == "object" && !!value && !Array.isArray(value);
}
function logSafe(text, max) {
	return text.replace(/\r?\n/g, " | ").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\^\d/g, "").slice(0, max);
}
function formatText(template, args) {
	return template.replace(/\{(\d+)\}/g, (match, index) => {
		let value = args[Number(index)];
		return value === void 0 ? match : String(value);
	});
}
const asArgs = (value) => value === null ? null : [value];
function createLogger(resource) {
	let prefix = `[${resource}]`;
	return {
		info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
		warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
		error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
	};
}
function withoutSchemaKey(value) {
	if (!isRecord(value) || !("$schema" in value)) return value;
	let { $schema: _schema, ...rest } = value;
	return rest;
}
var DataFile = class {
	resource;
	name;
	log;
	writes = Promise.resolve();
	pending = void 0;
	timer = null;
	schemaRef = null;
	constructor(resource, name, log) {
		this.resource = resource, this.name = name, this.log = log;
	}
	hasSchemaRef() {
		return (LoadResourceFile(this.resource, this.path) ?? "").includes("\"$schema\"");
	}
	read() {
		for (let path of [this.path, `${this.path}.bak`]) {
			let raw = LoadResourceFile(this.resource, path);
			if (raw) try {
				return withoutSchemaKey(JSON.parse(raw));
			} catch (error) {
				this.log.error(`${this.resource}/${path} is not valid JSON${path === this.path ? ", trying the backup" : ""}`, error);
			}
		}
		return null;
	}
	write(value) {
		this.pending = value, this.timer ||= setTimeout(() => {
			this.timer = null;
			let data = this.schemaRef && isRecord(this.pending) ? {
				$schema: this.schemaRef,
				...this.pending
			} : this.pending, text = `${JSON.stringify(data, null, 2)}\n`;
			this.writes = this.writes.then(() => this.flush(text)).catch((error) => this.log.error(`saving ${this.resource}/${this.path} failed`, error));
		}, 250);
	}
	get path() {
		return `data/${this.name}.json`;
	}
	async flush(text) {
		let file = `${GetResourcePath(this.resource)}/${this.path}`;
		await (0, node_fs_promises.mkdir)(file.slice(0, file.lastIndexOf("/")), { recursive: !0 }), await (0, node_fs_promises.writeFile)(`${file}.tmp`, text, "utf8"), await (0, node_fs_promises.copyFile)(file, `${file}.bak`).catch(() => void 0), await (0, node_fs_promises.rename)(`${file}.tmp`, file);
	}
};
// ../../../packages/shared/src/core.ts
const CORE = {
	resource: "ai-core",
	clientErrorEvent: "ai-core:clientError",
	playerLoadedEvent: "ai-core:playerLoaded",
	playerUnloadedEvent: "ai-core:playerUnloaded",
	moneyChangedEvent: "ai-core:moneyChanged",
	jobsChangedEvent: "ai-core:jobsChanged",
	dutyChangedEvent: "ai-core:dutyChanged",
	gangsChangedEvent: "ai-core:gangsChanged",
	activeGangChangedEvent: "ai-core:activeGangChanged",
	characterScreenEvent: "ai-core:characterScreen",
	inventoryChangedEvent: "ai-core:inventoryChanged",
	itemUsedEvent: "ai-core:itemUsed",
	playerDiedEvent: "ai-core:playerDied",
	clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
	clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
	clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
	clientCharacterLookEvent: "ai-core:client:characterLook",
	clientPromptPressedEvent: "ai-core:client:promptPressed",
	clientCacheEvent: "ai-core:client:cache",
	clientHudVisibleEvent: "ai-core:client:hudVisible",
	vehicleTypeCallback: "ai-core:vehicleType",
	interactionStateKey: "ai:interaction",
	charactersCallback: "ai-core:characters",
	createCharacterCallback: "ai-core:createCharacter",
	deleteCharacterCallback: "ai-core:deleteCharacter",
	selectCharacterCallback: "ai-core:selectCharacter",
	clientNotifyEvent: "ai-core:client:notify",
	spawnEvent: "ai-core:client:spawn",
	openCharactersEvent: "ai-core:client:openCharacters"
}, ADMIN = {
	ace: "ai.admin",
	openCallback: "ai-core:admin:open",
	applyCallback: "ai-core:admin:apply",
	closeEvent: "ai-core:admin:close",
	showEvent: "ai-core:admin:show",
	deltaEvent: "ai-core:admin:delta",
	worldEvent: (resource) => `${resource}:admin:world`,
	worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
}, VEHICLE_BAGS = {
	owned: "ai:owned",
	id: "ai:vid",
	props: "ai:props",
	setup: "ai:setup",
	fuel: "fuel"
};
// ../../../packages/lib/src/fivem/exports.ts
function registerExport(name, handler) {
	globalThis.exports(name, handler);
}
function resourceExport(resource) {
	return globalThis.exports[resource];
}
function isResourceStarted(resource) {
	return GetResourceState(resource) === "started";
}
function optionalExport(resource) {
	return isResourceStarted(resource) ? globalThis.exports[resource] : null;
}
function readLocaleFile(resource, lang) {
	let raw = LoadResourceFile(resource, `locales/${lang}.json`);
	if (!raw) return {};
	let parsed = JSON.parse(raw);
	if (!isRecord(parsed)) return {};
	let texts = {};
	for (let [key, value] of Object.entries(parsed)) typeof value == "string" && (texts[key] = value);
	return texts;
}
function createLocale() {
	let texts = loadLocaleTexts();
	return (key, ...args) => formatText(texts[key] ?? key, args);
}
function loadLocaleTexts(resource = GetCurrentResourceName()) {
	let lang = GetConvar("ai:locale", "en"), texts = {
		...readLocaleFile(resource, "en"),
		...lang === "en" ? {} : readLocaleFile(resource, lang)
	};
	for (let key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
	return texts;
}
// ../../../packages/lib/src/fivem/callbackNames.ts
const requestEvent = (name) => `aicore:cb:${name}`, responseEvent = (resource) => `aicore:cbr:${resource}`;
resourceExport(CORE.resource);
const log$4 = createLogger(GetCurrentResourceName()), gates = new Set();
on("playerDropped", () => {
	let source = Number(globalThis.source);
	for (let gate of gates) gate.release(source);
});
var ClientGate = class {
	name;
	options;
	limit;
	lock;
	constructor(name, options, defaultRate) {
		this.name = name, this.options = options, this.limit = new RateLimit(options.rate?.count ?? defaultRate, options.rate?.windowMs ?? 1e3), this.lock = options.lock ? new SourceLock() : null, gates.add(this);
	}
	check(source, raw) {
		if (!(source > 0) || !GetPlayerName(String(source)) || !this.limit.take(source)) return null;
		for (let guard of this.options.guards ?? []) {
			let verdict = guard(source);
			if (verdict !== !0) return typeof verdict == "string" && this.refuse(source, verdict), null;
		}
		if (!this.options.args) return [];
		let args = this.options.args(raw);
		return args === null && this.refuse(source, `invalid arguments ${logSafe(JSON.stringify(raw) ?? "", 200)}`), args;
	}
	run(source, busy, task) {
		return this.lock ? this.lock.run(source, busy, async () => task()) : Promise.resolve(task());
	}
	release(source) {
		this.limit.release(source), this.lock?.release(source);
	}
	refuse(source, reason) {
		log$4.warn(`${this.name} refused for ${GetPlayerName(String(source))} (${source}): ${reason}`);
	}
};
// ../../../packages/lib/src/server/callback.ts
const log$3 = createLogger(GetCurrentResourceName()), resource$1 = GetCurrentResourceName(), REFUSED = Symbol("refused");
function onClientCallback(name, first, second) {
	let [handler, options] = typeof first == "function" ? [first, second ?? {}] : [second, first], gate = new ClientGate(name, options, 20);
	onNet(requestEvent(name), async (caller, id, ...raw) => {
		let source = Number(globalThis.source);
		if (typeof caller != "string" || caller.length > 64 || typeof id != "number") return;
		let args = gate.check(source, raw);
		if (!args) return emitNet(responseEvent(caller), source, id, !1, null);
		try {
			let result = await gate.run(source, REFUSED, () => handler(source, ...args));
			result === REFUSED ? emitNet(responseEvent(caller), source, id, !1, null) : emitNet(responseEvent(caller), source, id, !0, result ?? null);
		} catch (error) {
			log$3.error(`callback ${name} failed for ${source}`, error), emitNet(responseEvent(caller), source, id, !1, null);
		}
	});
}
const pending = new Map();
onNet(responseEvent(resource$1), (id, ok, result) => {
	let entry = typeof id == "number" ? pending.get(id) : void 0;
	entry && entry.source === Number(globalThis.source) && (pending.delete(id), clearTimeout(entry.timer), ok === !0 ? entry.resolve(result) : entry.reject(Error("client callback failed")));
});
// ../../../packages/lib/src/server/admin/patch.ts
function toPatch(value) {
	if (!isRecord(value) || typeof value.file != "string") return null;
	let key = typeof value.key == "string" ? value.key : void 0;
	switch (value.action) {
		case "set": return typeof value.section == "string" ? {
			file: value.file,
			action: "set",
			key,
			section: value.section,
			value: value.value
		} : null;
		case "create": return key && typeof value.label == "string" ? {
			file: value.file,
			action: "create",
			key,
			label: value.label
		} : null;
		case "delete": return key ? {
			file: value.file,
			action: "delete",
			key
		} : null;
		case "import": {
			if (!isRecord(value.records)) return null;
			let records = {};
			for (let [k, v] of Object.entries(value.records)) isRecord(v) && (records[k] = v);
			return Object.keys(records).length > 0 && Object.keys(records).length <= 500 ? {
				file: value.file,
				action: "import",
				records
			} : null;
		}
		default: return null;
	}
}
const clone = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value)), core$8 = resourceExport(CORE.resource), ERR = {
	type: "ADMIN_ERR_TYPE",
	range: "ADMIN_ERR_RANGE",
	length: "ADMIN_ERR_LENGTH",
	pattern: "ADMIN_ERR_PATTERN",
	required: "ADMIN_ERR_REQUIRED",
	lookup: "ADMIN_ERR_LOOKUP"
}, lookups = new class {
	lists = new Map();
	values(source) {
		let cached = this.lists.get(source);
		if (cached && Date.now() - cached.at < 2e3) return cached.values.size > 0 ? cached.values : null;
		let list = [];
		try {
			list = core$8.GetLookupValues(source);
		} catch {}
		let values = new Set(Array.isArray(list) ? list.filter((v) => typeof v == "string") : []);
		return this.lists.set(source, {
			at: Date.now(),
			values
		}), values.size > 0 ? values : null;
	}
}(), isVec = (value, keys) => isRecord(value) && keys.every((k) => typeof value[k] == "number" && Number.isFinite(value[k]));
function validate(spec, value, path) {
	if (value == null) return spec.optional ? null : {
		error: ERR.required,
		path
	};
	let fail = (error) => ({
		error,
		path
	});
	switch (spec.type) {
		case "text": return typeof value == "string" ? value.length < (spec.min ?? 1) || value.length > (spec.max ?? 120) ? fail(ERR.length) : spec.pattern && !new RegExp(spec.pattern).test(value) ? fail(ERR.pattern) : spec.lookup && value !== "" && lookups.values(spec.lookup)?.has(value) === !1 ? fail(ERR.lookup) : null : fail(ERR.type);
		case "number": return typeof value != "number" || !Number.isFinite(value) || spec.integer && !Number.isInteger(value) ? fail(ERR.type) : spec.min !== void 0 && value < spec.min || spec.max !== void 0 && value > spec.max ? fail(ERR.range) : null;
		case "bool": return typeof value == "boolean" ? null : fail(ERR.type);
		case "enum": return spec.values.includes(value) ? null : fail(ERR.type);
		case "names": {
			if (!Array.isArray(value) || value.length > (spec.max ?? 50)) return fail(ERR.length);
			let pattern = new RegExp(spec.pattern ?? "^[\\w.:-]+$"), seen = new Set();
			for (let name of value) {
				if (typeof name != "string" || name.length > (spec.itemMax ?? 64) || seen.has(name)) return fail(ERR.type);
				if (!pattern.test(name)) return fail(ERR.pattern);
				if (spec.lookup && lookups.values(spec.lookup)?.has(name) === !1) return fail(ERR.lookup);
				seen.add(name);
			}
			return null;
		}
		case "vec3": return isVec(value, [
			"x",
			"y",
			"z"
		]) ? null : fail(ERR.type);
		case "vec4": return isVec(value, [
			"x",
			"y",
			"z",
			"heading"
		]) ? null : fail(ERR.type);
		case "object":
			if (!isRecord(value)) return fail(ERR.type);
			for (let key of Object.keys(value)) if (!(key in spec.fields)) return {
				error: ERR.type,
				path: `${path}.${key}`
			};
			for (let [key, field] of Object.entries(spec.fields)) {
				let refusal = validate(field, value[key], `${path}.${key}`);
				if (refusal) return refusal;
			}
			return null;
		case "list":
			if (!Array.isArray(value)) return fail(ERR.type);
			if (value.length < (spec.min ?? 0) || value.length > (spec.max ?? 100)) return fail(ERR.length);
			for (let i = 0; i < value.length; i++) {
				let refusal = validate(spec.of, value[i], `${path}.${i + 1}`);
				if (refusal) return refusal;
			}
			return null;
		default: return spec;
	}
}
// ../../../packages/lib/src/server/admin/jsonSchema.ts
const SCHEMA_KEY = {
	type: "string",
	description: "This file's JSON Schema (for editors)."
};
function langFile(resource) {
	try {
		let raw = JSON.parse(LoadResourceFile(resource, "locales/en.json") ?? "{}");
		return isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter((e) => typeof e[1] == "string")) : {};
	} catch {
		return {};
	}
}
function texts(resource) {
	return {
		...langFile("ai-core"),
		...langFile(resource)
	};
}
function collect(fields, prefix, lang, out) {
	for (let field of fields) {
		let path = prefix + field.path, label = lang[field.label] ?? field.label, hint = field.hint ? lang[field.hint] ?? field.hint : "";
		out.has(path) || out.set(path, hint ? `${label}: ${hint}` : label), field.widget === "list" && collect(field.rows, `${path}[].`, lang, out);
	}
}
function describe(schema, file, lang) {
	let out = new Map();
	for (let tab of schema.tabs) if (tab.file === file) for (let card of tab.cards) collect(card.fields, "", lang, out);
	return out;
}
function toJson(spec, path, desc) {
	let description = desc.get(path), base = description ? { description } : {};
	switch (spec.type) {
		case "text": return {
			...base,
			type: "string",
			minLength: spec.min,
			maxLength: spec.max,
			pattern: spec.pattern
		};
		case "number": return {
			...base,
			type: spec.integer ? "integer" : "number",
			minimum: spec.min,
			maximum: spec.max
		};
		case "bool": return {
			...base,
			type: "boolean"
		};
		case "enum": return {
			...base,
			enum: spec.values
		};
		case "names": return {
			...base,
			type: "array",
			maxItems: spec.max,
			uniqueItems: !0,
			items: {
				type: "string",
				maxLength: spec.itemMax,
				pattern: spec.pattern
			}
		};
		case "vec3":
		case "vec4": {
			let keys = spec.type === "vec3" ? [
				"x",
				"y",
				"z"
			] : [
				"x",
				"y",
				"z",
				"heading"
			];
			return {
				...base,
				type: "object",
				required: keys,
				properties: Object.fromEntries(keys.map((k) => [k, { type: "number" }]))
			};
		}
		case "object": return {
			...base,
			...objectOf(spec.fields, path ? `${path}.` : "", desc)
		};
		case "list": return {
			...base,
			type: "array",
			minItems: spec.min,
			maxItems: spec.max,
			items: toJson(spec.of, `${path}[]`, desc)
		};
		default: return spec;
	}
}
function objectOf(fields, prefix, desc) {
	return {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, toJson(s, prefix + k, desc)])),
		required: Object.entries(fields).filter(([, s]) => !s.optional).map(([k]) => k)
	};
}
function fileSchema(resource, schema, name, spec) {
	let desc = describe(schema, name, texts(resource)), title = `${resource}/data/${name}.json`, body = spec.kind === "settings" ? (() => {
		let obj = objectOf(spec.sections, "", desc), required = obj.required.filter((k) => !(k in (spec.defaults ?? {})));
		return {
			...obj,
			properties: {
				$schema: SCHEMA_KEY,
				...obj.properties
			},
			required
		};
	})() : {
		type: "object",
		properties: { $schema: SCHEMA_KEY },
		patternProperties: { [spec.keyPattern ?? "^[a-z0-9_]{2,32}$"]: objectOf(spec.sections, "", desc) },
		additionalProperties: !1
	};
	return `${JSON.stringify({
		$schema: "http://json-schema.org/draft-07/schema#",
		title,
		...body
	}, null, 2)}\n`;
}
function writeSchema(resource, name, text, log) {
	let path = `data/schemas/${name}.schema.json`;
	if (LoadResourceFile(resource, path) === text) return;
	let dir = `${GetResourcePath(resource)}/data/schemas`;
	(0, node_fs_promises.mkdir)(dir, { recursive: !0 }).then(() => (0, node_fs_promises.writeFile)(`${dir}/${name}.schema.json`, text, "utf8")).catch((error) => log.error(`writing ${resource}/${path} failed`, error));
}
// ../../../packages/lib/src/server/admin/panel.ts
const core$7 = resourceExport(CORE.resource), DEFAULT_KEY = "^[a-z0-9_]{2,32}$";
function imported(spec, value) {
	let base = clone(spec.newRecord ?? {}), out = {};
	for (let name of Object.keys(spec.sections)) {
		let v = name in value ? value[name] : base[name];
		v !== void 0 && (out[name] = clone(v));
	}
	return out;
}
var AdminPanel = class {
	schema;
	data = new Map();
	dataFiles = new Map();
	handlers = new Map();
	rules = new Map();
	worldChanges = new Map();
	resource = GetCurrentResourceName();
	log = createLogger(this.resource);
	constructor(schema) {
		this.schema = schema;
		for (let [name, spec] of Object.entries(schema.files)) this.load(name, spec);
		registerExport("AdminPanelSnapshot", () => this.snapshot()), registerExport("AdminPanelApply", (admin, patch) => this.apply(admin, patch)), onClientCallback(ADMIN.worldChangesCallback(this.resource), () => Object.fromEntries(this.worldChanges)), setImmediate(() => core$7.RegisterAdminPanel(this.resource));
	}
	get(file) {
		return this.data.get(file) ?? {};
	}
	onChange(file, handler) {
		this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
	}
	rule(file, rule) {
		this.rules.set(file, rule);
	}
	snapshot() {
		return {
			resource: this.resource,
			schema: this.schema,
			texts: loadLocaleTexts(),
			data: clone(Object.fromEntries(this.data))
		};
	}
	apply(admin, raw) {
		let patch = toPatch(raw), spec = patch ? this.schema.files[patch.file] : void 0;
		if (!patch || !spec || spec.memory) return {
			ok: !1,
			error: ERR.type
		};
		let error = this.check(patch, spec);
		return error ? (this.log.warn(`admin ${admin} edit refused (${error}): ${JSON.stringify(patch).slice(0, 300)}`), {
			ok: !1,
			error
		}) : (this.store(patch, spec), { ok: !0 });
	}
	commit(file, key, value) {
		let data = this.data.get(file);
		data && (key === void 0 ? isRecord(value) && this.data.set(file, clone(value)) : value === null ? delete data[key] : data[key] = clone(value), this.changed(file, key));
	}
	linked(spec, value) {
		return spec.type === "text" && spec.records && typeof value == "string" && value !== "" && !(value in this.get(spec.records)) ? "ADMIN_ERR_LOOKUP" : null;
	}
	check(patch, spec) {
		let data = this.get(patch.file);
		if (patch.action === "create") return spec.kind !== "records" || !new RegExp(spec.keyPattern ?? DEFAULT_KEY).test(patch.key) ? ERR.pattern : patch.key in data ? "ADMIN_ERR_EXISTS" : null;
		if (patch.action === "delete") return spec.kind !== "records" || !(patch.key in data) ? ERR.type : spec.locked?.includes(patch.key) ? "ADMIN_ERR_LOCKED" : null;
		if (patch.action === "import") {
			if (spec.kind !== "records") return ERR.type;
			let pattern = new RegExp(spec.keyPattern ?? DEFAULT_KEY);
			for (let [key, value] of Object.entries(patch.records)) {
				if (!pattern.test(key)) return ERR.pattern;
				let record = imported(spec, value);
				for (let [name, section] of Object.entries(spec.sections)) {
					let refusal = validate(section, record[name], name);
					if (refusal) return refusal.error;
					let link = this.linked(section, record[name]);
					if (link) return link;
				}
				let ruled = this.rules.get(patch.file)?.(key, record);
				if (ruled) return ruled;
			}
			return null;
		}
		let section = spec.sections[patch.section];
		if (!section || spec.kind === "records" && (!patch.key || !(patch.key in data))) return ERR.type;
		let refusal = validate(section, patch.value, patch.section);
		if (refusal) return refusal.error;
		let link = this.linked(section, patch.value);
		if (link) return link;
		let current = spec.kind === "records" ? data[patch.key ?? ""] : data, next = {
			...isRecord(current) ? current : {},
			[patch.section]: patch.value
		};
		return this.rules.get(patch.file)?.(patch.key, next) ?? null;
	}
	store(patch, spec) {
		let data = this.data.get(patch.file) ?? {};
		if (patch.action === "create") {
			let record = clone(spec.newRecord ?? {});
			spec.labelPath && (record[spec.labelPath] = patch.label), data[patch.key] = record;
		} else if (patch.action === "delete") delete data[patch.key];
		else if (patch.action === "import") {
			for (let [key, value] of Object.entries(patch.records)) data[key] = imported(spec, value);
			this.data.set(patch.file, data);
			for (let key of Object.keys(patch.records)) this.changed(patch.file, key);
			return;
		} else {
			let target = spec.kind === "records" ? data[patch.key ?? ""] : data;
			if (!isRecord(target)) return;
			patch.value === void 0 || patch.value === null ? delete target[patch.section] : target[patch.section] = clone(patch.value);
		}
		this.data.set(patch.file, data), this.changed(patch.file, spec.kind === "records" ? patch.key : void 0);
	}
	changed(file, key) {
		let spec = this.schema.files[file], data = this.get(file), value = key === void 0 ? data : data[key] ?? null;
		this.dataFiles.get(file)?.write(data);
		for (let handler of this.handlers.get(file) ?? []) handler(key, value);
		if (core$7.AdminPanelChanged({
			resource: this.resource,
			file,
			key,
			value: clone(value)
		}), spec?.sync !== "all") return;
		let changes = this.worldChanges.get(file) ?? {};
		changes[key ?? ""] = clone(value), this.worldChanges.set(file, changes), emitNet(ADMIN.worldEvent(this.resource), -1, file, key ?? null, value);
	}
	load(name, spec) {
		if (spec.memory) {
			this.data.set(name, {});
			return;
		}
		let file = new DataFile(this.resource, name, this.log);
		this.dataFiles.set(name, file), file.schemaRef = `./schemas/${name}.schema.json`, writeSchema(this.resource, name, fileSchema(this.resource, this.schema, name, spec), this.log);
		let raw = file.read(), data = isRecord(raw) ? raw : {}, filled = !1;
		if (spec.kind === "settings") for (let [section, value] of Object.entries(spec.defaults ?? {})) section in data || (data[section] = clone(value), filled = !0);
		this.data.set(name, data), (filled || raw === null || !file.hasSchemaRef()) && file.write(data);
	}
};
// ../../../packages/lib/src/server/log.ts
function aiLog(channel, message, options) {
	optionalExport("ai-core")?.Log(channel, message, options);
}
function aiLogChannels(channels) {
	optionalExport("ai-core")?.LogChannels(channels);
}
// ../../../packages/lib/src/server/notify.ts
function notify(source, text, kind = "info", duration) {
	let notification = {
		text,
		kind,
		duration
	};
	emitNet(CORE.clientNotifyEvent, source, notification);
}
// ../../../packages/lib/src/server/inventory.ts
const core$6 = resourceExport(CORE.resource), inventory = {
	addItem: (inv, item, count = 1, metadata, slot) => core$6.AddItem(inv, item, count, metadata, slot),
	removeItem: (inv, item, count = 1, metadata, slot) => core$6.RemoveItem(inv, item, count, metadata, slot),
	getItemCount: (inv, item, metadata) => core$6.GetItemCount(inv, item, metadata),
	hasItem: (inv, item, count = 1) => core$6.HasItem(inv, item, count),
	canCarryItem: (inv, item, count = 1, metadata) => core$6.CanCarryItem(inv, item, count, metadata),
	getItems: (inv) => core$6.GetItems(inv),
	clearInventory: (inv) => core$6.ClearInventory(inv),
	registerStash: (name, label, slots, maxWeight, jobs = []) => core$6.RegisterStash(name, label, slots, maxWeight, jobs),
	openInventory: (source, inv) => core$6.OpenInventory(source, inv),
	registerUsableItem: (name, handler) => core$6.RegisterUsableItem(name, handler),
	getItemDefinition: (name) => core$6.GetItemDefinition(name)
}, core$5 = resourceExport(CORE.resource);
var OnlinePlayers = class {
	players = new Map();
	onDuty = new Map();
	started = !1;
	start() {
		if (this.started) return;
		this.started = !0;
		let load = (source, character) => {
			this.put(source, character, (core$5.GetJobs(source) ?? []).map((m) => m.job), (core$5.GetGangs(source) ?? []).map((m) => m.gang)), this.setDuty(source, core$5.GetDutyJob(source));
		};
		on(CORE.playerLoadedEvent, load), on(CORE.playerUnloadedEvent, (source) => this.drop(source)), on(CORE.jobsChangedEvent, (source, jobs) => {
			let player = this.players.get(source);
			player && (player.jobs = jobs.map((m) => m.job));
		}), on(CORE.gangsChangedEvent, (source, gangs) => {
			let player = this.players.get(source);
			player && (player.gangs = gangs.map((m) => m.gang));
		}), on(CORE.dutyChangedEvent, (source, job) => this.setDuty(source, job));
		for (let source of core$5.GetLoadedSources()) {
			let character = core$5.GetCharacter(source);
			character && load(source, character);
		}
	}
	put(source, character, jobs, gangs) {
		this.drop(source), this.players.set(source, {
			character,
			jobs,
			gangs,
			duty: null
		});
	}
	drop(source) {
		this.setDuty(source, null), this.players.delete(source);
	}
	setDuty(source, job) {
		let player = this.players.get(source);
		if (!player || (player.duty && this.onDuty.get(player.duty)?.delete(source), player.duty = job, !job)) return;
		let set = this.onDuty.get(job);
		set || this.onDuty.set(job, set = new Set()), set.add(source);
	}
	sources() {
		return this.start(), this.players.keys();
	}
	get size() {
		return this.start(), this.players.size;
	}
	character(source) {
		return this.start(), this.players.get(source)?.character ?? null;
	}
	jobs(source) {
		return this.start(), this.players.get(source)?.jobs ?? [];
	}
	gangs(source) {
		return this.start(), this.players.get(source)?.gangs ?? [];
	}
	dutyJob(source) {
		return this.start(), this.players.get(source)?.duty ?? null;
	}
	onDutyFor(job) {
		return this.start(), this.onDuty.get(job) ?? EMPTY;
	}
};
const EMPTY = new Set();
new OnlinePlayers(), resourceExport(CORE.resource), resourceExport(CORE.resource);
// ../../../packages/lib/src/server/command.ts
const resource = GetCurrentResourceName();
createLogger(resource), new class {
	list = [];
	sent = new Map();
	announced = 0;
	queued = !1;
	listening = !1;
	add(command) {
		this.listening || this.listen(), this.list.push(command), this.queued || (this.queued = !0, setImmediate(() => this.flush()));
	}
	refresh(source) {
		let before = this.sent.get(source), now = new Set(), add = [];
		for (let command of this.list) for (let name of command.info.names) command.allowed(source, name) && (now.add(name), before?.has(name) || add.push(command.suggestion(name)));
		if (this.sent.set(source, now), add.length && emitNet("chat:addSuggestions", source, add), before) for (let name of before) now.has(name) || emitNet("chat:removeSuggestion", source, `/${name}`);
	}
	flush() {
		this.queued = !1, optionalExport(CORE.resource)?.RegisterCommands(resource, this.list.slice(this.announced).map((c) => c.info)), this.announced = this.list.length;
		for (let player of getPlayers()) this.refresh(Number(player));
	}
	listen() {
		this.listening = !0;
		let refresh = (source) => this.refresh(Number(source));
		on(CORE.playerLoadedEvent, refresh), on(CORE.jobsChangedEvent, refresh), on(CORE.gangsChangedEvent, refresh), on("playerDropped", () => this.sent.delete(Number(globalThis.source))), on("onResourceStop", (name) => {
			if (name === resource) for (let command of this.list) for (let n of command.info.names) emitNet("chat:removeSuggestion", -1, `/${n}`);
		});
	}
}(), createLogger(GetCurrentResourceName()), createLogger("aicore-lib");
// ../../../packages/lib/src/fivem/state.ts
const isServer = IsDuplicityVersion();
var Mirror = class {
	key;
	parse;
	values = new Map();
	listeners = new Set();
	constructor(key, parse) {
		this.key = key, this.parse = parse;
	}
	onChange(listener) {
		return this.listeners.add(listener), () => this.listeners.delete(listener);
	}
	store(id, raw) {
		this.apply(id, raw == null ? void 0 : this.parse(raw));
	}
	apply(id, value) {
		let old = this.values.get(id);
		if (this.values.set(id, value), old !== value) for (let listener of this.listeners) listener(id, value, old);
	}
}, EntityState$1 = class extends Mirror {
	handles = new Map();
	constructor(key, parse) {
		super(key, parse), AddStateBagChangeHandler(key, "", (bag, _key, value) => {
			if (!bag.startsWith("entity:")) return;
			let netId = Number(bag.slice(7));
			this.handles.set(netId, GetEntityFromStateBagName(bag)), this.store(netId, value);
		}), isServer ? on("entityRemoved", (entity) => this.forget(NetworkGetNetworkIdFromEntity(entity))) : setInterval(() => this.prune(), 3e4);
	}
	get(entity) {
		if (!entity) return;
		let netId = NetworkGetNetworkIdFromEntity(entity), handle = this.handles.get(netId);
		if (handle === entity) return this.values.get(netId);
		if (handle === 0 && this.values.has(netId)) return this.handles.set(netId, entity), this.values.get(netId);
		this.handles.set(netId, entity);
		let value = this.parseRaw(Entity(entity).state[this.key]);
		return this.values.set(netId, value), value;
	}
	put(entity, value) {
		let netId = NetworkGetNetworkIdFromEntity(entity);
		this.handles.set(netId, entity), this.apply(netId, value);
	}
	getByNetId(netId) {
		return this.values.get(netId);
	}
	forget(netId) {
		this.values.delete(netId), this.handles.delete(netId);
	}
	parseRaw(raw) {
		return raw == null ? void 0 : this.parse(raw);
	}
	prune() {
		for (let netId of this.values.keys()) DoesEntityExist(NetworkGetEntityFromNetworkId(netId)) || this.forget(netId);
	}
}, EntityState = class extends EntityState$1 {
	set(entity, value) {
		DoesEntityExist(entity) && (Entity(entity).state.set(this.key, value ?? null, !0), this.put(entity, value));
	}
};
resourceExport(CORE.resource), resourceExport(CORE.resource);
// resource/common/locale.ts
const Locale = createLocale();
GetCurrentResourceName(), IsDuplicityVersion();
// resource/common/mechanic.ts
const EVENTS = {
	buy: "ai-mechanic:buy",
	repair: "ai-mechanic:repair",
	stash: "ai-mechanic:stash",
	wash: "ai-mechanic:wash",
	kitFinish: "ai-mechanic:kitFinish",
	kitStart: "ai-mechanic:client:kitStart",
	fix: "ai-mechanic:client:fix"
}, point = (v) => {
	let p = record(v);
	return {
		x: num(p.x, 0),
		y: num(p.y, 0),
		z: num(p.z, 0)
	};
};
function readSettings(raw) {
	let v = record(raw), accounts = Array.isArray(v.accounts) ? v.accounts.filter((a) => typeof a == "string") : [];
	return {
		accounts: accounts.length > 0 ? accounts : ["cash", "bank"],
		repairPoint: num(v.repairPoint, 2),
		performance: int$1(v.performance, 2500, 0),
		turbo: int$1(v.turbo, 15e3, 0),
		xenon: int$1(v.xenon, 2e3, 0),
		cosmetic: int$1(v.cosmetic, 750, 0),
		wheels: int$1(v.wheels, 1500, 0),
		paint: int$1(v.paint, 1e3, 0),
		tint: int$1(v.tint, 500, 0),
		plate: int$1(v.plate, 300, 0),
		washPrice: int$1(v.washPrice, 20, 0),
		washSeconds: int$1(v.washSeconds, 6, 1, 60),
		kitEngine: int$1(v.kitEngine, 750, 100, 1e3),
		kitSeconds: int$1(v.kitSeconds, 10, 1, 60)
	};
}
function readShops(raw) {
	let out = new Map();
	for (let [id, value] of Object.entries(record(raw))) {
		let v = record(value), stash = point(v.stash);
		out.set(id, {
			ped: readPlacePed(v.ped),
			id,
			label: str(v.label, id, 48),
			job: str(v.job, "", 32),
			coords: point(v.coords),
			radius: num(v.radius, 8),
			blip: bool(v.blip, !0),
			repair: bool(v.repair, !0),
			tuning: bool(v.tuning, !0),
			multiplier: num(v.multiplier, 1),
			stash: stash.x === 0 && stash.y === 0 ? null : stash
		});
	}
	return out;
}
function readWashes(raw) {
	return Object.entries(record(raw)).map(([id, value]) => {
		let v = record(value);
		return {
			id,
			label: str(v.label, id, 48),
			coords: point(v.coords)
		};
	});
}
const PERFORMANCE_MODS = [
	11,
	12,
	13,
	15,
	16
], COSMETIC_MODS = [
	0,
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	14,
	25,
	26,
	27,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	37,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	46,
	48
], TOGGLE_MODS = [18, 22], PAINTS = [
	0,
	1,
	4,
	112,
	27,
	30,
	38,
	89,
	92,
	53,
	64,
	70,
	145,
	135,
	96,
	158,
	120
], isInt = (v, min, max) => typeof v == "number" && Number.isInteger(v) && v >= min && v <= max, MOD_TYPES = new Set([
	...PERFORMANCE_MODS,
	...COSMETIC_MODS,
	...TOGGLE_MODS
]);
function toChange(v) {
	let c = record(v);
	switch (c.kind) {
		case "mod": return isInt(c.type, 0, 48) && MOD_TYPES.has(c.type) && isInt(c.index, -1, 250) ? {
			kind: "mod",
			type: c.type,
			index: c.index
		} : null;
		case "wheels": return isInt(c.wheelType, 0, 12) && isInt(c.index, -1, 250) ? {
			kind: "wheels",
			wheelType: c.wheelType,
			index: c.index
		} : null;
		case "paint": return (c.slot === 0 || c.slot === 1) && isInt(c.color, 0, 160) && PAINTS.includes(c.color) ? {
			kind: "paint",
			slot: c.slot,
			color: c.color
		} : null;
		case "tint": return isInt(c.value, 0, 6) ? {
			kind: "tint",
			value: c.value
		} : null;
		case "plate": return isInt(c.value, 0, 5) ? {
			kind: "plate",
			value: c.value
		} : null;
		default: return null;
	}
}
function priceOf(change, s) {
	switch (change.kind) {
		case "mod": return change.index < 0 ? 0 : change.type === 18 ? s.turbo : change.type === 22 ? s.xenon : PERFORMANCE_MODS.includes(change.type) ? s.performance * (change.index + 1) : s.cosmetic;
		case "wheels": return change.index < 0 ? 0 : s.wheels;
		case "paint": return s.paint;
		case "tint": return change.value === 0 ? 0 : s.tint;
		case "plate": return s.plate;
		default: return change;
	}
}
function applyChange(props, change) {
	let next = {
		...props,
		mods: { ...props.mods },
		colors: [...props.colors]
	};
	switch (change.kind) {
		case "mod":
			next.mods[change.type] = TOGGLE_MODS.includes(change.type) ? +(change.index >= 0) : change.index;
			break;
		case "wheels":
			next.wheelType = change.wheelType, next.mods[23] = change.index;
			break;
		case "paint":
			next.colors[change.slot] = change.color, change.slot === 0 ? next.customPrimary = null : next.customSecondary = null;
			break;
		case "tint":
			next.windowTint = change.value;
			break;
		case "plate": next.plateIndex = change.value;
	}
	return next;
}
// resource/server/schema.ts
const int = (min, max) => ({
	type: "number",
	min,
	max,
	integer: !0
}), mechanicSchema = {
	title: "ADMIN_TITLE",
	icon: "wrench",
	files: {
		settings: {
			kind: "settings",
			sync: "all",
			sections: {
				accounts: {
					type: "names",
					lookup: "account",
					max: 5,
					itemMax: 32,
					pattern: "^[a-z0-9_]{2,32}$"
				},
				repairPoint: {
					type: "number",
					min: 0,
					max: 100
				},
				performance: int(0, 1e6),
				turbo: int(0, 1e6),
				xenon: int(0, 1e6),
				cosmetic: int(0, 1e6),
				wheels: int(0, 1e6),
				paint: int(0, 1e6),
				tint: int(0, 1e6),
				plate: int(0, 1e6),
				washPrice: int(0, 1e5),
				washSeconds: int(1, 60),
				kitEngine: int(100, 1e3),
				kitSeconds: int(1, 60)
			}
		},
		shops: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				job: "",
				coords: {
					x: 0,
					y: 0,
					z: 0
				},
				radius: 8,
				blip: !0,
				repair: !0,
				tuning: !0,
				multiplier: 1,
				stash: {
					x: 0,
					y: 0,
					z: 0
				}
			},
			sections: {
				ped: PLACE_PED_SPEC,
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				job: {
					type: "text",
					lookup: "job",
					min: 0,
					max: 32
				},
				coords: { type: "vec3" },
				radius: {
					type: "number",
					min: 2,
					max: 40
				},
				blip: { type: "bool" },
				repair: { type: "bool" },
				tuning: { type: "bool" },
				multiplier: {
					type: "number",
					min: 0,
					max: 10
				},
				stash: { type: "vec3" }
			}
		},
		washes: {
			kind: "records",
			sync: "all",
			labelPath: "label",
			newRecord: {
				label: "",
				coords: {
					x: 0,
					y: 0,
					z: 0
				}
			},
			sections: {
				label: {
					type: "text",
					min: 1,
					max: 48
				},
				coords: { type: "vec3" }
			}
		}
	},
	tabs: [
		{
			id: "shops",
			file: "shops",
			icon: "wrench",
			label: "ADMIN_TAB_SHOPS",
			desc: "ADMIN_TAB_SHOPS_DESC",
			listSub: "job",
			createLabel: "ADMIN_NEW_SHOP",
			deleteLabel: "ADMIN_DELETE_SHOP",
			deleteDesc: "ADMIN_DELETE_SHOP_DESC",
			cards: [
				{
					icon: "wrench",
					title: "ADMIN_C_SHOP",
					desc: "ADMIN_C_SHOP_DESC",
					fields: [
						{
							widget: "text",
							path: "label",
							suggest: { from: "coords" },
							label: "ADMIN_F_LABEL",
							placeholder: "ADMIN_P_LABEL"
						},
						{
							widget: "point",
							path: "coords",
							label: "ADMIN_F_COORDS",
							hint: "ADMIN_H_COORDS",
							ground: !0
						},
						{
							widget: "number",
							path: "radius",
							label: "ADMIN_F_RADIUS",
							hint: "ADMIN_H_RADIUS",
							min: 2,
							max: 40,
							unit: "m"
						},
						{
							widget: "switch",
							path: "blip",
							label: "ADMIN_F_BLIP"
						},
						{
							widget: "switch",
							path: "repair",
							label: "ADMIN_F_REPAIR",
							hint: "ADMIN_H_REPAIR"
						},
						{
							widget: "switch",
							path: "tuning",
							label: "ADMIN_F_TUNING",
							hint: "ADMIN_H_TUNING"
						},
						{
							widget: "number",
							path: "multiplier",
							label: "ADMIN_F_MULTIPLIER",
							hint: "ADMIN_H_MULTIPLIER",
							min: 0,
							max: 10,
							step: .05,
							unit: "x"
						}
					]
				},
				{
					icon: "briefcase",
					title: "ADMIN_C_JOB",
					desc: "ADMIN_C_JOB_DESC",
					fields: [{
						widget: "text",
						lookup: "job",
						path: "job",
						label: "ADMIN_F_JOB",
						hint: "ADMIN_H_JOB",
						placeholder: "ADMIN_P_JOB"
					}, {
						widget: "point",
						path: "stash",
						label: "ADMIN_F_STASH",
						hint: "ADMIN_H_STASH",
						ground: !0
					}]
				},
				{
					icon: "user",
					title: "ADMIN_C_PED",
					desc: "ADMIN_C_PED_DESC",
					fields: placePedFields()
				}
			]
		},
		{
			id: "washes",
			file: "washes",
			icon: "droplet",
			label: "ADMIN_TAB_WASHES",
			desc: "ADMIN_TAB_WASHES_DESC",
			createLabel: "ADMIN_NEW_WASH",
			deleteLabel: "ADMIN_DELETE_WASH",
			cards: [{
				icon: "droplet",
				title: "ADMIN_C_WASH",
				desc: "ADMIN_C_WASH_DESC",
				fields: [{
					widget: "text",
					path: "label",
					suggest: { from: "coords" },
					label: "ADMIN_F_LABEL",
					placeholder: "ADMIN_P_WASH_LABEL"
				}, {
					widget: "point",
					path: "coords",
					label: "ADMIN_F_COORDS",
					hint: "ADMIN_H_WASH_COORDS",
					ground: !0
				}]
			}]
		},
		{
			id: "settings",
			file: "settings",
			icon: "sliders",
			label: "ADMIN_TAB_SETTINGS",
			desc: "ADMIN_TAB_SETTINGS_DESC",
			cards: [
				{
					icon: "money-bill-wave",
					title: "ADMIN_C_PRICES",
					desc: "ADMIN_C_PRICES_DESC",
					fields: [
						{
							widget: "tags",
							lookup: "account",
							path: "accounts",
							label: "ADMIN_F_ACCOUNTS",
							hint: "ADMIN_H_ACCOUNTS",
							placeholder: "ADMIN_P_ACCOUNTS"
						},
						{
							widget: "number",
							path: "repairPoint",
							label: "ADMIN_F_REPAIR_POINT",
							hint: "ADMIN_H_REPAIR_POINT",
							min: 0,
							max: 100,
							step: .1,
							unit: "$"
						},
						{
							widget: "number",
							path: "performance",
							label: "ADMIN_F_PERFORMANCE",
							hint: "ADMIN_H_PERFORMANCE",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "turbo",
							label: "ADMIN_F_TURBO",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "xenon",
							label: "ADMIN_F_XENON",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "cosmetic",
							label: "ADMIN_F_COSMETIC",
							hint: "ADMIN_H_COSMETIC",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "wheels",
							label: "ADMIN_F_WHEELS",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "paint",
							label: "ADMIN_F_PAINT",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "tint",
							label: "ADMIN_F_TINT",
							min: 0,
							max: 1e6,
							unit: "$"
						},
						{
							widget: "number",
							path: "plate",
							label: "ADMIN_F_PLATE",
							min: 0,
							max: 1e6,
							unit: "$"
						}
					]
				},
				{
					icon: "droplet",
					title: "ADMIN_C_WASHING",
					desc: "ADMIN_C_WASHING_DESC",
					fields: [{
						widget: "number",
						path: "washPrice",
						label: "ADMIN_F_WASH_PRICE",
						min: 0,
						max: 1e5,
						unit: "$"
					}, {
						widget: "number",
						path: "washSeconds",
						label: "ADMIN_F_WASH_SECONDS",
						min: 1,
						max: 60,
						unit: "s"
					}]
				},
				{
					icon: "toolbox",
					title: "ADMIN_C_KIT",
					desc: "ADMIN_C_KIT_DESC",
					fields: [{
						widget: "number",
						path: "kitEngine",
						label: "ADMIN_F_KIT_ENGINE",
						hint: "ADMIN_H_KIT_ENGINE",
						min: 100,
						max: 1e3
					}, {
						widget: "number",
						path: "kitSeconds",
						label: "ADMIN_F_KIT_SECONDS",
						min: 1,
						max: 60,
						unit: "s"
					}]
				}
			]
		}
	]
}, core = resourceExport("ai-core"), panel = new AdminPanel(mechanicSchema), content = {
	settings: readSettings(panel.get("settings")),
	shops: readShops(panel.get("shops")),
	washes: readWashes(panel.get("washes"))
};
panel.onChange("settings", () => content.settings = readSettings(panel.get("settings"))), panel.onChange("shops", () => content.shops = readShops(panel.get("shops"))), panel.onChange("washes", () => content.washes = readWashes(panel.get("washes")));
const fail = (error) => ({
	ok: !1,
	error
});
function pos(source) {
	let [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
	return {
		x,
		y,
		z
	};
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function shopAt(source, feature) {
	let p = pos(source);
	for (let shop of content.shops.values()) if (shop[feature] && distance(p, shop.coords) <= shop.radius + 2) return shop;
	return null;
}
const canUse = (source, shop) => !shop.job || core.GetDutyJob(source) === shop.job;
function drivenVehicle(source, netId) {
	let vehicle = NetworkGetEntityFromNetworkId(netId);
	return !vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2 ? null : GetPedInVehicleSeat(vehicle, -1) === GetPlayerPed(String(source)) ? vehicle : null;
}
function pay(source, shop, amount, reason) {
	return amount <= 0 ? !0 : shop?.job ? core.RemoveSharedMoney("job", shop.job, "bank", amount, reason) : content.settings.accounts.some((a) => core.RemoveMoney(source, a, amount, reason));
}
const ownedId = (vehicle) => optionalExport("ai-vehicles")?.GetVehicleIdByEntity(vehicle) ?? null, stashName = (shopId) => `mechanic_${shopId}`;
function registerStashes() {
	for (let shop of content.shops.values()) shop.job && shop.stash && inventory.registerStash(stashName(shop.id), shop.label, 50, 25e4, [shop.job]);
}
onClientCallback(EVENTS.stash, { args: ([id]) => asArgs(typeof id == "string" ? id : null) }, (source, id) => {
	let shop = content.shops.get(id);
	return !shop?.job || !shop.stash ? fail("MECH_ERR_FAR") : canUse(source, shop) ? distance(pos(source), shop.stash) > 3 ? fail("MECH_ERR_FAR") : inventory.openInventory(source, stashName(shop.id)) ? { ok: !0 } : fail("MECH_ERR_FAR") : fail("MECH_ERR_JOB");
});
const kits = new Map();
let nextToken = 0;
function useKit(source) {
	let ped = GetPlayerPed(String(source));
	if (GetVehiclePedIsIn(ped, !1)) return notify(source, Locale("MECH_KIT_OUTSIDE"), "warning"), !1;
	let p = pos(source), vehicle = GetAllVehicles().find((v) => {
		let [x = 0, y = 0, z = 0] = GetEntityCoords(v);
		return distance(p, {
			x,
			y,
			z
		}) <= 4;
	});
	if (vehicle === void 0) return notify(source, Locale("MECH_KIT_NO_VEHICLE"), "warning"), !1;
	if (GetVehicleEngineHealth(vehicle) >= content.settings.kitEngine) return notify(source, Locale("MECH_KIT_NOT_NEEDED"), "info"), !1;
	let token = ++nextToken;
	return kits.set(source, {
		token,
		vehicle,
		startedAt: Date.now(),
		seconds: content.settings.kitSeconds
	}), emitNet(EVENTS.kitStart, source, token, content.settings.kitSeconds, NetworkGetNetworkIdFromEntity(vehicle)), !1;
}
onClientCallback(EVENTS.kitFinish, {
	args: ([token]) => asArgs(typeof token == "number" ? token : null),
	lock: !0
}, (source, token) => {
	let kit = kits.get(source);
	if (!kit || kit.token !== token || (kits.delete(source), Date.now() - kit.startedAt < kit.seconds * 800 || !DoesEntityExist(kit.vehicle))) return fail("MECH_ERR_FAR");
	let [x = 0, y = 0, z = 0] = GetEntityCoords(kit.vehicle);
	if (distance(pos(source), {
		x,
		y,
		z
	}) > 5 || !inventory.removeItem(source, "repairkit", 1)) return fail("MECH_ERR_FAR");
	let engine = content.settings.kitEngine, owner = NetworkGetEntityOwner(kit.vehicle);
	owner > 0 && emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(kit.vehicle), engine);
	let id = ownedId(kit.vehicle);
	return id !== null && optionalExport("ai-vehicles")?.SaveVehicle(id, { engine }), notify(source, Locale("MECH_KIT_DONE"), "success"), aiLog("repairs", "repair kit", { source }), { ok: !0 };
}), inventory.registerUsableItem("repairkit", (source) => useKit(source)), registerStashes(), panel.onChange("shops", registerStashes), on("playerDropped", () => kits.delete(Number(globalThis.source)));
// resource/server/index.ts
const propsState = new EntityState(VEHICLE_BAGS.props, (v) => toVehicleProps(v) ?? void 0);
aiLogChannels({
	tuning: { active: !1 },
	repairs: { active: !1 }
});
const netIdOk = (v) => typeof v == "number" && Number.isInteger(v) && v > 0;
onClientCallback(EVENTS.buy, {
	args: ([netId, raw, base]) => {
		let change = toChange(raw);
		return netIdOk(netId) && change ? [
			netId,
			change,
			base
		] : null;
	},
	lock: !0
}, (source, netId, change, base) => {
	let shop = shopAt(source, "tuning");
	if (!shop) return fail("MECH_ERR_FAR");
	if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
	let vehicle = drivenVehicle(source, netId);
	if (vehicle === null) return fail("MECH_ERR_DRIVER");
	let current = propsState.get(vehicle) ?? toVehicleProps(base);
	if (!current || current.model !== GetEntityModel(vehicle)) return fail("MECH_ERR_DRIVER");
	let price = Math.round(priceOf(change, content.settings) * shop.multiplier);
	if (!pay(source, shop, price, `tuning:${shop.id}`)) return fail("MECH_ERR_MONEY");
	let next = {
		...applyChange(current, change),
		plate: GetVehicleNumberPlateText(vehicle),
		engineHealth: GetVehicleEngineHealth(vehicle),
		bodyHealth: GetVehicleBodyHealth(vehicle),
		dirt: GetVehicleDirtLevel(vehicle)
	};
	propsState.set(vehicle, next);
	let id = ownedId(vehicle);
	return id !== null && optionalExport("ai-vehicles")?.SaveVehicle(id, { props: next }), price > 0 && notify(source, Locale("MECH_PAID", price), "success", 2500), aiLog("tuning", `bought ${change.kind}`, {
		source,
		metadata: {
			shop: shop.id,
			price,
			change
		}
	}), { ok: !0 };
});
function fixOn(vehicle, engine) {
	let owner = NetworkGetEntityOwner(vehicle);
	owner > 0 && emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), engine);
}
onClientCallback(EVENTS.repair, {
	args: ([netId]) => asArgs(netIdOk(netId) ? netId : null),
	lock: !0
}, (source, netId) => {
	let shop = shopAt(source, "repair");
	if (!shop) return fail("MECH_ERR_FAR");
	if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
	let vehicle = drivenVehicle(source, netId);
	if (vehicle === null) return fail("MECH_ERR_DRIVER");
	let damage = Math.max(0, 1e3 - GetVehicleEngineHealth(vehicle)) + Math.max(0, 1e3 - GetVehicleBodyHealth(vehicle));
	if (damage < 1) return fail("MECH_ERR_NOT_DAMAGED");
	let price = Math.round(damage * content.settings.repairPoint * shop.multiplier);
	if (!pay(source, shop, price, `repair:${shop.id}`)) return fail("MECH_ERR_MONEY");
	fixOn(vehicle, null);
	let bag = propsState.get(vehicle);
	bag && propsState.set(vehicle, {
		...bag,
		engineHealth: 1e3,
		bodyHealth: 1e3
	});
	let id = ownedId(vehicle);
	return id !== null && optionalExport("ai-vehicles")?.SaveVehicle(id, {
		engine: 1e3,
		body: 1e3
	}), notify(source, Locale("MECH_REPAIRED", price), "success"), aiLog("repairs", "shop repair", {
		source,
		metadata: {
			shop: shop.id,
			price
		}
	}), { ok: !0 };
});
const washing = new Set();
onClientCallback(EVENTS.wash, {
	args: ([netId]) => asArgs(netIdOk(netId) ? netId : null),
	lock: !0
}, (source, netId) => {
	if (washing.has(source)) return fail("MECH_ERR_BUSY");
	let p = pos(source);
	if (!content.washes.some((w) => distance(p, w.coords) <= 10)) return fail("MECH_ERR_FAR");
	let vehicle = drivenVehicle(source, netId);
	return vehicle === null ? fail("MECH_ERR_DRIVER") : GetVehicleDirtLevel(vehicle) < .1 ? fail("MECH_ERR_CLEAN") : pay(source, null, content.settings.washPrice, "carwash") ? (washing.add(source), setTimeout(() => {
		if (washing.delete(source), !DoesEntityExist(vehicle)) return;
		SetVehicleDirtLevel(vehicle, 0);
		let owner = NetworkGetEntityOwner(vehicle);
		owner > 0 && emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), -1);
	}, content.settings.washSeconds * 1e3), {
		ok: !0,
		seconds: content.settings.washSeconds
	}) : fail("MECH_ERR_MONEY");
}), on("playerDropped", () => washing.delete(Number(globalThis.source)));
