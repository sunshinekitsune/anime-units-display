const modid = "anime-units-display";
const mod = Vars.mods.getMod(modid);

const DEFAULT_OVERRIDE_CHARACTER = "alpha-peek";
const NO_ANCHOR_CHARACTERS = ["zenith"];

const KEY_GLOBAL_OVERRIDE_ENABLED = modid + "-global-override-enabled";
const KEY_GLOBAL_OVERRIDE_TEXTURE = modid + "-global-override-texture";
const KEY_FALLBACK_HANDLING = modid + "-fallback-handling";

const CHIBIS_DIRECTORY = "chibis";

/**
 * Default = 0
 * Summer = 1
 * Winter = 2
 */
let mapType = 0;
const coldFloors = new Seq();
const summerFloors = new Seq();
const waterFloors = new Seq();
const SUMMER_MINIMUM = 4;
const COLD_MINIMUM = 3;

const cache = new Map();
const globalCache = new Map();
let currentTexSet = null;
let lastType = null;
let lastTex = null;
let lastTargetChar = null;
let lastHint = null;

let fade = 0;
let squish = 0;
let reloads = [];
let hasUnit = false;
const playedLines = new ObjectSet();
let hintLabel = null;

function getTex(name) {
    if (cache.has(name)) {
        return cache.get(name);
    }

    let file = mod.root.child(CHIBIS_DIRECTORY).child(name + ".png");
    if (!file.exists()) {
        file = Vars.tree.get(CHIBIS_DIRECTORY + "/" + name + ".png");
    }

    if (file.exists()) {
        const tex = new Texture(file, true);
        tex.setFilter(Texture.TextureFilter.mipMapLinearLinear, Texture.TextureFilter.linear);
        cache.set(name, tex);
        return tex;
    }

    cache.set(name, null);
    return null;
}

function loadData(name) {
    if (!name) {
        return null;
    }

    const main = getTex(name);
    if (!main) {
        return null;
    }
    return {
        main: main,
        mining: getTex(name + "-mining"),
        building: getTex(name + "-building"),
        shooting: getTex(name + "-shooting")
    };
}

function getFullSet(name) {
    if (!name) return null;
    if (globalCache.has(name)) {
        return globalCache.get(name);
    }

    const data = {
        default: loadData(name),
        summer: loadData(name + "-summer"),
        winter: loadData(name + "-winter")
    };
    globalCache.set(name, data);
    return data;
}

function getSeasonalData(data) {
    if (!data) {
        return null;
    }
    if (mapType === 1 && data.summer) {
        return data.summer;
    }
    if (mapType === 2 && data.winter) {
        return data.winter;
    }
    return data.default;
}

function fetchText(hint) {
    const key = "animehint." + hint.name() + (Vars.mobile ? ".mobile" : "");
    let text = Core.bundle.has(key) ? Core.bundle.get(key) : hint.text();
    if (!Vars.mobile && text) {
        text = text.replace(/tap/g, "click").replace(/Tap/g, "Click");
    }
    return text;
}

function showDialogue(text, duration) {
    if (duration === undefined) {
        duration = 4;
    }

    if (!hintLabel) {
        return;
    }

    hintLabel.clearActions();
    if (!text) {
        hintLabel.actions(Actions.parallel(Actions.alpha(0, 0.5), Actions.translateBy(0, -20, 0.5)), Actions.hide());
        return;
    }

    hintLabel.visible = true;
    hintLabel.color.a = 1;
    hintLabel.translation.y = 0;

    if (hintLabel.restart) {
        hintLabel.restart("{ease}" + text);
    } else {
        hintLabel.setText(text);
    }

    hintLabel.actions(Actions.delay(duration), Actions.run(() => hintLabel.actions(Actions.parallel(Actions.alpha(0, 0.8, Interp.smooth), Actions.translateBy(0, -30, 0.8, Interp.sinkIn)), Actions.hide())));
}

function showKey(textName, delay, once, duration) {
    if (delay === undefined) {
        delay = 0;
    }
    if (once === undefined) {
        once = true;
    }
    if (duration === undefined) {
        duration = 4;
    }

    if (Vars.player.dead()) {
        return;
    }

    const unit = Vars.player.unit();
    if (!unit || !unit.type) {
        return;
    }

    const key = "dialogue." + unit.type.name + "." + textName;
    if (Core.bundle.has(key) && (!once || playedLines.add(key))) {
        Time.runTask(delay, () => showDialogue(Core.bundle.get(key), duration));
    }
}

