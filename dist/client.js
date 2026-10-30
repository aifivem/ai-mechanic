/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
/**
	* Callback wire format, the same on both sides:
	*   request  `aicore:cb:<name>`              (callerResource, id, ...args)
	*   response `aicore:cbr:<callerResource>`   (id, ok, result)
	* The response goes only to the resource that asked, so two resources never see each other's replies.
	*/
	const requestEvent = (name) => `aicore:cb:${name}`;
	const responseEvent = (resource) => `aicore:cbr:${resource}`;
	/** Default time a caller waits for an answer before the promise rejects. */
	const DEFAULT_CALLBACK_TIMEOUT = 3e4;

// ../../../packages/lib/src/shared/wait.ts
/**
	* Resolves with the first value `check` returns that is not undefined, checking once per tick.
	* Rejects after `timeoutMs` (default 10 s); pass `false` to wait forever.
	* Return `cond || undefined` from `check` to wait for a truthy condition.
	*/
	function waitFor(check, timeoutMs = 1e4) {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = () => {
				const value = check();
				if (value !== void 0) return resolve(value);
				if (timeoutMs !== false && Date.now() - started > timeoutMs) return reject(/* @__PURE__ */ new Error(`waitFor timed out after ${timeoutMs} ms`));
				setTimeout(poll, 0);
			};
			poll();
		});
	}

// ../../../packages/lib/src/shared/read.ts
/** Small readers for panel content (`data/*.json`): every one returns the fallback when the value is missing or wrong. */
	/** A finite number clamped to `[min, max]`, else the fallback. */
	function num(value, fallback, min = -Infinity, max = Infinity) {
		return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
	}
	/** `num` rounded to an integer. */
	function int(value, fallback, min = -Infinity, max = Infinity) {
		return Math.round(num(value, fallback, min, max));
	}
	/** A boolean, else the fallback. */
	function bool(value, fallback) {
		return typeof value === "boolean" ? value : fallback;
	}
	/** A trimmed non-empty string cut to `max`, else the fallback. */
	function str(value, fallback, max = 64) {
		return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
	}
	/** The value as a plain object, or an empty one. */
	function record(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
	}

// ../../../packages/lib/src/shared/index.ts
	function isRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	/** Fills `{0}`, `{1}`... with the arguments by position (a translation may reorder or repeat them). */
	function formatText(template, args) {
		return template.replace(/\{(\d+)\}/g, (match, index) => {
			const value = args[Number(index)];
			return value === void 0 ? match : String(value);
		});
	}
	/** Console output prefixed with the resource name, so server logs show where a line came from. */
	function createLogger(resource) {
		const prefix = `[${resource}]`;
		return {
			info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
			warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
			error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
		};
	}

// ../../../packages/lib/src/client/netEvent.ts
	const log$4 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);
	function onServerEvent(name, first, second) {
		const [handler, parse] = typeof first === "function" ? [first, null] : [second, first.args];
		onNet(name, (...raw) => {
			if (!fromServer() || !handler) return;
			const args = parse ? parse(raw) : [];
			if (!args) return log$4.warn(`event ${name} from the server had invalid arguments`);
			Promise.resolve().then(() => handler(...args)).catch((error) => log$4.error(`event ${name} failed`, error));
		});
	}

// ../../../packages/lib/src/client/callback.ts
	const resource$1 = GetCurrentResourceName();
	const log$3 = createLogger(resource$1);
	const pending = /* @__PURE__ */ new Map();
	let nextId$1 = 0;
	onNet(responseEvent(resource$1), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});
	/**
	* Asks the server (`onClientCallback(name, ...)` there) and resolves with its answer. The answer is unknown:
	* parse it. Rejects when the server reports an error or does not answer within `timeoutMs`.
	*/
	function triggerServerCallback(name, args = [], timeoutMs = DEFAULT_CALLBACK_TIMEOUT) {
		const id = ++nextId$1;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(/* @__PURE__ */ new Error(`server callback ${name} timed out`));
			}, timeoutMs);
			pending.set(id, {
				resolve,
				reject,
				timer
			});
			emitNet(requestEvent(name), resource$1, id, ...args);
		});
	}

// ../../../packages/shared/src/core.ts
/** Names owned by ai-core that other resources, the bridges and the build step use. */
	const CORE = {
		resource: "ai-core",
		/** Client -> server: (resource: string, text: string). Sent by the reporter every client bundle carries. */
		clientErrorEvent: "ai-core:clientError",
		/** (src, character: CharacterInfo) after a character is loaded and spawned. */
		playerLoadedEvent: "ai-core:playerLoaded",
		/** (src, charId, reason: UnloadReason) before a character's state is dropped. */
		playerUnloadedEvent: "ai-core:playerUnloaded",
		/** (src, account: string, balance: number, delta: number, reason: string) */
		moneyChangedEvent: "ai-core:moneyChanged",
		/** (src, jobs: JobMembership[]) */
		jobsChangedEvent: "ai-core:jobsChanged",
		/** (src, job: string | null) */
		dutyChangedEvent: "ai-core:dutyChanged",
		/** (src, gangs: GangMembership[]) */
		gangsChangedEvent: "ai-core:gangsChanged",
		/** (src, gang: string | null) */
		activeGangChangedEvent: "ai-core:activeGangChanged",
		/** (src, charIds: number[]) each time a player's character screen loads; an appearance resource answers with portraits. */
		characterScreenEvent: "ai-core:characterScreen",
		/** (resource: string | null) the inventory behind ai-core's inventory layer changed (the bridge drops its item cache). */
		inventoryChangedEvent: "ai-core:inventoryChanged",
		/** (src, name: string, status: Record<string, number> | null) a player used an item; status = the needs it gives, from inventories that define them. */
		itemUsedEvent: "ai-core:itemUsed",
		/** (src, killer: number | null, weaponHash: number) a player with a loaded character died; fired from FXServer's `onPedDeath` (needs `PED_DEATH_STATE_KEY`). */
		playerDiedEvent: "ai-core:playerDied",
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (charId: number) ai-appearance holds this character's look: ai-core dresses its scene ped with `ApplyCharacterAppearance`. */
		clientCharacterLookEvent: "ai-core:client:characterLook",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
		/** Server -> client callback: (model: string) the `CreateVehicleServerSetter` type of a model, null when the game has no such vehicle (ai-core's client answers for every resource, lib `spawnVehicle`). */
		vehicleTypeCallback: "ai-core:vehicleType",
		/** GlobalState: "prompt" | "target", how lib `Points` let players interact (ai-core panel setting). */
		interactionStateKey: "ai:interaction",
		charactersCallback: "ai-core:characters",
		createCharacterCallback: "ai-core:createCharacter",
		deleteCharacterCallback: "ai-core:deleteCharacter",
		selectCharacterCallback: "ai-core:selectCharacter",
		/** Server -> client: (notification: Notification) a notification card on the player's screen. */
		clientNotifyEvent: "ai-core:client:notify",
		/** Server -> client: (spawn: SpawnPoint) puts the loaded character into the world. */
		spawnEvent: "ai-core:client:spawn",
		/** Server -> client: () the character was let go (switch); show the character screen again. */
		openCharactersEvent: "ai-core:client:openCharacters"
	};

