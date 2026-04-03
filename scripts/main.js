let textures = {};
let lastType = undefined;
let fade = 0;
let squish = 0;
let reloads = [];
let lastTex = undefined;
let hintLabel = undefined;

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
            mining: loadTex(name + "-mining", mainTex),
            building: loadTex(name + "-building", mainTex),
            shooting: loadTex(name + "-shooting", mainTex),
        };
    }
}

function fetchText(hint){
    let text = Vars.mobile && Core.bundle.has("animehint." + hint.name() + ".mobile") ? Core.bundle.get("animehint." + hint.name() + ".mobile") : Core.bundle.get("animehint." + hint.name(), "");
    if(text == "") return hint.text();
    if(!Vars.mobile) text = text.replace("tap", "click").replace("Tap", "Click");
    return text;
}

function showDialogue(text){
    hintLabel.actions(Actions.parallel(Actions.alpha(0, 1.0, Interp.smooth), Actions.translateBy(0, Scl.scl(-500), 0.6, Interp.swingIn)), Actions.remove());

    if(text){
        hintLabel.clearActions();
        hintLabel.actions(Actions.translateBy(-hintLabel.translation.x, -hintLabel.translation.y, 0.5, Interp.swingIn));
        Vars.ui.hudGroup.addChildAt(1, hintLabel);
        hintLabel.restart("{ease}" + text);
    }
}

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
    config[UnitTypes.alpha] = {
        anchor: true
    }

    let hints = Reflect.get(Vars.ui.hints, "group");
    let lastHint;
    hintLabel = new FLabel("");
    hintLabel.setStyle(Styles.outlineLabel);
    hintLabel.setAlignment(Align.center, Align.left);
    hintLabel.setWrap(true);
    
    let elem = extend(Element, {
        draw(){
            let width = Math.min(Scl.scl(300), Core.graphics.getWidth()/2);
            if(!Vars.player.dead()){
                let next = Vars.player.unit().type;
                if(next == UnitTypes.block){
                    next = Vars.player.unit().tile().block;
                }
                if(lastType != next){
                    fade = Mathf.approachDelta(fade, 0, 0.04);
                    if(fade <= 0.01){
                        lastType = next;
                        reloads = Array(Vars.player.unit().mounts.length);
                        squish = 1;
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
	        
	        if(lastType && textures[lastType] && Vars.state.isGame()){
                let isSummer = Vars.indexer.isBlockPresent(Blocks.sand) && Vars.indexer.isBlockPresent(Blocks.sandWater) && !Vars.indexer.isBlockPresent(Blocks.ice) && !Vars.indexer.isBlockPresent(Blocks.snow) && 
                    (Vars.indexer.isBlockPresent(Blocks.water) || Vars.indexer.isBlockPresent(Blocks.deepWater));

                let mainData = textures[lastType];
                let data = (isSummer ? mainData.summer : mainData.def) || mainData.def;
                let unit = Vars.player.unit();

                let mainTex = 
                    Vars.player.dead() ? data.main : 
                    (
                        unit.mining() ? data.mining :
                        unit.activelyBuilding() ? data.building :
                        unit.isShooting ? data.shooting :
                        data.main
                    );
                
                if(lastTex != mainTex){
                    squish = Math.max(squish, 0.5);
                    lastTex = mainTex;
                }

                let conf = config[lastType] || {}
                let fin = Interp.swingOut.apply(fade);
                let hOffset = config.anchor ? 0 : 0.02;
	            let tex = Draw.wrap(mainTex);
	            let height = width * tex.height / tex.width;
                let squishFactor = 0.2 * squish + Mathf.sin(Time.time, 20, 0.01);
                let floatScl = 50, floatMag = 8;
                let ox = Mathf.sin(Time.time, 100, floatMag * 0.25), oy = Mathf.cos(Time.time + 5, floatScl, floatMag);
	            Draw.rect(tex, width/2 + ox, -height * (1.0 - (conf.anchor ? Math.min(fin, 1) : fin)) + height/2 - height * hOffset + (conf.anchor ? 0 : oy) - 1, width * (1 + squishFactor), height * (1 - (conf.anchor ? 0 : squishFactor)));
             
                let pad = Scl.scl(8);
                hintLabel.setBounds(pad/2, height + oy, width-pad, 0)
            }

            squish = Mathf.approachDelta(squish, 0, 0.05);
        }
    });
    elem.update(() => {
        hints.getChildren().each(group => {
            if(group.getChildren().size > 1){
                group.getChildren().get(0).remove();
            }
        });

        let nextHint = Reflect.get(Vars.ui.hints, "current");
        if(nextHint != lastHint){
            lastHint = nextHint;
            hintLabel.actions(Actions.parallel(Actions.alpha(0, 1.0, Interp.smooth), Actions.translateBy(0, Scl.scl(-500), 0.6, Interp.swingIn)), Actions.remove());

            if(nextHint != null){
                showDialogue(fetchText(nextHint));
            }
        }
    });
    elem.touchable = Touchable.disabled;
    Core.app.post(() => Vars.ui.hudGroup.addChildAt(0, elem));
})
