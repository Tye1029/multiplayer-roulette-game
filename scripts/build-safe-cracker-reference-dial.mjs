const CX = 160;
const CY = 160;

function rotatePoint(x, y, degrees) {
  const radians = degrees * Math.PI / 180;
  const dx = x - CX;
  const dy = y - CY;
  return [
    CX + dx * Math.cos(radians) - dy * Math.sin(radians),
    CY + dx * Math.sin(radians) + dy * Math.cos(radians)
  ];
}

function point([x, y]) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function polygon(points, degrees) {
  return `M${points.map(value => point(rotatePoint(value[0], value[1], degrees))).join('L')}Z`;
}

function line(from, to, degrees) {
  return `M${point(rotatePoint(from[0], from[1], degrees))}L${point(rotatePoint(to[0], to[1], degrees))}`;
}

export function buildSafeCrackerReferenceDialSvg() {
  const gripFaces = [];
  const gripTop = [];
  const gripLeft = [];
  const gripRight = [];
  const scratchLight = [];
  const scratchDark = [];
  const separatorFaces = [];
  const separatorHighlights = [];

  for (let index = 0; index < 40; index += 1) {
    const angle = index * 9;
    gripFaces.push(polygon([[151.4, 3.2], [168.6, 3.2], [166.5, 28.5], [153.5, 28.5]], angle));
    gripTop.push(line([152.4, 5.1], [167.6, 5.1], angle));
    gripLeft.push(line([153.1, 7.1], [154.2, 26.6], angle));
    gripRight.push(line([166.9, 7.2], [165.8, 26.5], angle));

    const scratchOne = 10 + (index % 3) * 1.2;
    const scratchTwo = 16.2 + (index % 4) * 0.9;
    const scratchThree = 22 + (index % 2) * 1.1;
    scratchLight.push(
      line([154.2, scratchOne], [165.7, scratchOne - 1.7], angle),
      line([154.7, scratchTwo], [164.8, scratchTwo - 1.3], angle),
      line([155.2, scratchThree], [164.6, scratchThree - 1.1], angle)
    );
    scratchDark.push(
      line([154.6, scratchOne + 2.2], [164.9, scratchOne + 3.1], angle),
      line([155.2, scratchTwo + 2.5], [164, scratchTwo + 1.7], angle)
    );

    const separatorAngle = angle + 4.5;
    separatorFaces.push(polygon([[159.25, 4], [160.75, 4], [160.45, 28], [159.55, 28]], separatorAngle));
    separatorHighlights.push(polygon([[159.72, 5], [160.08, 5], [160.08, 27], [159.72, 27]], separatorAngle));
  }

  const minorTicks = [];
  const minorTickHighlights = [];
  const majorTicks = [];
  for (let index = 0; index < 100; index += 1) {
    const angle = index * 3.6;
    if (index % 10 === 0) {
      majorTicks.push(polygon([[158.55, 30.8], [161.45, 30.8], [160.9, 40.3], [159.1, 40.3]], angle));
    } else {
      minorTicks.push(polygon([[159.35, 32.5], [160.65, 32.5], [160.45, 38.5], [159.55, 38.5]], angle));
      minorTickHighlights.push(polygon([[159.72, 33], [160.05, 33], [160.05, 37.9], [159.72, 37.9]], angle));
    }
  }

  const dividerFaces = [];
  const dividerHighlights = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = index * 36;
    dividerFaces.push(polygon([[158.15, 67.5], [161.85, 67.5], [160.95, 89], [159.05, 89]], angle));
    dividerHighlights.push(polygon([[159.05, 69], [160, 69], [160, 87.5], [159.05, 87.5]], angle));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Layered brushed-silver Safe Cracker dial">
<defs>
<radialGradient id="outer" cx="38%" cy="25%" r="82%"><stop offset="0" stop-color="#353d40"/><stop offset=".28" stop-color="#171c1f"/><stop offset=".7" stop-color="#080b0d"/><stop offset="1" stop-color="#010202"/></radialGradient>
<linearGradient id="grip" x1=".08" y1=".04" x2=".94" y2=".96"><stop offset="0" stop-color="#555e62"/><stop offset=".12" stop-color="#2a3033"/><stop offset=".48" stop-color="#0c0f11"/><stop offset=".76" stop-color="#202629"/><stop offset="1" stop-color="#040607"/></linearGradient>
<linearGradient id="silver" x1=".05" y1=".08" x2=".95" y2=".92"><stop offset="0" stop-color="#313a3e"/><stop offset=".10" stop-color="#aeb8bc"/><stop offset=".20" stop-color="#f2f4f5"/><stop offset=".34" stop-color="#7d888c"/><stop offset=".50" stop-color="#e0e5e6"/><stop offset=".67" stop-color="#626d72"/><stop offset=".83" stop-color="#c4cccf"/><stop offset="1" stop-color="#252d31"/></linearGradient>
<radialGradient id="numberBand" cx="37%" cy="25%" r="82%"><stop offset="0" stop-color="#1b2023"/><stop offset=".38" stop-color="#0c0f11"/><stop offset=".76" stop-color="#050708"/><stop offset="1" stop-color="#010202"/></radialGradient>
<radialGradient id="slope" cx="38%" cy="24%" r="83%"><stop offset="0" stop-color="#717c80"/><stop offset=".17" stop-color="#4b5559"/><stop offset=".43" stop-color="#252c2f"/><stop offset=".73" stop-color="#111719"/><stop offset="1" stop-color="#040607"/></radialGradient>
<pattern id="brush" width="5" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(7)"><path d="M0 .45H5M0 1.55H5M0 2.6H5" stroke="#fff" stroke-opacity=".08" stroke-width=".38"/><path d="M0 1H5M0 2.15H5" stroke="#000" stroke-opacity=".2" stroke-width=".45"/></pattern>
</defs>
<circle cx="160" cy="160" r="159" fill="#000"/><circle cx="160" cy="160" r="156" fill="url(#outer)" stroke="#424c50" stroke-width="2"/><circle cx="160" cy="160" r="152" fill="#070a0c" stroke="#020304" stroke-width="3"/>
<path class="grip-blocks" data-count="40" d="${gripFaces.join(' ')}" fill="url(#grip)" stroke="#020304" stroke-width="1.5"/>
<path class="grip-highlights" d="${gripTop.join(' ')}" fill="none" stroke="#e0e5e6" stroke-opacity=".28" stroke-width=".9"/>
<path class="grip-left-bevels" d="${gripLeft.join(' ')}" fill="none" stroke="#f3f5f5" stroke-opacity=".09" stroke-width=".7"/>
<path class="grip-right-bevels" d="${gripRight.join(' ')}" fill="none" stroke="#000" stroke-opacity=".84" stroke-width="1.15"/>
<path class="grip-scratches-light" d="${scratchLight.join(' ')}" fill="none" stroke="#b8c0c3" stroke-opacity=".24" stroke-width=".72" stroke-linecap="round"/>
<path class="grip-scratches-dark" d="${scratchDark.join(' ')}" fill="none" stroke="#000" stroke-opacity=".68" stroke-width=".8" stroke-linecap="round"/>
<path class="grip-separators" data-count="40" d="${separatorFaces.join(' ')}" fill="#aeb8bc" opacity=".55"/><path class="grip-separator-highlights" d="${separatorHighlights.join(' ')}" fill="#f4f6f6" opacity=".28"/>
<circle cx="160" cy="160" r="149" fill="none" stroke="#000" stroke-opacity=".75" stroke-width="2"/><circle cx="160" cy="160" r="132" fill="none" stroke="#010203" stroke-width="5"/>
<circle class="silver-bezel-shadow" cx="160" cy="160" r="136" fill="none" stroke="#050708" stroke-width="23"/><circle class="silver-bezel" cx="160" cy="160" r="136" fill="none" stroke="url(#silver)" stroke-width="16"/><circle class="silver-brush" cx="160" cy="160" r="136" fill="none" stroke="url(#brush)" stroke-width="13.5" opacity=".78"/><circle cx="160" cy="160" r="144.5" fill="none" stroke="#eef2f3" stroke-opacity=".30" stroke-width="1.2"/><circle cx="160" cy="160" r="127.5" fill="none" stroke="#020405" stroke-width="3.4"/>
<circle class="number-band" cx="160" cy="160" r="126" fill="url(#numberBand)" stroke="#010202" stroke-width="2.2"/><circle cx="160" cy="160" r="96" fill="#090c0e" stroke="#596469" stroke-width="2.6"/>
<path class="minor-ticks" data-count="90" d="${minorTicks.join(' ')}" fill="#bdc6c9"/><path class="minor-tick-highlights" d="${minorTickHighlights.join(' ')}" fill="#f1f4f4" opacity=".4"/><path class="major-ticks" data-count="10" d="${majorTicks.join(' ')}" fill="url(#silver)" stroke="#1b2225" stroke-width=".55"/>
<circle class="inner-slope" cx="160" cy="160" r="93" fill="url(#slope)" stroke="#090c0e" stroke-width="3.5"/><circle cx="160" cy="160" r="91" fill="none" stroke="url(#silver)" stroke-width="2.8" opacity=".86"/><circle cx="160" cy="160" r="89" fill="none" stroke="#f0f3f4" stroke-opacity=".16" stroke-width=".8"/>
<path class="inner-dividers" data-count="10" d="${dividerFaces.join(' ')}" fill="url(#silver)" stroke="#080b0d" stroke-width=".7"/><path class="inner-divider-highlights" d="${dividerHighlights.join(' ')}" fill="#f5f6f6" opacity=".27"/>
<circle class="inner-hub-ring" cx="160" cy="160" r="68" fill="#111719" stroke="url(#silver)" stroke-width="4.6"/><circle cx="160" cy="160" r="65" fill="#050708" stroke="#222a2e" stroke-width="2.2"/>
<path d="M69 87A128 128 0 0 1 113 42" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="2.5" stroke-linecap="round"/><path d="M74 245A126 126 0 0 0 251 220" fill="none" stroke="#000" stroke-opacity=".44" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}