// ../../../packages/shared/src/admin.ts
/** Event names of the admin panel (owned by ai-core). */
	const ADMIN = {
		/** ACE every panel action checks: `add_ace group.admin ai.admin allow`. */
		ace: "ai.admin",
		/** Callback: (keybinds: KeybindInfo[] the admin's client knows) -> AdminPanelSnapshot[]. */
		openCallback: "ai-core:admin:open",
		applyCallback: "ai-core:admin:apply",
		closeEvent: "ai-core:admin:close",
		/** Server -> client: () open the panel (the `aiadmin` command, checked on the server). */
		showEvent: "ai-core:admin:show",
		/** Server -> admins with the panel open: (delta: AdminDelta). */
		deltaEvent: "ai-core:admin:delta",
		/** Server -> client of a world (`sync: "all"`) file: (file, key | null, value). Prefixed with the resource name. */
		worldEvent: (resource) => `${resource}:admin:world`,
		/** Callback: () -> { [file]: { key: value } } world records changed since the resource started. */
		worldChangesCallback: (resource) => `${resource}:admin:worldChanges`
	};

// ../../../packages/shared/src/menu.ts
	const MENU_EVENTS = {
		/** Client local: (resource, requestId, itemId | null) the player picked an item or closed the menu. */
		menuResult: "ai-core:client:menuResult",
		/** Client local: (resource, requestId, itemId) the pointer or focus is on an item (previews). */
		menuHover: "ai-core:client:menuHover",
		/** Client local: (resource, requestId, values | null) the player confirmed or closed the input dialog. */
		inputResult: "ai-core:client:inputResult"
	};

// ../../../packages/lib/src/client/adminWorld.ts
/**
	* The client copy of a resource's world panel files (`sync: "all"`): the file FiveM cached at start, then the
	* records changed since start (asked once), then live changes. Never polls.
	*/
	var AdminWorld = class {
		data = /* @__PURE__ */ new Map();
		handlers = /* @__PURE__ */ new Map();
		resource = GetCurrentResourceName();
		/** Resolves once the changes since start are applied (or could not be loaded): the data is current from then on. */
		ready;
		/** `files`: the world files this client mirrors (each must be in the resource's `files`). */
		constructor(files) {
			const log = createLogger(this.resource);
			for (const file of files) {
				const raw = LoadResourceFile(this.resource, `data/${file}.json`);
				try {
					const parsed = raw ? JSON.parse(raw) : {};
					this.data.set(file, isRecord(parsed) ? parsed : {});
				} catch (error) {
					log.error(`data/${file}.json is not valid JSON`, error);
					this.data.set(file, {});
				}
			}
			onServerEvent(ADMIN.worldEvent(this.resource), { args: ([file, key, value]) => typeof file === "string" ? [
				file,
				typeof key === "string" && key !== "" ? key : void 0,
				value
			] : null }, (file, key, value) => this.put(file, key, value));
			this.ready = triggerServerCallback(ADMIN.worldChangesCallback(this.resource)).then((changes) => {
				if (!isRecord(changes)) return;
				for (const [file, records] of Object.entries(changes)) {
					if (!isRecord(records)) continue;
					for (const [key, value] of Object.entries(records)) this.put(file, key === "" ? void 0 : key, value);
				}
			}, (error) => log.error("loading the panel changes since start failed", error));
		}
		/** The current content of a file: the settings object, or `{ key: record }`. Read only; parse what you use. */
		get(file) {
			return this.data.get(file) ?? {};
		}
		onChange(file, handler) {
			this.handlers.set(file, [...this.handlers.get(file) ?? [], handler]);
		}
		put(file, key, value) {
			const data = this.data.get(file);
			if (!data) return;
			if (key === void 0) {
				if (isRecord(value)) this.data.set(file, value);
			} else if (value === null) delete data[key];
			else data[key] = value;
			for (const handler of this.handlers.get(file) ?? []) handler(key, value);
		}
	};

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The weapon in a ped's hand, `false` when unarmed. */
	function readWeapon(ped) {
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return weapon === UNARMED ? false : weapon;
	}
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		return {
			vehicle: vehicle || false,
			seat,
			weapon: readWeapon(ped)
		};
	}
	/**
	* The local player's often read values (ped, player id, server id, vehicle, seat, weapon), like ox_lib's `cache`:
	* read `cache.ped` instead of calling PlayerPedId() in loops. One watcher in ai-core updates every resource through
	* a local event, so no resource polls for these itself. Read only.
	*/
	const ped = PlayerPedId();
	const cache = {
		ped,
		playerId: PlayerId(),
		serverId: GetPlayerServerId(PlayerId()),
		...readPlayerState(ped)
	};
	const handlers = /* @__PURE__ */ new Map();
	const valid = (key, value) => key === "ped" || key === "playerId" || key === "serverId" ? typeof value === "number" : typeof value === "number" || value === false;
	on(CORE.clientCacheEvent, (key, value) => {
		if (typeof key !== "string" || !(key in cache)) return;
		const name = key;
		if (!valid(name, value) || cache[name] === value) return;
		const old = cache[name];
		cache[name] = value;
		for (const handler of handlers.get(name) ?? []) handler(value, old);
	});

