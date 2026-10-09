"use strict";

// One identity/rarity table for the server, game renderer, and component preview.
(function publish(root, factory) {
  const catalog = factory();
  if (typeof module === "object" && module.exports) module.exports = catalog;
  if (root) root.FISHING_CATALOG = catalog;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const tiers = Object.freeze([
    Object.freeze({id:"common", label:"Common", chance:.70, color:"#79d69a"}),
    Object.freeze({id:"uncommon", label:"Uncommon", chance:.24, color:"#79bdff"}),
    Object.freeze({id:"rare", label:"Rare", chance:.05, color:"#cb9dff"}),
    Object.freeze({id:"mythical", label:"Mythical", chance:.01, color:"#ffe071"})
  ]);
  const bands = [
    ["Titan Sturgeon","Grand Marlin","Giant Bluefin Tuna","Broadbill Swordfish","Arapaima","Mekong Giant Catfish","Sailfish","Paddlefish"],
    ["King Salmon","Northern Muskie","Lake Sturgeon","Alligator Gar","Wels Catfish","Goliath Tigerfish","Tarpon","Great Barracuda","Electric Eel","Red Drum"],
    ["Largemouth Bass","Rainbow Trout","Red Snapper","Northern Pike","Striped Bass","Mahi-Mahi","Peacock Bass","Common Carp","Atlantic Cod","Black Sea Bass","Lionfish","Moonfish","Coelacanth"],
    ["Yellow Perch","Black Crappie","Bluegill","Brook Trout","Koi Carp","Clown Knifefish","Oscar","River Bream","Blue Tang","Copperband Butterflyfish","Pufferfish","Mandarinfish"],
    ["Silver Minnow","Sardine","Tiny Sunfish","Anchovy","Neon Tetra","Guppy","Smelt","Dwarf Gourami","Royal Gramma","Zebra Pleco"]
  ];
  const uncommon = new Set(["Titan Sturgeon","Grand Marlin","Arapaima","Mekong Giant Catfish","Alligator Gar","Wels Catfish","Goliath Tigerfish","Electric Eel","Mahi-Mahi","Coelacanth","Clown Knifefish","Copperband Butterflyfish","Mandarinfish","Royal Gramma","Oscar","Blue Tang","Koi Carp","Neon Tetra"]);
  const rare = new Set(["Zebra Pleco","Moonfish","Lionfish"]);
  const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const ordinary = bands.flatMap((names, band) => names.map(name => ({
    name, baseName:name, variant:"standard", rarity:rare.has(name)?"rare":uncommon.has(name)?"uncommon":"common",
    special:rare.has(name), band, asset:"/assets/fishing/images/v2/fish/"+slug(name)+"-v2.png"
  })));
  const specials = [
    ["Gilded Sovereign","golden","golden-wide","rare"],
    ["Moonsteel Phantom","silver","silver-wide","rare"],
    ["Prismfin Monarch","crystal","crystal-wide","rare"],
    ["Captain Pearl","albino","albino-hat-wide","rare"],
    ["Midnight Revenant","midnight","midnight-wide","rare"],
    ["Verdant Leviathan","emerald","emerald-wide","rare"],
    ["Nemo","nemo","nemo","mythical"],
    ["Aurora Koi","aurora","aurora-koi","mythical"],
    ["Celestial Anglerfish","celestial","celestial-anglerfish","mythical"]
  ].map(([name,variant,asset,rarity])=>({
    name, baseName:name, variant, rarity, special:true, band:-1,
    asset:"/assets/fishing/images/v2/rare/"+asset+"-v2.png"
  }));
  const entries = Object.freeze([...ordinary,...specials].map(Object.freeze));
  const byName = new Map(entries.map(f=>[f.name.toLowerCase(),f]));
  const byVariant = new Map(specials.map(f=>[f.variant,f]));
  const rank = rarity => Math.max(0,tiers.findIndex(t=>t.id===rarity));
  const ordered = Object.freeze([...entries].sort((a,b)=>rank(a.rarity)-rank(b.rarity)));
  function resolve(value) {
    const object = value && typeof value==="object" ? value : {};
    const raw = String(typeof value==="string"?value:object.name||object.baseName||"Fish").trim();
    const variant = String(object.variant||object.bestVariant||"").toLowerCase();
    if(byVariant.has(variant)) return byVariant.get(variant);
    const exact = byName.get(raw.toLowerCase());
    if(exact) return exact;
    // Read old "Golden Largemouth Bass" catches without changing their size,
    // image, ownership, claim time, or the saved historical logbook.
    const prefix=raw.match(/^(golden|silver|crystal|albino|midnight|emerald)\s+/i);
    if(prefix) return byVariant.get(prefix[1].toLowerCase());
    const base=byName.get(String(object.baseName||"").toLowerCase());
    if(base) return base;
    return {name:raw,baseName:raw,variant:"standard",rarity:"common",special:false,asset:"/assets/fishing/images/v2/fish/"+slug(raw)+"-v2.png"};
  }
  function identity(value) {
    const fish=resolve(value);
    return {name:fish.name,baseName:fish.name,variant:fish.variant,rarity:fish.rarity,special:fish.special};
  }
  function pick(size, random=Math.random) {
    // One unconditional tier roll: the three Mythical fish SHARE exactly 1%.
    // The size was rolled separately; rarity cannot guarantee a winning fish.
    const roll=Math.min(1-Number.EPSILON,Math.max(0,random()));
    let tier="mythical", edge=0;
    for(const candidate of tiers){edge+=candidate.chance;if(roll<edge){tier=candidate.id;break;}}
    const band=size>=88?0:size>=70?1:size>=48?2:size>=28?3:4;
    const pool=entries.filter(f=>f.rarity===tier&&(f.special||f.band===band));
    return identity(pool[Math.min(pool.length-1,Math.floor(Math.max(0,random())*pool.length))]);
  }
  function records(book={}) {
    const result=new Map();
    const add=(fish,entry)=>{
      const prior=result.get(fish.name);
      const better=!prior||Number(entry.bestSize||0)>Number(prior.bestSize||0);
      result.set(fish.name,{...(better?entry:prior),name:fish.name,bestVariant:fish.variant,
        count:Number(prior?.count||0)+Number(entry.count||0),
        rareCount:Number(prior?.rareCount||0)+Number(entry.rareCount||0)});
    };
    for(const entry of Object.values(book.species||{})){
      if(!entry||typeof entry!=="object")continue;
      const fish=resolve({...entry,variant:entry.bestVariant});
      const oldBase=byName.get(String(entry.name||"").toLowerCase());
      if(fish.special&&oldBase&&!oldBase.special){
        // Old books combined normal and special catches under a normal name.
        // Keep both known discoveries, without assigning a rare fish's length
        // as the normal fish's personal best (that older value was not saved).
        const rareCount=Math.max(1,Number(entry.rareCount||0));
        const normalCount=Math.max(0,Number(entry.count||0)-rareCount);
        if(normalCount)add(oldBase,{...entry,count:normalCount,rareCount:0,bestSize:0,legacyBestUnknown:true});
        add(fish,{...entry,count:rareCount,rareCount});
      }else add(fish,entry);
    }
    return result;
  }
  // Visible upper-back attachment points, measured from the PNG alpha channel.
  // Coordinates are relative to rendered width in the .68-aspect fish box;
  // transparent padding is included, and the outer tail tips are excluded.
  const hookAnchors = Object.freeze({
    "Titan Sturgeon":Object.freeze([0.421875,0.24625]),
    "Grand Marlin":Object.freeze([0.515625,0.066563]),
    "Giant Bluefin Tuna":Object.freeze([0.597656,0.1525]),
    "Broadbill Swordfish":Object.freeze([0.492188,0.101719]),
    "Arapaima":Object.freeze([0.277344,0.211094]),
    "Mekong Giant Catfish":Object.freeze([0.527344,0.101719]),
    "Sailfish":Object.freeze([0.486979,0.045729]),
    "Paddlefish":Object.freeze([0.309896,0.149896]),
    "King Salmon":Object.freeze([0.464844,0.136875]),
    "Northern Muskie":Object.freeze([0.257813,0.144688]),
    "Lake Sturgeon":Object.freeze([0.273438,0.207188]),
    "Alligator Gar":Object.freeze([0.253906,0.222813]),
    "Wels Catfish":Object.freeze([0.5625,0.105625]),
    "Goliath Tigerfish":Object.freeze([0.433594,0.097813]),
    "Tarpon":Object.freeze([0.484375,0.084792]),
    "Great Barracuda":Object.freeze([0.585938,0.147292]),
    "Electric Eel":Object.freeze([0.263021,0.144688]),
    "Red Drum":Object.freeze([0.601563,0.056146]),
    "Largemouth Bass":Object.freeze([0.554688,0.093906]),
    "Rainbow Trout":Object.freeze([0.433594,0.066563]),
    "Red Snapper":Object.freeze([0.589844,0.066563]),
    "Northern Pike":Object.freeze([0.261719,0.09]),
    "Striped Bass":Object.freeze([0.636719,0.086094]),
    "Mahi-Mahi":Object.freeze([0.625,0.031406]),
    "Peacock Bass":Object.freeze([0.609375,0.035313]),
    "Common Carp":Object.freeze([0.460938,0.019688]),
    "Atlantic Cod":Object.freeze([0.552083,0.074375]),
    "Black Sea Bass":Object.freeze([0.591146,0.056146]),
    "Lionfish":Object.freeze([0.591146,0.014479]),
    "Moonfish":Object.freeze([0.432292,0.030104]),
    "Coelacanth":Object.freeze([0.518229,0.071771]),
    "Yellow Perch":Object.freeze([0.613281,0.035313]),
    "Black Crappie":Object.freeze([0.402344,0.015781]),
    "Bluegill":Object.freeze([0.585938,0.0275]),
    "Brook Trout":Object.freeze([0.457031,0.078281]),
    "Koi Carp":Object.freeze([0.542969,0.031406]),
    "Clown Knifefish":Object.freeze([0.546875,0.12125]),
    "Oscar":Object.freeze([0.558594,0.007969]),
    "River Bream":Object.freeze([0.457031,0.019688]),
    "Blue Tang":Object.freeze([0.653646,0.061354]),
    "Copperband Butterflyfish":Object.freeze([0.46875,0.022292]),
    "Pufferfish":Object.freeze([0.554688,0.043125]),
    "Mandarinfish":Object.freeze([0.546875,0.032708]),
    "Silver Minnow":Object.freeze([0.480469,0.101719]),
    "Sardine":Object.freeze([0.5,0.12125]),
    "Tiny Sunfish":Object.freeze([0.539063,0.047031]),
    "Anchovy":Object.freeze([0.503906,0.109531]),
    "Neon Tetra":Object.freeze([0.460938,0.062656]),
    "Guppy":Object.freeze([0.253906,0.023594]),
    "Smelt":Object.freeze([0.484375,0.105625]),
    "Dwarf Gourami":Object.freeze([0.472656,0.000156]),
    "Royal Gramma":Object.freeze([0.609375,0.063958]),
    "Zebra Pleco":Object.freeze([0.507813,0.032708]),
    "Gilded Sovereign":Object.freeze([0.518229,0.074375]),
    "Moonsteel Phantom":Object.freeze([0.325521,0.144688]),
    "Prismfin Monarch":Object.freeze([0.552083,0.071771]),
    "Captain Pearl":Object.freeze([0.617188,0.061354]),
    "Midnight Revenant":Object.freeze([0.419271,0.061354]),
    "Verdant Leviathan":Object.freeze([0.445313,0.063958]),
    "Nemo":Object.freeze([0.645833,0.032708]),
    "Aurora Koi":Object.freeze([0.591146,0.032708]),
    "Celestial Anglerfish":Object.freeze([0.536458,0.017083]),
  });
  function hookStyle(value) {
    const [x,y]=hookAnchors[resolve(value).name]||[.5,0];
    return "--fish-pin-x:calc(var(--fish-width) * "+x+");--fish-pin-y:calc(var(--fish-width) * "+y+")";
  }
  return Object.freeze({tiers,entries,ordered,resolve,identity,pick,records,rank,hookAnchors,hookStyle});
});
