/* One catalog for the authoritative kit and its matching live head artwork. */
(function(scope) {
  'use strict';
  const heads = {
    slot:['Flat','M5 12h18v4H5z'],
    cross:['Cross','M12 4h4v8h8v4h-8v8h-4v-8H4v-4h8z'],
    pozidriv:['Pozi','M12 4h4v8h8v4h-8v8h-4v-8H4v-4h8z M5 5h3l3 3-3 3-3-3z M20 5h3v3l-3 3-3-3z M5 20l3-3 3 3-3 3H5z M20 17l3 3v3h-3l-3-3z'],
    hex:['Hex','M8 5h12l6 9-6 9H8l-6-9z'],
    star:['Star','M14 3l4 6 7 1-3 6 1 7-7-1-5 4-3-7-6-3 5-5 1-7z'],
    triwing:['Tri-wing','M12 4h4v8l7 5-2 4-7-5-7 5-2-4 7-5z'],
    square:['Square','M6 6h16v16H6z'],
    triangle:['Triangle','M14 3L26 24H2z'],
    pentagon:['Penta','M14 3l12 9-5 13H7L2 12z'],
    doublehex:['12-point','M10 3h8l2 5 5 2v8l-5 2-2 5h-8l-2-5-5-2v-8l5-2z'],
    pinhex:['Pin hex','M8 4h12l6 10-6 10H8L2 14z M14 10a4 4 0 1 0 0 8 4 4 0 1 0 0-8z'],
    pinstar:['Pin star','M14 2l4 6 7 2-3 6 1 7-7-1-5 4-3-7-6-3 5-5 1-7z M14 10a4 4 0 1 0 0 8 4 4 0 1 0 0-8z'],
    pinsquare:['Pin square','M4 4h20v20H4z M10 10h8v8h-8z'],
    spanner:['Spanner','M7 9a5 5 0 1 0 0 10 5 5 0 1 0 0-10z M21 9a5 5 0 1 0 0 10 5 5 0 1 0 0-10z'],
    twinslot:['Twin slot','M4 7h20v5H4z M4 17h20v5H4z'],
    trislot:['Tri-slot','M4 5h20v4H4z M4 12h20v4H4z M4 19h20v4H4z'],
    ydrive:['Y-drive','M4 4l10 9L24 4l3 4-11 9v9h-4v-9L1 8z'],
    clutch:['Clutch','M3 5h7l4 6 4-6h7v18h-7l-4-6-4 6H3z'],
    butterfly:['Butterfly','M3 3l11 8L25 3v22l-11-8-11 8z'],
    spline:['Spline','M11 2h6v5l3-3 4 4-3 3h5v6h-5l3 3-4 4-3-3v5h-6v-5l-3 3-4-4 3-3H2v-6h5L4 8l4-4 3 3z'],
    offset:['Offset cross','M8 3h5v9h12v5H13v8H8v-8H3v-5h5z'],
    oval:['Oval','M14 3c6 0 8 5 8 11s-2 11-8 11-8-5-8-11S8 3 14 3z'],
    doubled:['Double-D','M7 4h14a14 14 0 0 1 0 20H7A14 14 0 0 1 7 4z'],
    tripoint:['Tri-point','M11 3h6v9l8 5-3 6-8-5-8 5-3-6 8-5z M12 12h4v4h-4z']
  };
  const colors = {red:'#fa5959',blue:'#548aff',green:'#2fac77',yellow:'#f2d64f',orange:'#ef9346',purple:'#a580ef',pink:'#f397cd',cyan:'#64d9e1',white:'#e7e9ec',brown:'#ad7652',lime:'#b9e35d',gray:'#8b929e'};
  // Alternative display palettes, not simulations or changes to puzzle identities.
  // Names remain visible on every cable, including in the default palette.
  const palettes = {
    off:{label:'Off · original colors',values:Object.values(colors)},
    protan:{label:'Protan · red weakness',values:['#ffa43b','#5089e8','#e9d369','#fff5a4','#b97525','#9774d0','#ffc4ea','#63dcf1','#f8fbff','#8e794c','#c4dd97','#8796a9']},
    deutan:{label:'Deutan · green weakness',values:['#f58d4d','#578eff','#e4c255','#fff29c','#ae7226','#a38add','#ffc5e7','#62dcde','#f8fbff','#94734e','#d1e89f','#8396ac']},
    tritan:{label:'Tritan · blue weakness',values:['#ff706a','#36a69c','#91d7bc','#f9d7da','#d77b85','#96576f','#f4a3c0','#b7eeea','#fbf7ef','#925347','#b8be93','#879e9d']}
  };
  function wireGeometry(layout, index, count) {
    const variant = Math.max(0,Math.min(4,Number(layout?.variant)||0));
    const step = 262 / Math.max(1,count-1), row = i => 29+i*step;
    // Scramble the outer terminals in small bundles. Every cable passes through
    // its own unobstructed 80-unit center span, including on the narrow board.
    const permute = (i,size,shift) => {const base=Math.floor(i/size)*size,n=Math.min(size,count-base);return base+(i-base+shift)%n;};
    const left = row(permute(index,variant%2?4:3,1));
    const right = row(permute(index,variant===2?5:3,variant%3+1));
    const y = row(index) + (layout?.jitter?.[index] || 0);
    const bow = (index%2 ? 1 : -1)*(22+variant*5+(index%3)*5);
    return { y,left,right,
      before:`M32 ${left} C${72+index%3*18} ${left},${120+variant*8} ${Math.max(12,Math.min(308,y+bow))},${184-index%3*9} ${Math.max(12,Math.min(308,y+bow))} S230 ${y},260 ${y} L290 ${y}`,
      after:`M310 ${y} L340 ${y} C${374+index%3*7} ${y},${396-variant*6} ${Math.max(12,Math.min(308,y-bow))},${438+index%3*11} ${Math.max(12,Math.min(308,y-bow))} S502 ${right},568 ${right}`
    };
  }
  const catalog={heads,colors,palettes,wireGeometry};
  if(typeof module !== 'undefined') module.exports=catalog;
  else scope.SafeCrackerHeistCatalog=catalog;
})(typeof window === 'undefined' ? globalThis : window);