// ../../../packages/lib/src/client/zones.ts
/**
	* Zones on this client: inside / outside checks at each zone's own interval, never per frame. Built for any count
	* (measured with 1,000,000 zones): zones sit in a grid of 64 m cells and a check looks only at the player's cell and
	* the zones the player is in.
	*/
	const log$2 = createLogger(GetCurrentResourceName());
	const CELL = 64;
	/** A zone wider than this many cells is kept in one list checked every time instead of in the grid. */
	const MAX_CELLS = 64;
	const cellKey = (cx, cy) => cx + 32768 << 16 | cy + 32768;
	function contains(shape, x, y, z) {
		switch (shape.type) {
			case "sphere": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				const dz = z - shape.center.z;
				return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
			}
			case "cylinder": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				return dx * dx + dy * dy <= shape.radius * shape.radius && Math.abs(z - shape.center.z) <= shape.height;
			}
			case "poly": {
				if (z < shape.minZ || z > shape.maxZ) return false;
				let inside = false;
				const p = shape.points;
				for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
					const a = p[i];
					const b = p[j];
					if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
				}
				return inside;
			}
			default: return shape;
		}
	}
	/** Ground bounding box of a shape: [minX, minY, maxX, maxY]. */
	function bounds(shape) {
		if (shape.type !== "poly") return [
			shape.center.x - shape.radius,
			shape.center.y - shape.radius,
			shape.center.x + shape.radius,
			shape.center.y + shape.radius
		];
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of shape.points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return [
			minX,
			minY,
			maxX,
			maxY
		];
	}
	var Zone = class {
		options;
		inside = false;
		nextCheck = 0;
		interval;
		/** Grid cells the zone is filed under; empty when it is in the large list. */
		cells = [];
		constructor(options) {
			this.options = options;
			this.interval = Math.max(50, options.interval ?? 500);
		}
	};
	/**
	* The zones of one resource. One timer serves them all at the shortest interval any zone asks for; each zone is
	* checked only when its own interval has passed. With no zones the timer stops (an active JS timer costs every frame).
	*/
	var Zones = class {
		zones = /* @__PURE__ */ new Map();
		grid = /* @__PURE__ */ new Map();
		large = /* @__PURE__ */ new Set();
		insideNow = /* @__PURE__ */ new Set();
		/** How many zones use each interval, so the shortest one is found without walking every zone. */
		intervals = /* @__PURE__ */ new Map();
		timer = null;
		period = 0;
		/** Adds (or replaces) a zone. A replaced zone the player was in fires its onExit first. */
		add(id, options) {
			this.remove(id);
			const zone = new Zone(options);
			this.zones.set(id, zone);
			const [minX, minY, maxX, maxY] = bounds(options.shape);
			const x0 = Math.floor(minX / CELL);
			const y0 = Math.floor(minY / CELL);
			const x1 = Math.floor(maxX / CELL);
			const y1 = Math.floor(maxY / CELL);
			if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) this.large.add(zone);
			else for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
				const key = cellKey(cx, cy);
				let cell = this.grid.get(key);
				if (!cell) this.grid.set(key, cell = /* @__PURE__ */ new Set());
				cell.add(zone);
				zone.cells.push(key);
			}
			this.intervals.set(zone.interval, (this.intervals.get(zone.interval) ?? 0) + 1);
			this.schedule();
		}
		remove(id) {
			const zone = this.zones.get(id);
			if (!zone) return;
			this.zones.delete(id);
			this.large.delete(zone);
			for (const key of zone.cells) {
				const cell = this.grid.get(key);
				cell?.delete(zone);
				if (cell?.size === 0) this.grid.delete(key);
			}
			const left = (this.intervals.get(zone.interval) ?? 1) - 1;
			if (left > 0) this.intervals.set(zone.interval, left);
			else this.intervals.delete(zone.interval);
			if (this.insideNow.delete(zone)) this.fire(zone, false);
			this.schedule();
		}
		/** Removes every zone (exits fire for the ones the player is in). */
		clear() {
			const inside = [...this.insideNow];
			this.zones.clear();
			this.grid.clear();
			this.large.clear();
			this.insideNow.clear();
			this.intervals.clear();
			for (const zone of inside) this.fire(zone, false);
			this.schedule();
		}
		isInside(id) {
			return this.zones.get(id)?.inside ?? false;
		}
		get size() {
			return this.zones.size;
		}
		schedule() {
			let period = 0;
			for (const interval of this.intervals.keys()) period = period === 0 ? interval : Math.min(period, interval);
			if (period === this.period) return;
			if (this.timer) clearInterval(this.timer);
			this.timer = period ? setInterval(() => this.check(), period) : null;
			this.period = period;
		}
		check() {
			const now = GetGameTimer();
			const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
			for (const zone of this.insideNow) this.test(zone, now, x, y, z);
			for (const zone of this.large) this.test(zone, now, x, y, z);
			const cell = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
			if (cell) for (const zone of cell) this.test(zone, now, x, y, z);
		}
		test(zone, now, x, y, z) {
			if (now < zone.nextCheck) return;
			zone.nextCheck = now + zone.interval;
			const inside = contains(zone.options.shape, x, y, z);
			if (inside === zone.inside) return;
			if (inside) this.insideNow.add(zone);
			else this.insideNow.delete(zone);
			this.fire(zone, inside);
		}
		fire(zone, inside) {
			zone.inside = inside;
			try {
				if (inside) zone.options.onEnter?.();
				else zone.options.onExit?.();
			} catch (error) {
				log$2.error("zone handler failed", error);
			}
		}
	};

// ../../../packages/lib/src/fivem/exports.ts
/** Typed access to another resource's exports (types come from CitizenExports in @aicore-fivem/shared). */
	function resourceExport(resource) {
		return globalThis.exports[resource];
	}
	/** Whether a resource is running now. */
	function isResourceStarted(resource) {
		return GetResourceState(resource) === "started";
	}
	/** Calls an export of a resource whose exports have no type here (a third-party script); parse the result. */
	function callExport(resource, name, ...args) {
		const fn = Reflect.get(Object(globalThis.exports[resource]), name);
		if (typeof fn !== "function") throw new Error(`${resource} has no export ${name}`);
		return Reflect.apply(fn, void 0, args);
	}

// ../../../packages/lib/src/client/prompt.ts
	const core$3 = resourceExport(CORE.resource);
	/**
	* ai-core's prompt (the "press E" box on the right): this resource shows and hides its own prompts by id; the
	* interaction key is one rebindable keybind in ai-core, so nothing polls keys per frame. Show a prompt on a zone's
	* enter, hide it on exit, act in `onPromptPressed`.
	*/
	function showPrompt(id, text) {
		core$3.ShowPrompt(id, text);
	}
	function hidePrompt(id) {
		core$3.HidePrompt(id);
	}
	/** The player pressed the interaction key while this resource's prompt `id` was the one on top. */
	function onPromptPressed(handler) {
		const resource = GetCurrentResourceName();
		on(CORE.clientPromptPressedEvent, (owner, id) => {
			if (owner === resource && typeof id === "string") handler(id);
		});
	}

// ../../../packages/lib/src/client/blip.ts
	const LABEL = `AI_BLIP_${GetCurrentResourceName()}`;
	AddTextEntry(LABEL, "~a~");
	/** Creates a named blip at a point and returns its handle (`RemoveBlip` it, or use `Blips`). */
	function createBlip(options) {
		const { x, y, z } = options.coords;
		const blip = AddBlipForCoord(x, y, z);
		SetBlipSprite(blip, options.sprite);
		SetBlipColour(blip, options.color);
		SetBlipScale(blip, options.scale ?? .8);
		SetBlipDisplay(blip, options.display ?? 4);
		SetBlipAsShortRange(blip, options.shortRange ?? true);
		if (options.label !== void 0) {
			BeginTextCommandSetBlipName(LABEL);
			AddTextComponentSubstringPlayerName(options.label);
			EndTextCommandSetBlipName(blip);
		}
		return blip;
	}
	/** A script's blips by id: `add` replaces a blip with the same id, `clear` removes them all (a panel rebuild). */
	var Blips = class {
		blips = /* @__PURE__ */ new Map();
		add(id, options) {
			this.remove(id);
			const blip = createBlip(options);
			this.blips.set(id, blip);
			return blip;
		}
		get(id) {
			return this.blips.get(id);
		}
		remove(id) {
			const blip = this.blips.get(id);
			if (blip === void 0) return;
			RemoveBlip(blip);
			this.blips.delete(id);
		}
		clear() {
			for (const blip of this.blips.values()) RemoveBlip(blip);
			this.blips.clear();
		}
	};

// ../../../packages/lib/src/client/streaming.ts
/**
	* Loads a model and resolves with its hash. Rejects when the model does not exist or does not load in time.
	* Call `SetModelAsNoLongerNeeded(hash)` once the entity is created.
	*/
	async function requestModel(model, timeoutMs = 1e4) {
		const hash = typeof model === "number" ? model : GetHashKey(model);
		if (!IsModelInCdimage(hash)) throw new Error(`model ${model} does not exist`);
		RequestModel(hash);
		await waitFor(() => HasModelLoaded(hash) || void 0, timeoutMs);
		return hash;
	}
	/** Loads an animation dictionary. Call `RemoveAnimDict(dict)` when it is no longer played. */
	async function requestAnimDict(dict, timeoutMs = 1e4) {
		if (!DoesAnimDictExist(dict)) throw new Error(`anim dict ${dict} does not exist`);
		RequestAnimDict(dict);
		await waitFor(() => HasAnimDictLoaded(dict) || void 0, timeoutMs);
		return dict;
	}

