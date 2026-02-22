const selectOldBtn = document.getElementById('selectOld');
const oldPathSpan = document.getElementById('oldPath');
const selectNewBtn = document.getElementById('selectNew');
const newPathSpan = document.getElementById('newPath');
const transferBtn = document.getElementById('transfer');

let oldPath = '';
let newPath = '';

selectOldBtn.addEventListener('click', async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) {
        oldPath = path;
        oldPathSpan.textContent = path;
    }
});

selectNewBtn.addEventListener('click', async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) {
        newPath = path;
        newPathSpan.textContent = path;
    }
});

transferBtn.addEventListener('click', async () => {
    if (!oldPath || !newPath) {
        alert('Please select both old and new modpack folders.');
        return;
    }

    const options = {
        minecraftConfigs: document.getElementById('minecraftConfigs').checked,
        xaerosConfigs: document.getElementById('xaerosConfigs').checked,
        xaerosWorldMap: document.getElementById('xaerosWorldMap').checked,
        xaerosMiniMapWaypoints: document.getElementById('xaerosMiniMapWaypoints').checked,
        createSchematics: document.getElementById('createSchematics').checked
    };

    if (!Object.values(options).some(v => v)) {
        alert('Please select at least one option to transfer.');
        return;
    }

    const result = await window.electronAPI.transferConfigs({ oldPath, newPath, options });
    alert(result.message);
});