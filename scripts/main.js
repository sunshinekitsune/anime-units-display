let textures = {};
let globalTextures = {};
let lastType = undefined;
let fade = 0;
let squish = 0;
let reloads = [];
let lastTex = undefined;
let hintLabel = undefined;
let hasUnit = false
let playedLines = new ObjectSet();
const mod = Vars.mods.getMod("anime-units-display");

function loadTex(name, defValue){
    let file = Vars.tree.get("chibis/" + name + ".png");
    if(file.exists()){
        let tex = new Texture(file, true);
        tex.setFilter(Texture.TextureFilter.mipMapLinearLinear, Texture.TextureFilter.linear);
        return tex;
    }
    return defValue;
}

function loadAll(name){
    let mainTex = loadTex(name);
    if(mainTex){
        return {
            main: mainTex,
            mining: loadTex(name + "-mining", null),
            building: loadTex(name + "-building", mainTex),
            shooting: loadTex(name + "-shooting", null),
        };
    }
    return null;
}

function fetchText(hint){
    let text = Vars.mobile && Core.bundle.has("animehint." + hint.name() + ".mobile") ? 
        Core.bundle.get("animehint." + hint.name() + ".mobile") : 
        Core.bundle.get("animehint." + hint.name(), "");

    if(text == "") return hint.text();
    if(!Vars.mobile) text = text.replace("tap", "click").replace("Tap", "Click");
    return text;
}

function showKey(textName, delay, once, duration){
    if(Vars.player.dead()) return;
    let key = "dialogue." + Vars.player.unit().type.name + "." + textName;
    if(Core.bundle.has(key) && (!once || playedLines.add(key))){
        Time.runTask(delay || 0, () => {
            showDialogue(Core.bundle.get(key), duration || 4);
        });
    }
}

//TODO: スキップするのはどうするか
function showDialogue(text, duration){
    hintLabel.actions(Actions.parallel(Actions.alpha(0, 1.0, Interp.smooth), Actions.translateBy(0, Scl.scl(-50), 1.0, Interp.swingIn)), Actions.hide());

    if(text){
        hintLabel.clearActions();
        hintLabel.visible = true;
        hintLabel.color.a = 1;
        hintLabel.translation.y = 0;
        Vars.ui.hudGroup.addChildAt(1, hintLabel);
        hintLabel.restart("{ease}" + text);

        if(duration){
            hintLabel.actions(Actions.delay(duration), Actions.run(() => {
                    hintLabel.actions(Actions.parallel(Actions.alpha(0, 1.0, Interp.smooth), Actions.translateBy(0, Scl.scl(-50), 1.0, Interp.swingIn)), Actions.hide());
            }));
        }
    }
}

Events.on(UnitControlEvent, e => {
    if(e.player == Vars.player){
        showKey("control", 50, true, 4);
    }
});

Events.on(PayloadDropEvent, e => {
    if(e.carrier == Vars.player.unit()){
        showKey("drop", 50, true, 4);
    }
});

Events.on(PickupEvent, e => {
    if(e.carrier == Vars.player.unit()){
        showKey("pickup", 0, true, 3);
    }
});