// ../../../packages/lib/src/client/localPed.ts
	const log$1 = createLogger(GetCurrentResourceName());
	/** One zone set for every local ped of this resource: peds exist only while their player is near. */
	const zones = new Zones();
	let nextId = 0;
	/**
	* A ped only this client sees (a shopkeeper, a job NPC): created when the player comes near, deleted when they leave,
	* frozen, invincible and deaf to events. Never networked, so strict entity lockdown does not matter.
	*/
	var LocalPed = class {
		options;
		id = `ped:${++nextId}`;
		handle = 0;
		wanted = false;
		constructor(options) {
			this.options = options;
			const { x, y, z } = options.coords;
			zones.add(this.id, {
				shape: {
					type: "sphere",
					center: {
						x,
						y,
						z
					},
					radius: options.distance ?? 50
				},
				interval: 1e3,
				onEnter: () => void this.spawn(),
				onExit: () => this.despawn()
			});
		}
		/** The ped while it exists, else 0. */
		get entity() {
			return this.handle;
		}
		/** Deletes the ped for good. */
		remove() {
			zones.remove(this.id);
			this.despawn();
		}
		async spawn() {
			this.wanted = true;
			const o = this.options;
			try {
				const hash = await requestModel(o.model);
				if (o.anim) await requestAnimDict(o.anim.dict);
				if (!this.wanted || this.handle) return;
				const { x, y, z, heading } = o.coords;
				const ped = CreatePed(4, hash, x, y, o.ground === false ? z : z - 1, heading, false, false);
				SetModelAsNoLongerNeeded(hash);
				FreezeEntityPosition(ped, true);
				SetEntityInvincible(ped, true);
				SetBlockingOfNonTemporaryEvents(ped, true);
				SetPedCanRagdoll(ped, false);
				if (o.scenario) TaskStartScenarioInPlace(ped, o.scenario, 0, true);
				else if (o.anim) TaskPlayAnim(ped, o.anim.dict, o.anim.clip, 8, 8, -1, 1, 0, false, false, false);
				this.handle = ped;
				o.onSpawn?.(ped);
			} catch (error) {
				log$1.error(`local ped ${o.model} could not be created`, error);
			}
		}
		despawn() {
			this.wanted = false;
			if (!this.handle) return;
			const ped = this.handle;
			this.handle = 0;
			this.options.onDespawn?.(ped);
			DeleteEntity(ped);
		}
	};
	on("onResourceStop", (resource) => {
		if (resource === GetCurrentResourceName()) zones.clear();
	});

// ../../../packages/lib/src/client/point.ts
	const log = createLogger(GetCurrentResourceName());
	const TARGET = "ox_target";
	const target = (name, ...args) => callExport(TARGET, name, ...args);
	/** Prompt mode, or target mode when the owner picked it and a resource answers the ox_target API (ai-target does). */
	const style = () => GlobalState[CORE.interactionStateKey] === "target" && isResourceStarted(TARGET) ? "target" : "prompt";
	const groups = /* @__PURE__ */ new Set();
	const byPrompt = /* @__PURE__ */ new Map();
	let busy = false;
	let nextGroup = 0;
	var Point = class {
		promptId;
		options;
		inside = false;
		ped = null;
		targetZone = null;
		/** The prompt text on screen, null while hidden. */
		shown = null;
		/** The label the target option was registered with. */
		targetLabel = null;
		constructor(promptId, options) {
			this.promptId = promptId;
			this.options = options;
		}
		text() {
			const { label } = this.options;
			if (typeof label === "string") return label;
			try {
				return label();
			} catch (error) {
				log.error("point label failed", error);
				return "";
			}
		}
		allowed() {
			try {
				return this.options.canShow?.() ?? true;
			} catch (error) {
				log.error("point canShow failed", error);
				return false;
			}
		}
		press() {
			if (busy || !this.allowed()) return;
			let result;
			try {
				result = this.options.onPressed();
			} catch (error) {
				return log.error("point onPressed failed", error);
			}
			if (!(result instanceof Promise)) return;
			busy = true;
			result.catch((error) => log.error("point onPressed failed", error)).finally(() => busy = false);
		}
		/** The prompt follows inside + canShow + the current label (prompt mode only). */
		sync(group) {
			const text = (this.options.promptOnly ? "prompt" : group) === "prompt" && this.inside && this.allowed() ? this.text() : null;
			if (text === this.shown) return;
			this.shown = text;
			if (text !== null) showPrompt(this.promptId, text);
			else hidePrompt(this.promptId);
		}
		targetOption() {
			this.targetLabel = this.text();
			return [{
				name: this.promptId,
				label: this.targetLabel,
				icon: this.options.icon,
				distance: this.options.radius ?? 2,
				canInteract: () => this.allowed(),
				onSelect: () => this.press()
			}];
		}
	};
	/**
	* Interaction points of a script (counters, shop doors, NPCs): one object per point instead of zones + prompts +
	* blips + peds by hand. Each point shows as ai-core's prompt (interaction key) or as a target option, as the owner
	* picks in ai-core's panel (Interaction); the same `onPressed` runs either way. Rebuild with `clear()` + `add()` when
	* the panel changes the points; call `refresh()` when what `canShow` reads changes (job, duty, vehicle).
	*/
	var Points = class {
		zones = new Zones();
		blips = new Blips();
		points = /* @__PURE__ */ new Map();
		prefix = `pt${++nextGroup}:`;
		constructor() {
			groups.add(this);
		}
		/** Adds (or replaces) a point. */
		add(id, options) {
			this.remove(id);
			const point = new Point(this.prefix + id, options);
			this.points.set(id, point);
			byPrompt.set(point.promptId, point);
			if (options.ped) {
				const ped = options.ped;
				point.ped = new LocalPed({
					...ped,
					coords: ped.coords ?? {
						...options.coords,
						heading: 0
					},
					onSpawn: (entity) => style() === "target" && !options.promptOnly && target("addLocalEntity", entity, point.targetOption()),
					onDespawn: (entity) => style() === "target" && !options.promptOnly && target("removeLocalEntity", entity, point.promptId)
				});
			}
			if (options.blip) this.blips.add(id, {
				...options.blip,
				coords: options.blip.coords ?? options.coords
			});
			this.zones.add(id, {
				shape: options.height !== void 0 ? {
					type: "cylinder",
					center: options.coords,
					radius: options.radius ?? 2,
					height: options.height
				} : {
					type: "sphere",
					center: options.coords,
					radius: options.radius ?? 2
				},
				interval: options.interval,
				onEnter: () => {
					point.inside = true;
					point.sync(style());
					options.onEnter?.();
				},
				onExit: () => {
					point.inside = false;
					point.sync(style());
					options.onExit?.();
				}
			});
			this.attach(point, style());
		}
		remove(id) {
			const point = this.points.get(id);
			if (!point) return;
			this.zones.remove(id);
			this.detach(point);
			point.sync("target");
			point.ped?.remove();
			this.blips.remove(id);
			byPrompt.delete(point.promptId);
			this.points.delete(id);
		}
		clear() {
			for (const id of [...this.points.keys()]) this.remove(id);
		}
		/**
		* Checks `canShow` and a function `label` again (prompt mode; targets ask `canShow` when opened and get a changed
		* label re-registered). Inside a state bag change handler the new value is not readable yet: call it in a `setTimeout`.
		*/
		refresh(id) {
			const mode = style();
			const one = id !== void 0 ? this.points.get(id) : void 0;
			for (const point of one ? [one] : id === void 0 ? this.points.values() : []) {
				point.sync(mode);
				if (mode === "target" && !point.options.promptOnly && typeof point.options.label === "function" && point.targetLabel !== point.text()) {
					this.detach(point);
					this.attach(point, mode);
				}
			}
		}
		isInside(id) {
			return this.points.get(id)?.inside ?? false;
		}
		/** Puts every point on the current interaction style (style switch, target resource restart). */
		restyle() {
			const mode = style();
			for (const point of this.points.values()) {
				this.detach(point);
				this.attach(point, mode);
				point.sync(mode);
			}
		}
		attach(point, mode) {
			if (mode !== "target" || point.options.promptOnly) return;
			const ped = point.ped?.entity;
			if (point.ped) {
				if (ped) target("addLocalEntity", ped, point.targetOption());
				return;
			}
			point.targetZone = target("addSphereZone", {
				coords: point.options.coords,
				radius: point.options.targetRadius ?? 1,
				options: point.targetOption()
			});
		}
		detach(point) {
			if (!isResourceStarted(TARGET)) return void (point.targetZone = null);
			if (point.targetZone != null) target("removeZone", point.targetZone);
			point.targetZone = null;
			const ped = point.ped?.entity;
			if (ped) target("removeLocalEntity", ped, point.promptId);
		}
	};
	onPromptPressed((id) => byPrompt.get(id)?.press());
	const restyleAll = () => {
		for (const group of groups) group.restyle();
	};
	AddStateBagChangeHandler(CORE.interactionStateKey, "global", () => setTimeout(restyleAll, 0));
	for (const event of ["onClientResourceStart", "onClientResourceStop"]) on(event, (resource) => {
		if (resource === TARGET || resource === "ai-target") setTimeout(restyleAll, 0);
	});