Events.run(WorldLoadEvent, () => {
    Core.app.post(() => {
        mapType = 0;
        let summerPresent = 0;
        let coldPresent = 0;
        Vars.state.rules.weather.each(w => {
            if (w.weather == Weathers.rain) {
                summerPresent--;
            }
            if (w.weather == Weathers.sandstorm) {
                summerPresent++;
            }
            if (w.weather == Weathers.snow) {
                coldPresent++;
            }
        });
        for (let i = 0; i < coldFloors.size; i++) {
            if (coldPresent >= COLD_MINIMUM) {
                break;
            }
            if (Vars.indexer.isBlockPresent(coldFloors.get(i))) {
                coldPresent++;
            }
        }
        if (coldPresent >= COLD_MINIMUM) {
            mapType = 2;
        } else {
            let hasWater = false;
            for (let i = 0; i < waterFloors.size; i++) {
                if (Vars.indexer.isBlockPresent(waterFloors.get(i))) {
                    hasWater = true;
                    const f = waterFloors.get(i);
                    if ((f instanceof ShallowLiquid && summerFloors.contains(f.floorBase)) || f.drownTime > 0) {
                        summerPresent++;
                    }
                }
            }
            for (let i = 0; i < summerFloors.size && summerPresent < SUMMER_MINIMUM; i++) {
                if (Vars.indexer.isBlockPresent(summerFloors.get(i))) {
                    summerPresent++;
                }
            }
            if (hasWater && summerPresent >= SUMMER_MINIMUM) {
                mapType = 1;
            }
        }
    });
});

Events.on(UnitControlEvent, e => e.player == Vars.player && showKey("control", 50));
Events.on(PayloadDropEvent, e => e.carrier == Vars.player.unit() && showKey("drop", 50));
Events.on(PickupEvent, e => e.carrier == Vars.player.unit() && showKey("pickup", 0));

