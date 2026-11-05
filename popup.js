const modes = [
  ['all', 'All pets'], ['corgis-kitties', 'Corgis & Kitties'], ['corgis', 'Corgis'],
  ['kitties', 'Kitties'], ['octopus', 'Octopus'], ['off', 'Off']
];
const enabled = document.querySelector('#enabled');
const modesElement = document.querySelector('#modes');
document.querySelector('#demo').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') }));
function save(values) { chrome.storage.local.set(values); }
function render(settings) {
  enabled.checked = settings.enabled;
  modesElement.replaceChildren(...modes.map(([value, label]) => {
    const button = document.createElement('button');
    button.className = 'mode'; button.textContent = label;
    button.setAttribute('aria-pressed', String(settings.petMode === value));
    button.addEventListener('click', () => save({ petMode: value, enabled: value !== 'off' }));
    return button;
  }));
}
chrome.storage.local.get({ enabled: true, petMode: 'all' }).then(render);
chrome.storage.onChanged.addListener(() => chrome.storage.local.get({ enabled: true, petMode: 'all' }).then(render));
enabled.addEventListener('change', () => save({ enabled: enabled.checked }));