// ../../../packages/lib/src/client/notify.ts
	const core$2 = resourceExport(CORE.resource);
	/** Shows a notification card on this player's screen (ai-core draws it); `text` is already translated. */
	function notify(text, kind = "info", duration) {
		core$2.Notify({
			text,
			kind,
			duration
		});
	}
	/**
	* Runs a timed action with ai-core's progress bar and an optional animation; resolves true when it ran out, false
	* when cancelled (death, getting into a vehicle). Checks ten times a second, nothing per frame.
	*/
	async function progress(options) {
		const ped = cache.ped;
		if (options.anim) {
			await requestAnimDict(options.anim.dict);
			TaskPlayAnim(ped, options.anim.dict, options.anim.clip, 3, 3, options.duration, options.anim.flag ?? 49, 0, false, false, false);
		}
		core$2.ShowProgress(options.label, options.duration);
		const end = GetGameTimer() + options.duration;
		const done = await new Promise((resolve) => {
			const timer = setInterval(() => {
				const cancelled = IsEntityDead(cache.ped) || !options.allowVehicle && cache.vehicle !== false;
				if (!cancelled && GetGameTimer() < end) return;
				clearInterval(timer);
				resolve(!cancelled);
			}, 100);
		});
		if (options.anim) StopAnimTask(ped, options.anim.dict, options.anim.clip, 1);
		core$2.HideProgress();
		return done;
	}

// ../../../packages/lib/src/client/menu.ts
	const core$1 = resourceExport(CORE.resource);
	/** Menus and input dialogs this resource asked ai-core for, waiting for the player's answer. */
	var Requests = class {
		resource = GetCurrentResourceName();
		waiting = /* @__PURE__ */ new Map();
		hovers = /* @__PURE__ */ new Map();
		nextId = 0;
		constructor() {
			const answer = (owner, id, value) => {
				if (owner !== this.resource || typeof id !== "number") return;
				this.waiting.get(id)?.(value);
				this.waiting.delete(id);
				this.hovers.delete(id);
			};
			on(MENU_EVENTS.menuHover, (owner, id, item) => {
				if (owner === this.resource && typeof id === "number" && typeof item === "string") this.hovers.get(id)?.(item);
			});
			on(MENU_EVENTS.menuResult, answer);
			on(MENU_EVENTS.inputResult, answer);
		}
		ask(open, read, onHover) {
			const id = ++this.nextId;
			this.waiting.set(id, read);
			if (onHover) this.hovers.set(id, onHover);
			open(id);
		}
	};
	const requests = new Requests();
	/**
	* Shows ai-core's menu and resolves with the picked item id, or null when the player closed it; `onHover` hears the
	* item under the pointer or focus (live previews).
	*/
	function menu(request, onHover) {
		return new Promise((resolve) => requests.ask((id) => core$1.OpenMenu(id, request), (value) => resolve(typeof value === "string" ? value : null), onHover));
	}

// ../../../packages/lib/src/client/inventory.ts
	const core = resourceExport(CORE.resource);

// ../../../packages/lib/src/client/vehicleProps.ts
	const MOD_TYPES$1 = Array.from({ length: 50 }, (_, i) => i);
	const TOGGLE_MODS$1 = [
		17,
		18,
		19,
		20,
		21,
		22
	];
	/** Reads every property of a vehicle the local client can see. */
	function getVehicleProps(vehicle) {
		const [primary, secondary] = GetVehicleColours(vehicle);
		const [pearl, wheel] = GetVehicleExtraColours(vehicle);
		const mods = {};
		for (const type of MOD_TYPES$1) if (TOGGLE_MODS$1.includes(type)) mods[type] = IsToggleModOn(vehicle, type) ? 1 : 0;
		else mods[type] = GetVehicleMod(vehicle, type);
		const extras = {};
		for (let id = 0; id <= 14; id++) if (DoesExtraExist(vehicle, id)) extras[id] = IsVehicleExtraTurnedOn(vehicle, id);
		const custom = (get, has) => has ? get(vehicle) : null;
		return {
			v: 1,
			model: GetEntityModel(vehicle),
			plate: GetVehicleNumberPlateText(vehicle).trim(),
			plateIndex: GetVehicleNumberPlateTextIndex(vehicle),
			colors: [primary ?? 0, secondary ?? 0],
			extraColors: [pearl ?? 0, wheel ?? 0],
			customPrimary: custom(GetVehicleCustomPrimaryColour, GetIsVehiclePrimaryColourCustom(vehicle)),
			customSecondary: custom(GetVehicleCustomSecondaryColour, GetIsVehicleSecondaryColourCustom(vehicle)),
			wheelType: GetVehicleWheelType(vehicle),
			windowTint: GetVehicleWindowTint(vehicle),
			livery: GetVehicleLivery(vehicle),
			mods,
			xenonColor: GetVehicleXenonLightsColor(vehicle),
			neon: [
				0,
				1,
				2,
				3
			].map((i) => IsVehicleNeonLightEnabled(vehicle, i)),
			neonColor: GetVehicleNeonLightsColour(vehicle),
			tyreSmoke: GetVehicleTyreSmokeColor(vehicle),
			extras,
			dirt: GetVehicleDirtLevel(vehicle),
			engineHealth: GetVehicleEngineHealth(vehicle),
			bodyHealth: GetVehicleBodyHealth(vehicle)
		};
	}
	/** Applies stored properties (only to a vehicle this client controls; others get them through the network). */
	function setVehicleProps(vehicle, props) {
		SetVehicleModKit(vehicle, 0);
		SetVehicleNumberPlateText(vehicle, props.plate);
		SetVehicleNumberPlateTextIndex(vehicle, props.plateIndex);
		SetVehicleColours(vehicle, props.colors[0], props.colors[1]);
		SetVehicleExtraColours(vehicle, props.extraColors[0], props.extraColors[1]);
		if (props.customPrimary) SetVehicleCustomPrimaryColour(vehicle, ...props.customPrimary);
		if (props.customSecondary) SetVehicleCustomSecondaryColour(vehicle, ...props.customSecondary);
		SetVehicleWheelType(vehicle, props.wheelType);
		SetVehicleWindowTint(vehicle, props.windowTint);
		for (const [type, index] of Object.entries(props.mods)) {
			const t = Number(type);
			if (TOGGLE_MODS$1.includes(t)) ToggleVehicleMod(vehicle, t, index === 1);
			else SetVehicleMod(vehicle, t, index, false);
		}
		SetVehicleLivery(vehicle, props.livery);
		SetVehicleXenonLightsColor(vehicle, props.xenonColor);
		props.neon.forEach((on, i) => SetVehicleNeonLightEnabled(vehicle, i, on));
		SetVehicleNeonLightsColour(vehicle, ...props.neonColor);
		SetVehicleTyreSmokeColor(vehicle, ...props.tyreSmoke);
		for (const [id, on] of Object.entries(props.extras)) SetVehicleExtra(vehicle, Number(id), !on);
		SetVehicleDirtLevel(vehicle, props.dirt);
		SetVehicleEngineHealth(vehicle, props.engineHealth);
		SetVehicleBodyHealth(vehicle, props.bodyHealth);
	}

