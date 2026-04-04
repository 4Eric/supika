const fs = require('fs');
const path = 'e:/yby_vibe/frontend/src/views/EventDetail.vue';
let content = fs.readFileSync(path, 'utf8');
const before = '@click="selectedTimeSlot = slot.id"';
const after = '@click="selectedTimeSlot = (selectedTimeSlot === slot.id ? null : slot.id)"';
if (content.includes(before)) {
    content = content.replace(before, after);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done!');
} else {
    console.log('Pattern not found. Searching for similar...');
    const lines = content.split('\n');
    lines.forEach((l, i) => { if (l.includes('selectedTimeSlot') && l.includes('slot.id')) console.log(i+1, JSON.stringify(l)); });
}
