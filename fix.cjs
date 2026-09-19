const fs = require('fs');
let html = fs.readFileSync('src/index.html', 'utf8');

// 1. Find the FIRST <!-- -- CONTROLS -- -->
let firstControls = html.indexOf('<!-- -- CONTROLS -- -->');
// 2. Find the SECOND <!-- -- CONTROLS -- -->
let secondControls = html.indexOf('<!-- -- CONTROLS -- -->', firstControls + 10);

if (secondControls === -1) {
  console.log('No duplicate controls found!');
} else {
  console.log('Found second controls at:', secondControls);
  // We want to delete from just before the SECOND <!-- -- CONTROLS -- --> 
  // down to the <script type="module" src="./main.js"></script>
  let scriptTag = html.indexOf('<script type="module" src="./main.js"></script>', secondControls);
  
  if (scriptTag !== -1) {
    let beforeDup = html.substring(0, secondControls);
    let afterDup = html.substring(scriptTag);
    html = beforeDup + afterDup;
    console.log('Removed duplicate HTML!');
  }
}

// 3. We are missing CSS for .tabs-container, .modal-overlay, etc.
// Let's just define the missing CSS explicitly so we don't rely on regex extraction!
const missingCss = `
    /* -- TABS -- */
    .tabs-container {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 15px;
      margin-bottom: 5px;
    }
    .tabs-container::-webkit-scrollbar {
      height: 4px;
    }
    .tabs-container::-webkit-scrollbar-thumb {
      background: var(--bg-3);
      border-radius: 4px;
    }
    .tabs-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .tab-btn {
      background: var(--bg-3);
      border: 1px solid var(--border);
      color: var(--text-3);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      letter-spacing: 0.05em;
    }

    .tab-btn:hover {
      background: var(--hover);
      color: var(--text-2);
      border-color: var(--text-5);
    }

    .tab-btn.active {
      background: var(--accent-2);
      color: var(--bg-1);
      border-color: var(--accent-2);
      box-shadow: 0 0 10px rgba(0, 230, 204, 0.2);
    }

    /* -- MODAL SETTINGS FIX -- */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: oklch(0% 0 0 / 0.65);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .modal-overlay.show { display: flex; }

    /* -- TIMER PROGRESS BARS -- */
    .progress-bar-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(0,0,0,0.3);
      border-radius: 0 0 3px 3px;
      overflow: hidden;
      display: none;
      z-index: 0;
    }
    
    .sound-button.playing .progress-bar-container {
      display: block;
    }

    .progress-bar-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      background: var(--accent-2);
    }

    .progress-bar-left {
      left: 0;
      transform-origin: left;
      transform: scaleX(0);
    }

    .progress-bar-right {
      right: 0;
      transform-origin: right;
      transform: scaleX(0);
    }
`;

if (!html.includes('.tabs-container')) {
  html = html.replace('</style>', missingCss + '\n  </style>');
  console.log('Injected missing CSS!');
}

fs.writeFileSync('src/index.html', html);
console.log('Done!');