// ../../../packages/lib/src/client/keybind.ts
	const resource = GetCurrentResourceName();

// ../../../packages/lib/src/fivem/locale.ts
/** Convar holding the language (`setr ai:locale "en"` in misc.cfg); replicated so clients read it too. */
	const LOCALE_CONVAR = "ai:locale";
	function readLocaleFile(resource, lang) {
		const raw = LoadResourceFile(resource, `locales/${lang}.json`);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) return {};
		const texts = {};
		for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") texts[key] = value;
		return texts;
	}
	/**
	* The resource's lang texts: `locales/en.json` (complete base) overlaid with `locales/<ai:locale>.json`.
	* `${OTHER_KEY}` inside a text is replaced by that text once at load. Returns `t(key, ...args)` filling
	* `{0}`, `{1}`...; a missing key returns the key itself so it is visible in game.
	*
	*   const t = createLocale<typeof import("../../locales/en.json")>();
	*   t("NOTIFY_NO_MONEY", price);
	*/
	function createLocale() {
		const texts = loadLocaleTexts();
		return (key, ...args) => formatText(texts[key] ?? key, args);
	}
	/**
	* The resource's merged lang table (`en.json` overlaid with the `ai:locale` language, `${KEY}` references
	* resolved). A NUI gets this once and fills `{0}` placeholders itself.
	*/
	function loadLocaleTexts(resource = GetCurrentResourceName()) {
		const lang = GetConvar(LOCALE_CONVAR, "en");
		const texts = {
			...readLocaleFile(resource, "en"),
			...lang === "en" ? {} : readLocaleFile(resource, lang)
		};
		for (const key of Object.keys(texts)) texts[key] = (texts[key] ?? "").replace(/\$\{([A-Z0-9_]+)\}/g, (match, ref) => texts[ref] ?? match);
		return texts;
	}

// resource/common/locale.ts
/** This resource's lang texts: `Locale("NOTIFY_NO_MONEY", price)`; keys typed from locales/en.json. */
	const Locale = createLocale();

// resource/common/resource.ts
	const ResourceName = GetCurrentResourceName();
	const ResourceContext = IsDuplicityVersion() ? "server" : "client";

// resource/common/mechanic.ts
/** ai-mechanic's contracts, panel content and the tuning change rules (both sides). No natives. */
	const EVENTS = {
		/** Callback: (netId, change: Change, base: VehicleProps) -> { ok } buys one change at the shop the player is in. */
		buy: "ai-mechanic:buy",
		/** Callback: (netId) -> { ok } repairs the vehicle at a shop. */
		repair: "ai-mechanic:repair",
		/** Callback: (shopId) -> { ok } opens a job shop's stash. */
		stash: "ai-mechanic:stash",
		/** Callback: (netId) -> { ok } washes the vehicle at a car wash. */
		wash: "ai-mechanic:wash",
		/** Callback: (token) -> { ok } the repair kit's progress ran out. */
		kitFinish: "ai-mechanic:kitFinish",
		/** Server -> player: (token, seconds) run the repair kit's progress. */
		kitStart: "ai-mechanic:client:kitStart",
		/** Server -> entity owner: (netId, engine | null) fix the body (engine null) or set the engine health; (netId, -1) wash. */
		fix: "ai-mechanic:client:fix"
	};
	const point = (v) => {
		const p = record(v);
		return {
			x: num(p.x, 0),
			y: num(p.y, 0),
			z: num(p.z, 0)
		};
	};
	function readSettings(raw) {
		const v = record(raw);
		const accounts = Array.isArray(v.accounts) ? v.accounts.filter((a) => typeof a === "string") : [];
		return {
			accounts: accounts.length > 0 ? accounts : ["cash", "bank"],
			repairPoint: num(v.repairPoint, 2),
			performance: int(v.performance, 2500, 0),
			turbo: int(v.turbo, 15e3, 0),
			xenon: int(v.xenon, 2e3, 0),
			cosmetic: int(v.cosmetic, 750, 0),
			wheels: int(v.wheels, 1500, 0),
			paint: int(v.paint, 1e3, 0),
			tint: int(v.tint, 500, 0),
			plate: int(v.plate, 300, 0),
			washPrice: int(v.washPrice, 20, 0),
			washSeconds: int(v.washSeconds, 6, 1, 60),
			kitEngine: int(v.kitEngine, 750, 100, 1e3),
			kitSeconds: int(v.kitSeconds, 10, 1, 60)
		};
	}
	function readShops(raw) {
		const out = /* @__PURE__ */ new Map();
		for (const [id, value] of Object.entries(record(raw))) {
			const v = record(value);
			const stash = point(v.stash);
			out.set(id, {
				id,
				label: str(v.label, id, 48),
				job: str(v.job, "", 32),
				coords: point(v.coords),
				radius: num(v.radius, 8),
				blip: bool(v.blip, true),
				repair: bool(v.repair, true),
				tuning: bool(v.tuning, true),
				multiplier: num(v.multiplier, 1),
				stash: stash.x === 0 && stash.y === 0 ? null : stash
			});
		}
		return out;
	}
	function readWashes(raw) {
		return Object.entries(record(raw)).map(([id, value]) => {
			const v = record(value);
			return {
				id,
				label: str(v.label, id, 48),
				coords: point(v.coords)
			};
		});
	}
	/** Mod slots by price group; turbo (18) and xenon (22) are on / off. */
	const PERFORMANCE_MODS = [
		11,
		12,
		13,
		15,
		16
	];
	const COSMETIC_MODS = [
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
	];
	const TOGGLE_MODS = [18, 22];
	const WHEEL_MOD = 23;
	/** GTA colour indices offered as paint. */
	const PAINTS = [
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
	];
	const MOD_TYPES = /* @__PURE__ */ new Set([
		...PERFORMANCE_MODS,
		...COSMETIC_MODS,
		...TOGGLE_MODS
	]);
	/** The change's price before the shop multiplier; going back to stock is free. */
	function priceOf(change, s) {
		switch (change.kind) {
			case "mod":
				if (change.index < 0) return 0;
				if (change.type === 18) return s.turbo;
				if (change.type === 22) return s.xenon;
				return PERFORMANCE_MODS.includes(change.type) ? s.performance * (change.index + 1) : s.cosmetic;
			case "wheels": return change.index < 0 ? 0 : s.wheels;
			case "paint": return s.paint;
			case "tint": return change.value === 0 ? 0 : s.tint;
			case "plate": return s.plate;
			default: return change;
		}
	}
	/** The props with the change applied (a new object). */
	function applyChange(props, change) {
		const next = {
			...props,
			mods: { ...props.mods },
			colors: [...props.colors]
		};
		switch (change.kind) {
			case "mod":
				next.mods[change.type] = TOGGLE_MODS.includes(change.type) ? change.index >= 0 ? 1 : 0 : change.index;
				break;
			case "wheels":
				next.wheelType = change.wheelType;
				next.mods[23] = change.index;
				break;
			case "paint":
				next.colors[change.slot] = change.color;
				if (change.slot === 0) next.customPrimary = null;
				else next.customSecondary = null;
				break;
			case "tint":
				next.windowTint = change.value;
				break;
			case "plate": next.plateIndex = change.value;
		}
		return next;
	}