Events.run(ClientLoadEvent, () => {
    Vars.content.blocks().each(b => {
        if (b instanceof Floor) {
            if (b.itemDrop == Items.sand) {
                summerFloors.add(b);
            }
            if (b.liquidDrop == Liquids.water) {
                waterFloors.add(b);
            }
            if (b.name && (b.name.includes("ice") || b.name.includes("snow") || b.name.includes("icy"))) {
                coldFloors.add(b);
            }
        }
    });
    Vars.ui.settings.addCategory("Anime Units Display", Core.atlas.drawable("alphaaaa"), t => {
        t.check("Enable global override", Core.settings.getBool(KEY_GLOBAL_OVERRIDE_ENABLED, false), b => Core.settings.put(KEY_GLOBAL_OVERRIDE_ENABLED, b)).left().row();
        t.check("Use fallback handling", Core.settings.getBool(KEY_FALLBACK_HANDLING, true), b => Core.settings.put(KEY_FALLBACK_HANDLING, b)).left().row();
        const overrideButton = t.button("Texture: " + Core.settings.getString(KEY_GLOBAL_OVERRIDE_TEXTURE, DEFAULT_OVERRIDE_CHARACTER), () => {
            const dialog = new BaseDialog("Select Character");
            dialog.addCloseButton();

            const pane = new Table();
            const baseNames = [];
            const chibisDirectory = mod.root.child(CHIBIS_DIRECTORY);
            if (chibisDirectory.exists()) {
                chibisDirectory.list().forEach(f => {
                    const n = f.nameWithoutExtension();
                    if (!n.match(/-(mining|building|shooting|summer|winter)$/)) {
                        baseNames.push(n);
                    }
                });
            }

            baseNames.forEach((name, i) => {
                pane.button(name, () => {
                    Core.settings.put(KEY_GLOBAL_OVERRIDE_TEXTURE, name);
                    overrideButton.setText("Texture: " + name);
                    getFullSet(name);
                    dialog.hide();
                }).size(200, 50).pad(4);
                if (i % 2 === 1) pane.row();
            });

            dialog.cont.add(new ScrollPane(pane)).grow();
            dialog.show();
        }).width(300).height(50).padTop(10).left().get();
    });

    hintLabel = new FLabel("");
    hintLabel.setStyle(Styles.outlineLabel);
    hintLabel.setAlignment(Align.center, Align.left);
    hintLabel.setWrap(true);

    const displayElement = extend(Element, {
        draw() {
            if (!Vars.state.isGame() || !currentTexSet) {
                return;
            }

            const charData = getSeasonalData(currentTexSet);
            if (!charData) {
                return;
            }

            const unit = Vars.player.unit();
            const isFallback = Core.settings.getBool(KEY_FALLBACK_HANDLING, true);
            let activeTex = charData.main;

            if (unit && !Vars.player.dead()) {
                if (unit.mining()) {
                    activeTex = charData.mining || (isFallback ? charData.shooting : null) || charData.main;
                } else if (unit.activelyBuilding()) {
                    activeTex = charData.building || charData.main;
                } else if (unit.isShooting) {
                    activeTex = charData.shooting || (isFallback ? charData.mining : null) || charData.main;
                }
            }

            if (!activeTex) {
                activeTex = Core.atlas.error.texture;
            }

            if (lastTex != activeTex) {
                squish = Math.max(squish, 0.5);
                lastTex = activeTex;
            }

            const tex = Draw.wrap(activeTex);
            const width = Math.min(Scl.scl(300), Core.graphics.getWidth() / 2);
            const height = width * tex.height / tex.width;

            const anchor = lastType ? !NO_ANCHOR_CHARACTERS.includes(lastType.name) : true;
            const fin = Interp.swingOut.apply(fade);

            const squishFactor = 0.2 * squish + Mathf.sin(Time.globalTime, 20, 0.01);
            const oy = Mathf.cos(Time.globalTime + 5, 50, 8) - height * 0.02;
            const ox = Mathf.sin(Time.globalTime, 100, 2);

            const fWidth = width * (1 + squishFactor);
            const fHeight = height * (1 - squishFactor);

            const drawY = anchor ? (fHeight / 2) : (height / 2);
            const verticalOffset = -height * (1.0 - fin) + drawY + oy;

            Draw.color();
            Draw.rect(tex, width / 2 + ox, verticalOffset, fWidth, fHeight);
            hintLabel.setBounds(Scl.scl(6), height + oy, width - Scl.scl(12), 0);
        }
    });

    displayElement.update(() => {
        if (!Vars.player.dead()) {
            const unit = Vars.player.unit();
            let next = unit.type;
            if (next == UnitTypes.block) {
                const tile = unit.tile();
                next = tile ? tile.block : null;
            }

            const isGlobal = Core.settings.getBool(KEY_GLOBAL_OVERRIDE_ENABLED, false);
            const targetChar = isGlobal ? Core.settings.getString(KEY_GLOBAL_OVERRIDE_TEXTURE, DEFAULT_OVERRIDE_CHARACTER) : (next ? next.name : null);
            if (lastTargetChar != targetChar) {
                fade = Mathf.approachDelta(fade, 0, 0.04);
                if (fade <= 0.01) {
                    lastTargetChar = targetChar;
                    currentTexSet = getFullSet(targetChar);
                    reloads = unit.mounts ? Array(unit.mounts.length).fill(0) : [];
                    squish = 1;
                    lastType = next;
                }
            } else {
                fade = Mathf.approachDelta(fade, 1, 0.04);
                lastType = next;
            }

            if (unit.mounts && reloads.length == unit.mounts.length) {
                for (let i = 0; i < unit.mounts.length; i++) {
                    if (reloads[i] < unit.mounts[i].reload) {
                        squish = 0.4;
                    }
                    reloads[i] = unit.mounts[i].reload;
                }
            }
            hasUnit = currentTexSet && getSeasonalData(currentTexSet) != null;
        } else {
            fade = Mathf.approachDelta(fade, 0, 0.04);
            hasUnit = false;
        }

        const hints = Reflect.get(Vars.ui.hints, "group");
        if (hints) {
            hints.getChildren().each(g => {
                if (g.getChildren().size > 1) {
                    g.getChildren().get(0).visible = !hasUnit;
                }
            });
        }

        const nextHint = Reflect.get(Vars.ui.hints, "current");
        if (nextHint != lastHint) {
            lastHint = nextHint;
            if (nextHint) {
                showDialogue(fetchText(nextHint));
            } else {
                showDialogue(null);
            }
        }
        squish = Mathf.approachDelta(squish, 0, 0.05);
    });

    displayElement.touchable = Touchable.disabled;
    Vars.ui.hudGroup.addChildAt(0, displayElement);
    Vars.ui.hudGroup.addChildAt(1, hintLabel);
});