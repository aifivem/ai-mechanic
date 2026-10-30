# ai-mechanic

Mechanic shops (repair and tuning with live preview, public or run by a job with a shared stash), car washes and the repair kit item. Depends on ai-core (money, job accounts, menu, prompts, progress); uses ai-vehicles (props bag, saving owned vehicles) when it runs, and the active inventory through ai-core's inventory layer (lib `inventory`) (repair kit, stash).

## Decisions

- Tuning is one change per purchase (`Change` in `resource/common/mechanic.ts`); price and the props it produces are computed by the same functions on both sides, the server's result is the one written.
- A purchase writes ai-vehicles' `ai:props` bag; the server takes plate, engine / body health and dirt from the entity so a purchase never changes them.
- Health, deformation and dirt can only be changed by the entity's owner client: the server sends `fix` to `NetworkGetEntityOwner`.
- Job shops: on-duty members only, paid from the job's `bank` shared account. Public shops: the driver pays from the panel's accounts.
- The menu previews with lib `menu(request, onHover)`; closing a list re-applies the last bought props.

## Contracts

- Callbacks and events: `resource/common/mechanic.ts`.
- Item `repairkit` (ai-inventory `data/items.json`); job shop stash `mechanic_<shopId>`.

## Pitfalls

- `setVehicleProps` also sets health and dirt: props written by the server carry the entity's current values, and the client restore uses the live health.

## Entry points

- Purchases, repairs, car washes `resource/server/index.ts`; repair kit and stashes `resource/server/service.ts`; customs menus `resource/client/customs.ts`; zones and owner fixes `resource/client/index.ts`.