// resource/client/customs.ts
	const texts = loadLocaleTexts();
	const text = (key, fallback) => texts[key] ?? fallback;
	const errorText = (v, fallback) => {
		const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
		return texts[key] ?? key;
	};
	const PAGE = 36;
	const WHEEL_TYPES = [
		0,
		1,
		2,
		3,
		4,
		5,
		7,
		8,
		9,
		10,
		11,
		12
	];
	/**
	* The customs menus of one visit: every list previews the hovered option on the vehicle, a pick buys it (the server
	* writes the props bag, ai-vehicles applies it), closing a list puts the vehicle back as it is.
	*/
	var Customs = class {
		vehicle;
		shop;
		settings;
		props;
		constructor(vehicle, shop, settings) {
			this.vehicle = vehicle;
			this.shop = shop;
			this.settings = settings;
			SetVehicleModKit(vehicle, 0);
			this.props = getVehicleProps(vehicle);
		}
		async run() {
			for (;;) {
				const items = [];
				if (this.shop.repair) items.push({
					id: "repair",
					label: Locale("MECH_MENU_REPAIR"),
					icon: "wrench",
					description: `$${this.repairPrice()}`
				});
				if (this.shop.tuning) items.push({
					id: "performance",
					label: Locale("MECH_MENU_PERFORMANCE"),
					icon: "gauge"
				}, {
					id: "body",
					label: Locale("MECH_MENU_BODY"),
					icon: "car"
				}, {
					id: "wheels",
					label: Locale("MECH_MENU_WHEELS"),
					icon: "circle-dot"
				}, {
					id: "paint",
					label: Locale("MECH_MENU_PAINT"),
					icon: "spray-can"
				}, {
					id: "extras",
					label: Locale("MECH_MENU_EXTRAS"),
					icon: "sliders"
				});
				const pick = await menu({
					title: this.shop.label,
					items
				});
				if (pick === null || !DoesEntityExist(this.vehicle) || cache.vehicle !== this.vehicle) return this.restore();
				if (pick === "repair") return this.repair();
				if (pick === "performance") await this.slots(Locale("MECH_MENU_PERFORMANCE"), [...PERFORMANCE_MODS, 18]);
				else if (pick === "body") await this.slots(Locale("MECH_MENU_BODY"), [...COSMETIC_MODS]);
				else if (pick === "wheels") await this.wheels();
				else if (pick === "paint") await this.paint();
				else if (pick === "extras") await this.extras();
			}
		}
		repairPrice() {
			const damage = Math.max(0, 1e3 - GetVehicleEngineHealth(this.vehicle)) + Math.max(0, 1e3 - GetVehicleBodyHealth(this.vehicle));
			return Math.round(damage * this.settings.repairPoint * this.shop.multiplier);
		}
		restore() {
			if (DoesEntityExist(this.vehicle)) setVehicleProps(this.vehicle, {
				...this.props,
				engineHealth: GetVehicleEngineHealth(this.vehicle),
				bodyHealth: GetVehicleBodyHealth(this.vehicle)
			});
		}
		async repair() {
			const result = record(await triggerServerCallback(EVENTS.repair, [VehToNet(this.vehicle)]).catch(() => null));
			if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
		}
		price(change) {
			return Math.round(priceOf(change, this.settings) * this.shop.multiplier);
		}
		/** A list of options with live preview; a pick buys and the list stays open. */
		async choose(title, build) {
			let page = 0;
			for (;;) {
				const options = build();
				const pages = Math.max(1, Math.ceil(options.length / PAGE));
				page = Math.min(page, pages - 1);
				const shown = options.slice(page * PAGE, page * PAGE + PAGE);
				const items = shown.map((o) => ({
					id: o.id,
					label: o.label,
					description: o.installed ? Locale("MECH_INSTALLED") : `$${this.price(o.change)}`,
					disabled: o.installed
				}));
				if (page > 0) items.push({
					id: "prev",
					label: Locale("MECH_PREV_PAGE"),
					icon: "list"
				});
				if (page < pages - 1) items.push({
					id: "next",
					label: Locale("MECH_NEXT_PAGE"),
					icon: "list"
				});
				const pick = await menu({
					title: pages > 1 ? `${title} ${page + 1}/${pages}` : title,
					items
				}, (id) => {
					const option = shown.find((o) => o.id === id);
					if (option) setVehicleProps(this.vehicle, applyChange(this.props, option.change));
				});
				if (pick === "prev" || pick === "next") {
					page += pick === "next" ? 1 : -1;
					continue;
				}
				const option = shown.find((o) => o.id === pick);
				if (!option || !DoesEntityExist(this.vehicle)) return this.restore();
				const result = record(await triggerServerCallback(EVENTS.buy, [
					VehToNet(this.vehicle),
					option.change,
					this.props
				]).catch(() => null));
				if (result.ok === true) this.props = applyChange(this.props, option.change);
				else {
					notify(errorText(result, "MECH_ERR_FAR"), "error");
					this.restore();
				}
			}
		}
		levels(type) {
			const current = this.props.mods[type] ?? -1;
			if (type === 18 || type === 22) return [0, 1].map((on) => ({
				id: String(on),
				label: Locale(on ? "MECH_ON" : "MECH_OFF"),
				change: {
					kind: "mod",
					type,
					index: on ? 0 : -1
				},
				installed: current === 1 === (on === 1)
			}));
			const count = GetNumVehicleMods(this.vehicle, type);
			return Array.from({ length: count + 1 }, (_, i) => {
				const index = i - 1;
				const label = index < 0 ? Locale("MECH_STOCK") : GetLabelText(GetModTextLabel(this.vehicle, type, index));
				return {
					id: String(index),
					label: index < 0 || label === "NULL" ? index < 0 ? label : Locale("MECH_LEVEL", index + 1) : label,
					change: {
						kind: "mod",
						type,
						index
					},
					installed: current === index
				};
			});
		}
		async slots(title, types) {
			for (;;) {
				const available = types.filter((t) => t === 18 || GetNumVehicleMods(this.vehicle, t) > 0);
				if (available.length === 0) return notify(Locale("MECH_NOTHING"), "info");
				const items = available.map((t) => ({
					id: String(t),
					label: text(`MECH_MOD_${t}`, `#${t}`)
				}));
				const pick = await menu({
					title,
					items
				});
				if (pick === null) return;
				const type = Number(pick);
				await this.choose(text(`MECH_MOD_${type}`, pick), () => this.levels(type));
			}
		}
		async wheels() {
			const types = IsThisModelABike(GetEntityModel(this.vehicle)) ? [6] : WHEEL_TYPES;
			for (;;) {
				const pick = await menu({
					title: Locale("MECH_MENU_WHEELS"),
					items: types.map((t) => ({
						id: String(t),
						label: text(`MECH_WHEELS_${t}`, `#${t}`)
					}))
				});
				if (pick === null) return;
				const wheelType = Number(pick);
				SetVehicleWheelType(this.vehicle, wheelType);
				const count = GetNumVehicleMods(this.vehicle, 23);
				await this.choose(text(`MECH_WHEELS_${wheelType}`, pick), () => Array.from({ length: count + 1 }, (_, i) => {
					const index = i - 1;
					const label = index < 0 ? Locale("MECH_STOCK") : GetLabelText(GetModTextLabel(this.vehicle, 23, index));
					const installed = this.props.wheelType === wheelType && (this.props.mods[23] ?? -1) === index;
					return {
						id: String(index),
						label: label === "NULL" ? Locale("MECH_LEVEL", index + 1) : label,
						change: {
							kind: "wheels",
							wheelType,
							index
						},
						installed
					};
				}));
			}
		}
		async paint() {
			for (;;) {
				const pick = await menu({
					title: Locale("MECH_MENU_PAINT"),
					items: [{
						id: "0",
						label: Locale("MECH_PRIMARY")
					}, {
						id: "1",
						label: Locale("MECH_SECONDARY")
					}]
				});
				if (pick === null) return;
				const slot = pick === "1" ? 1 : 0;
				await this.choose(Locale(slot ? "MECH_SECONDARY" : "MECH_PRIMARY"), () => PAINTS.map((color) => ({
					id: String(color),
					label: text(`MECH_PAINT_${color}`, `#${color}`),
					change: {
						kind: "paint",
						slot,
						color
					},
					installed: this.props.colors[slot] === color
				})));
			}
		}
		async extras() {
			for (;;) {
				const items = [
					{
						id: "tint",
						label: Locale("MECH_TINT")
					},
					{
						id: "plate",
						label: Locale("MECH_PLATE")
					},
					{
						id: "xenon",
						label: Locale("MECH_XENON")
					}
				];
				const pick = await menu({
					title: Locale("MECH_MENU_EXTRAS"),
					items
				});
				if (pick === null) return;
				if (pick === "xenon") await this.choose(Locale("MECH_XENON"), () => this.levels(22));
				else if (pick === "tint") await this.choose(Locale("MECH_TINT"), () => [
					0,
					1,
					2,
					3,
					4,
					5,
					6
				].map((value) => ({
					id: String(value),
					label: text(`MECH_TINT_${value}`, `#${value}`),
					change: {
						kind: "tint",
						value
					},
					installed: this.props.windowTint === value
				})));
				else await this.choose(Locale("MECH_PLATE"), () => [
					0,
					1,
					2,
					3,
					4,
					5
				].map((value) => ({
					id: String(value),
					label: text(`MECH_PLATE_${value}`, `#${value}`),
					change: {
						kind: "plate",
						value
					},
					installed: this.props.plateIndex === value
				})));
			}
		}
	};

