const fs = require('fs');

let cleanHtml = fs.readFileSync('src/index.html', 'utf8');
let tempHtml = fs.readFileSync('src/index_temp.html', 'utf16le');

// 1. EXTRACT NEW CSS
let newCssStart = tempHtml.indexOf('/* -- TABS -- */');
let newCssEnd = tempHtml.indexOf('</style>', newCssStart);
let newCss = tempHtml.substring(newCssStart, newCssEnd);
if (!newCss.includes('.modal-overlay')) {
  newCss += `
    /* -- MODAL SETTINGS FIX -- */
    .modal-overlay {
      position: fixed; inset: 0; background: oklch(0% 0 0 / 0.65);
      display: none; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(4px);
    }
    .modal-overlay.show { display: flex; }
  `;
}
cleanHtml = cleanHtml.replace('</style>', newCss + '\n  </style>');

// 2. EXTRACT SETTINGS BUTTON
let settingsBtnStart = tempHtml.indexOf('<button class="btn-icon" onclick="openSettings()"');
let settingsBtnEnd = tempHtml.indexOf('</button>', settingsBtnStart) + 9;
let settingsBtn = tempHtml.substring(settingsBtnStart, settingsBtnEnd);

// Inject SETTINGS BUTTON right before </div> in .controls
let controlsEnd = cleanHtml.indexOf('</div>', cleanHtml.indexOf('<div class="search-container"'));
// Actually, search-container ends with </div>, but there is also <div style="flex:1;"></div> which WAS ADDED in 9446618!
// Let's just append it after the search-container.
let searchContainerEnd = cleanHtml.indexOf('</div>', cleanHtml.indexOf('search-container')) + 6;
cleanHtml = cleanHtml.substring(0, searchContainerEnd) + '\n    <div style="flex:1;"></div>\n    ' + settingsBtn + cleanHtml.substring(searchContainerEnd);

// 3. EXTRACT TABS CONTAINER
let tabsStart = tempHtml.indexOf('<div class="tabs-container" id="tabs-container"></div>');
let tabsEnd = tabsStart + 54;
let tabs = tempHtml.substring(tabsStart, tabsEnd);
cleanHtml = cleanHtml.replace('<!-- -- SOUND GRID -- -->', tabs + '\n\n  <!-- -- SOUND GRID -- -->');

// 4. EXTRACT APP SETTINGS MODAL
let settingsModalStart = tempHtml.indexOf('<div id="settingsOverlay" class="edit-overlay">');
let nextModalStart = tempHtml.indexOf('<div id="addOverlay"', settingsModalStart);
if (nextModalStart === -1) nextModalStart = tempHtml.indexOf('<div id="editOverlay"', settingsModalStart);
let settingsModal = tempHtml.substring(settingsModalStart, nextModalStart).trim() + '\n\n  ';
cleanHtml = cleanHtml.replace('<!-- -- ADD SOUND MODAL -- -->', settingsModal + '<!-- -- ADD SOUND MODAL -- -->');

// 5. BUMP VERSION TO v1.0.34
cleanHtml = cleanHtml.replace(/>v1\.0\.\d+</g, '>v1.0.34<');

fs.writeFileSync('src/index.html', cleanHtml);
console.log('Successfully rebuilt perfectly clean index.html!');