Events.run(ClientLoadEvent, e => {
    Seq.withArrays(Vars.content.units(), Vars.content.blocks().select(b => b instanceof Turret || b == Blocks.router))
    .each(u => {
        let main = loadAll(u.name);
        if(main){
            textures[u] = {
                def: main,
                summer: loadAll(u.name + "-summer")
            };
        }
    });

    let config = {}
    config[UnitTypes.zenith] = {
        anchor: false
    }

    Vars.ui.settings.addCategory("Anime Units Display", Icon.info, t => {
        t.check("Enable Global Override", Core.settings.getBool("anime-units-display-global-enable", false), b => Core.settings.put("anime-units-display-global-enable", b)).left().row();
        t.check("Use Fallback Handling", Core.settings.getBool("anime-units-display-fallback", true), b => Core.settings.put("anime-units-display-fallback", b)).left().row();
        const overrideButton = t.button("Texture: " + Core.settings.getString("anime-units-display-global-texture", "alpha"), function () {
            const dialog = new BaseDialog("Select Character");
            dialog.addCloseButton();
            const baseNames = [];
            if (mod.root.child("chibis").exists()) {
                const files = mod.root.child("chibis").list();
                for (let i = 0; i < files.length; i++) {
                    const name = files[i].nameWithoutExtension();
                    if (!name.endsWith("-mining") && !name.endsWith("-building") && !name.endsWith("-shooting") && !name.endsWith("-summer")) {
                        baseNames.push(name);
                    }
                }
            }
            const pane = new Table();
            let j = 0;
            for (let i = 0; i < baseNames.length; i++) {
                const name = baseNames[i];
                pane.button(name, () => {
                    Core.settings.put("anime-units-display-global-texture", name);
                    overrideButton.get().setText("Texture: " + name);
                    if (!globalTextures[name]) {
                        globalTextures[name] = { def: loadAll(name), summer: loadAll(name + "-summer") };
                    }

                    dialog.hide();
                }).size(200, 50);
                j++;
                if (j % 2 === 0) {
                    pane.row();
                }
            }
            dialog.cont.add(new ScrollPane(pane)).grow();
            dialog.show();
        }).width(300).height(50).padTop(10).left();
        t.row();
    });

    let hints = Reflect.get(Vars.ui.hints, "group");
    let lastHint;
    hintLabel = new FLabel("");
    hintLabel.setStyle(Styles.outlineLabel);
    hintLabel.setAlignment(Align.center, Align.left);
    hintLabel.setWrap(true);
    
    let elem = extend(Element, {
        draw(){
            hasUnit = false;
            let width = Math.min(Scl.scl(300), Core.graphics.getWidth()/2);
            const isGlobal = Core.settings.getBool("anime-units-display-global-enable", false);
            const globalName = Core.settings.getString("anime-units-display-global-texture", "alpha");
            if(!Vars.player.dead()){
                let next = Vars.player.unit().type;
                if(next == UnitTypes.block){
                    next = Vars.player.unit().tile().block;
                }
                if(lastType != next){
                    if (isGlobal) {
                        lastType = next;
                        reloads = Array(Vars.player.unit().mounts.length);
                    } else {
                        fade = Mathf.approachDelta(fade, 0, 0.04);
                        if(fade <= 0.01){
                            lastType = next;
                            reloads = Array(Vars.player.unit().mounts.length);
                            squish = 1;
                        }
                    }
                }else{
                    fade = Mathf.approachDelta(fade, 1, 0.04);
                }

                if(reloads.length == Vars.player.unit().mounts.length){
                    for(var i = 0; i < reloads.length; i ++){
                        let val = Vars.player.unit().mounts[i].reload;
                        if(reloads[i] < val){
                            squish = 0.4;
                        }
                        reloads[i] = val;
                    }
                }
	        }else{
                fade = Mathf.approachDelta(fade, 0, 0.04);
	        }
	        
            let mainData = null;
            if (isGlobal) {
                if (!globalTextures[globalName]) {
                    globalTextures[globalName] = {
                        def: loadAll(globalName),
                        summer: loadAll(globalName + "-summer")
                    };
                }
                mainData = globalTextures[globalName];
            } else if (lastType && textures[lastType]) {
                mainData = textures[lastType];
            }
            if (mainData && mainData.def && Vars.state.isGame()) {
	            hasUnit = true;
                let isSummer = Vars.indexer.isBlockPresent(Blocks.sand) && Vars.indexer.isBlockPresent(Blocks.sandWater) && !Vars.indexer.isBlockPresent(Blocks.ice) && !Vars.indexer.isBlockPresent(Blocks.snow) && 
                    (Vars.indexer.isBlockPresent(Blocks.water) || Vars.indexer.isBlockPresent(Blocks.deepwater));

                let data = (isSummer && mainData.summer ? mainData.summer : mainData.def) || mainData.def;
                let unit = Vars.player.unit();

                const isFallback = Core.settings.getBool("anime-units-display-fallback", true);
                let texMining = data.mining;
                let texShooting = data.shooting;
                let texBuilding = data.building;
                if (isFallback) {
                    if (texMining == null && texShooting != null) texMining = texShooting;
                    if (texShooting == null && texMining != null) texShooting = texMining;
                }
                if (texMining == null) texMining = data.main;
                if (texShooting == null) texShooting = data.main;
                if (texBuilding == null) texBuilding = data.main;

                let mainTex = data.main;
                if (!Vars.player.dead()) {
                    if (unit.mining()) {
                        mainTex = texMining;
                    } else if (unit.activelyBuilding()) {
                        mainTex = texBuilding;
                    } else if (unit.isShooting) {
                        mainTex = texShooting;
                    }
                }
                
                if(lastTex != mainTex){
                    squish = Math.max(squish, 0.5);
                    lastTex = mainTex;
                }
                
                let conf = config[lastType] || {}
                let anchor = (conf.anchor === undefined ? true : conf.anchor)
                let fin = Interp.swingOut.apply(fade);
	            let tex = Draw.wrap(mainTex);
	            let height = width * tex.height / tex.width;
                let squishFactor = 0.2 * squish + Mathf.sin(Time.globalTime, 20, 0.01);
                let floatScl = 50, floatMag = 8;
                let ox = Mathf.sin(Time.globalTime, 100, floatMag * 0.25), oy = Mathf.cos(Time.globalTime + 5, floatScl, floatMag) - height * 0.02;

                let fwidth = width * (1 + squishFactor)
                let fheight = height * (1 - squishFactor);
                
                Draw.color();
				Draw.rect(tex, width/2 + ox, Math.min(-height * (1.0 - fin) + height/2 + oy - 1, anchor ? fheight/2 : -1000.0), fwidth, fheight);
             
                let pad = Scl.scl(12);
                hintLabel.setBounds(pad/2, height + oy, width-pad*2, 0)
            }

            squish = Mathf.approachDelta(squish, 0, 0.05);
        }
    });
    elem.update(() => {
        hints.getChildren().each(group => {
            if(group.getChildren().size > 1){
                group.getChildren().get(0).visible = !hasUnit;
            }
        });
        if(hasUnit && !hintLabel.visible){
            hintLabel.restart();
        }
        hintLabel.visible = hasUnit;

        let nextHint = Reflect.get(Vars.ui.hints, "current");
        if(nextHint != lastHint){
            lastHint = nextHint;
            hintLabel.actions(Actions.parallel(Actions.show(), Actions.alpha(0, 1.0, Interp.smooth), Actions.translateBy(0, Scl.scl(-500), 0.6, Interp.swingIn)), Actions.hide());

            if(nextHint != null){
                showDialogue(fetchText(nextHint));
            }
        }
    });
    elem.touchable = Touchable.disabled;
    Core.app.post(() => Vars.ui.hudGroup.addChildAt(0, elem));
})