// resource/client/index.ts
	const world = new AdminWorld([
		"settings",
		"shops",
		"washes"
	]);
	const content = {
		settings: readSettings(world.get("settings")),
		shops: readShops(world.get("shops")),
		washes: readWashes(world.get("washes"))
	};
	const driving = () => cache.vehicle !== false && GetPedInVehicleSeat(cache.vehicle, -1) === cache.ped ? cache.vehicle : null;
	/** Shop, stash and car wash points with their blips, built again when the panel changes them. */
	const points = new Points();
	function rebuild() {
		points.clear();
		for (const shop of content.shops.values()) {
			points.add(`shop:${shop.id}`, {
				coords: shop.coords,
				label: Locale("MECH_PROMPT_SHOP", shop.label),
				icon: "screwdriver-wrench",
				radius: shop.radius,
				targetRadius: 2,
				interval: 400,
				blip: shop.blip ? {
					sprite: shop.job ? 446 : 72,
					color: 0,
					scale: .7,
					label: shop.label
				} : void 0,
				onPressed: () => openShop(shop)
			});
			if (shop.job && shop.stash) points.add(`stash:${shop.id}`, {
				coords: shop.stash,
				label: Locale("MECH_PROMPT_STASH"),
				icon: "box-open",
				radius: 1.5,
				interval: 400,
				onPressed: () => openStash(shop.id)
			});
		}
		for (const at of content.washes) points.add(`wash:${at.id}`, {
			coords: at.coords,
			label: Locale("MECH_PROMPT_WASH", content.settings.washPrice),
			icon: "droplet",
			radius: 7.5,
			promptOnly: true,
			interval: 400,
			blip: {
				sprite: 100,
				color: 0,
				scale: .7,
				label: at.label
			},
			onPressed: () => wash()
		});
	}
	rebuild();
	world.onChange("settings", () => {
		content.settings = readSettings(world.get("settings"));
		rebuild();
	});
	world.onChange("shops", () => {
		content.shops = readShops(world.get("shops"));
		rebuild();
	});
	world.onChange("washes", () => {
		content.washes = readWashes(world.get("washes"));
		rebuild();
	});
	async function openShop(shop) {
		const vehicle = driving();
		if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
		await new Customs(vehicle, shop, content.settings).run();
	}
	async function wash() {
		const vehicle = driving();
		if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
		const result = record(await triggerServerCallback(EVENTS.wash, [VehToNet(vehicle)]).catch(() => null));
		if (result.ok !== true) return notify(errorText(result, "MECH_ERR_FAR"), "error");
		await progress({
			label: Locale("MECH_WASHING"),
			duration: content.settings.washSeconds * 1e3,
			allowVehicle: true
		});
	}
	async function openStash(shopId) {
		const result = record(await triggerServerCallback(EVENTS.stash, [shopId]).catch(() => null));
		if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
	}
	/** The vehicle's owner applies what only it can change: health, deformation, dirt. */
	onServerEvent(EVENTS.fix, { args: ([netId, engine]) => typeof netId === "number" && (engine == null || typeof engine === "number") ? [netId, engine ?? null] : null }, (netId, engine) => {
		if (!NetworkDoesEntityExistWithNetworkId(netId)) return;
		const vehicle = NetToVeh(netId);
		if (engine === -1) {
			SetVehicleDirtLevel(vehicle, 0);
			WashDecalsFromVehicle(vehicle, 1);
		} else if (engine === null) {
			SetVehicleFixed(vehicle);
			SetVehicleDeformationFixed(vehicle);
			SetVehicleEngineHealth(vehicle, 1e3);
			SetVehicleBodyHealth(vehicle, 1e3);
			SetVehicleUndriveable(vehicle, false);
		} else {
			SetVehicleEngineHealth(vehicle, engine);
			SetVehicleUndriveable(vehicle, false);
		}
	});
	onServerEvent(EVENTS.kitStart, { args: ([token, seconds, netId]) => typeof token === "number" && typeof seconds === "number" && typeof netId === "number" ? [
		token,
		seconds,
		netId
	] : null }, async (token, seconds, netId) => {
		if (NetworkDoesEntityExistWithNetworkId(netId)) TaskTurnPedToFaceEntity(cache.ped, NetToVeh(netId), 1e3);
		if (!await progress({
			label: Locale("MECH_KIT_WORKING"),
			duration: seconds * 1e3,
			anim: {
				dict: "mini@repair",
				clip: "fixing_a_ped"
			}
		})) return;
		const result = record(await triggerServerCallback(EVENTS.kitFinish, [token]).catch(() => null));
		if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
	});

})();
}catch(e){globalThis.__aicoreReportError&&globalThis.__aicoreReportError("load: "+(e&&e.stack||e));throw e}
