# ai-mechanic

Mechanic shops (repair and tuning with live preview, public or run by a job with a shared stash), car washes and the repair kit item. Depends on ai-core (money, job accounts, menu, prompts, progress); uses ai-vehicles (props bag, saving owned vehicles) when it runs, and the active inventory through ai-core's inventory layer (lib `inventory`) (repair kit, stash).

## Decisions

- Tuning is one change per purchase (`Change` in `resource/common/mechanic.ts`); price and the props it produces are computed by the same functions on both sides, the server's result is the one written.
- A purchase writes ai-vehicles' `ai:props` bag and saves an owned vehicle with ai-vehicles' `SaveTuning` (the only caller: `SaveVehicle` keeps stored mods and neon); the server takes plate, engine / body health and dirt from the entity so a purchase never changes them. Repairs save only health through `SaveVehicle`.
- Health, deformation and dirt can only be changed by the entity's owner client: the server sends `fix` to `NetworkGetEntityOwner`.
- Job shops: on-duty members only: the shop's `access` is a lib `AccessRule` built from its single `job` with `onDuty` (client `canShow` `allows`, server `online.allows`; points refresh on `onMembershipChange`). `job` stays one name because it also names the paying account and the stash group, so the record has no `ACCESS_FIELDS`. Job shops are paid from the job's `bank` shared account, except a car the member's own character owns in ai-vehicles: that one the member pays from the panel's accounts (`payerOf`). Every purchase and repair is logged with its payer and vehicle id. Public shops: the driver pays from the panel's accounts.
- Car wash: a lib `progressFor` in the `wash` callback (bar in the vehicle); the price is taken and the dirt removed after it, when the player still drives the dirty vehicle at a wash.
- Repair kit: the vehicle is lib `nearestVehicleTo(source, 4)`; the work is a lib `progressFor` (server-timed bar facing the vehicle, one kit at a time per player); the kit is spent after it, if the player is still within 5 m. Kit item, job stash size and the blip looks (public shop, job shop, car wash) are panel settings; a renamed kit item is registered as usable on the settings change (the old name does nothing until a restart).
- The menu previews with lib `menu(request, onHover)`; closing a list re-applies the last bought props.

## Contracts

- Callbacks and events: `resource/common/mechanic.ts`.
- Item `settings.kitItem` (default `repairkit`, ai-inventory `data/items.json`); job shop stash `mechanic_<shopId>`.

## Pitfalls

- `setVehicleProps` also sets health and dirt: props written by the server carry the entity's current values, and the client restore uses the live health.

## Entry points

- Purchases, repairs, car washes `resource/server/index.ts`; repair kit and stashes `resource/server/service.ts`; customs menus `resource/client/customs.ts`; shop, stash and wash points (lib `RecordObjects` + `Points`: an edited shop or wash rebuilds only its points, a settings change all) and owner fixes `resource/client/index.ts`; job shop stashes are registered per shop record the same way on the server (`RecordObjects` on the `AdminPanel`).
